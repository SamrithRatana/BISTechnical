using Fido2NetLib;
using Fido2NetLib.Objects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using UserManagementAPI.Data;
using UserManagementAPI.Models;
using UserManagementAPI.Services;

namespace UserManagementAPI.Controllers
{
    /// <summary>
    /// WebAuthn / FIDO2 passkey enrolment and login - route <c>api/auth/webauthn</c>.
    ///
    /// This is the "Face Login" feature. The face never reaches this server: the
    /// user's own device performs the biometric check (Face ID, Windows Hello,
    /// Android biometric unlock) and only then unlocks a private key that signs
    /// our challenge. What we store is a public key. See
    /// <see cref="UserCredential"/>.
    ///
    /// Two design points worth knowing before editing:
    ///
    /// 1. Every request and response here is handled as raw JSON, via
    ///    <see cref="JsonElement"/> in and <c>ToJson()</c> out, instead of MVC
    ///    model binding. <c>Program.cs</c> sets
    ///    <c>PropertyNamingPolicy = null</c> (PascalCase) for this API, while
    ///    WebAuthn is a browser-facing spec whose wire format is fixed camelCase.
    ///    Going through the app's serializer would rename the fields and the
    ///    browser would reject the options object. Fido2NetLib's own
    ///    <c>ToJson()</c>/<c>FromJson()</c> and its <c>[JsonPropertyName]</c>
    ///    attributes produce exactly the spec's shape, so this bypasses the
    ///    app-wide policy on purpose. Do not "simplify" it to <c>[FromBody]</c>
    ///    typed parameters.
    ///
    /// 2. The challenge is kept server-side in <see cref="IMemoryCache"/>,
    ///    keyed by a random ceremony id the client echoes back, rather than in a
    ///    session cookie. This API is stateless (JWT) and is reached through the
    ///    Next.js proxy server-to-server, where no cookie would survive the hop.
    ///    Entries are single-use and expire in five minutes. NOTE: this makes the
    ///    ceremony sticky to one API instance - if this API is ever scaled to
    ///    more than one process, this must move to a distributed cache or a
    ///    table, or logins will fail intermittently and look like browser bugs.
    /// </summary>
    [Route("api/auth/webauthn")]
    [ApiController]
    public class WebAuthnController : ControllerBase
    {
        private readonly IFido2 _fido2;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly UserManagementContext _context;
        private readonly IMemoryCache _cache;
        private readonly ITokenIssuer _tokenIssuer;
        private readonly ILogger<WebAuthnController> _logger;

        /// <summary>
        /// How long a started ceremony stays valid. The browser's own WebAuthn
        /// prompt times out well before this; the window only has to outlast a
        /// user finding their phone.
        /// </summary>
        private static readonly TimeSpan CeremonyLifetime = TimeSpan.FromMinutes(5);

        public WebAuthnController(
            IFido2 fido2,
            UserManager<ApplicationUser> userManager,
            UserManagementContext context,
            IMemoryCache cache,
            ITokenIssuer tokenIssuer,
            ILogger<WebAuthnController> logger)
        {
            _fido2 = fido2;
            _userManager = userManager;
            _context = context;
            _cache = cache;
            _tokenIssuer = tokenIssuer;
            _logger = logger;
        }

        // =====================================================================
        // Enrolment - adding a passkey to an account that is already signed in
        // =====================================================================

        /// <summary>
        /// POST <c>register-options</c> - starts enrolment. Requires an existing
        /// signed-in session: you prove who you are with your password once, and
        /// that session is what authorises binding a new device to the account.
        /// An anonymous enrolment endpoint would let anyone attach their own
        /// phone to someone else's account.
        /// </summary>
        [HttpPost("register-options")]
        [Authorize]
        public Task<IActionResult> RegisterOptions()
            => Guarded(RegisterOptionsCore, "passkey enrolment options");

        private async Task<IActionResult> RegisterOptionsCore()
        {
            var user = await _userManager.FindByIdAsync(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "");
            if (user == null)
            {
                return Unauthorized(Fail("Not signed in."));
            }

            var existingIds = await _context.UserCredentials
                .AsNoTracking()
                .Where(c => c.UserId == user.Id)
                .Select(c => c.CredentialId)
                .ToListAsync();

            var excludeCredentials = existingIds
                .Select(id => new PublicKeyCredentialDescriptor(id))
                .ToList();

            var displayName = (user.FirstName + " " + user.LastName).Trim();
            if (string.IsNullOrWhiteSpace(displayName))
            {
                displayName = user.UserName;
            }

            var options = _fido2.RequestNewCredential(new RequestNewCredentialParams
            {
                User = new Fido2User
                {
                    // The Identity user id, not the email: this value is stored
                    // on the user's device, so it is deliberately an opaque GUID
                    // and carries nothing personal.
                    Id = Encoding.UTF8.GetBytes(user.Id),
                    Name = user.UserName,
                    DisplayName = displayName
                },
                ExcludeCredentials = excludeCredentials,
                AuthenticatorSelection = new AuthenticatorSelection
                {
                    // AuthenticatorAttachment is left unset on purpose. Pinning
                    // it to Platform would restrict enrolment to a built-in
                    // authenticator on the machine being used - which on an
                    // office desktop with no IR camera means no face option at
                    // all. Leaving it open is what offers "scan this QR with
                    // your phone" and lets the phone's Face ID do the work.
                    ResidentKey = ResidentKeyRequirement.Preferred,
                    UserVerification = UserVerificationRequirement.Required
                },
                // No attestation: we do not need to know which authenticator
                // model this is, and asking for it means handling privacy
                // prompts and a metadata service for no gain here.
                AttestationPreference = AttestationConveyancePreference.None
            });

            var ceremonyId = NewCeremonyId();
            _cache.Set(RegKey(ceremonyId), options.ToJson(), CeremonyLifetime);

            _logger.LogInformation("WebAuthn enrolment started for {UserName}.", user.UserName);
            return CeremonyResponse(ceremonyId, options.ToJson());
        }

        /// <summary>
        /// POST <c>register</c> - finishes enrolment and stores the credential.
        /// Body: <c>{ ceremonyId, deviceName?, credential }</c>.
        /// </summary>
        [HttpPost("register")]
        [Authorize]
        public Task<IActionResult> Register([FromBody] JsonElement body, CancellationToken cancellationToken)
            => Guarded(() => RegisterCore(body, cancellationToken), "passkey enrolment");

        private async Task<IActionResult> RegisterCore(JsonElement body, CancellationToken cancellationToken)
        {
            var user = await _userManager.FindByIdAsync(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "");
            if (user == null)
            {
                return Unauthorized(Fail("Not signed in."));
            }

            string optionsJson;
            string error;
            if (!TryTakeCeremony(body, RegKey, out optionsJson, out error))
            {
                return BadRequest(Fail(error));
            }

            AuthenticatorAttestationRawResponse attestation;
            try
            {
                attestation = JsonSerializer.Deserialize<AuthenticatorAttestationRawResponse>(
                    body.GetProperty("credential").GetRawText());
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Malformed WebAuthn attestation payload.");
                return BadRequest(Fail("Malformed credential payload."));
            }

            // Deserialising `{}` succeeds and yields an object with every field
            // null - System.Text.Json has nothing to object to - so the catch
            // above never fires for it. Without this check that null travelled
            // on into the verifier.
            if (attestation?.RawId == null || attestation.Response == null)
            {
                return BadRequest(Fail("Malformed credential payload."));
            }

            try
            {
                var result = await _fido2.MakeNewCredentialAsync(new MakeNewCredentialParams
                {
                    AttestationResponse = attestation,
                    OriginalOptions = CredentialCreateOptions.FromJson(optionsJson),
                    // A credential id must be unique across the whole table, not
                    // just within this user - login resolves an account FROM the
                    // credential id, so a collision would be an authentication
                    // bug rather than a duplicate row.
                    IsCredentialIdUniqueToUserCallback = async (args, ct) =>
                        !await _context.UserCredentials
                            .AsNoTracking()
                            .AnyAsync(c => c.CredentialId == args.CredentialId, ct)
                }, cancellationToken);

                var deviceName = ReadString(body, "deviceName");
                if (string.IsNullOrWhiteSpace(deviceName))
                {
                    deviceName = "Passkey";
                }
                if (deviceName.Length > 120)
                {
                    deviceName = deviceName.Substring(0, 120);
                }

                var credential = new UserCredential
                {
                    UserId = user.Id,
                    CredentialId = result.Id,
                    PublicKey = result.PublicKey,
                    UserHandle = result.User != null ? result.User.Id : Encoding.UTF8.GetBytes(user.Id),
                    SignCount = result.SignCount,
                    CredType = result.Type.ToString(),
                    AaGuid = result.AaGuid,
                    Transports = result.Transports == null
                        ? null
                        : string.Join(",", result.Transports.Select(t => t.ToString())),
                    IsBackedUp = result.IsBackedUp,
                    DeviceName = deviceName,
                    CreatedAt = DateTime.UtcNow
                };

                _context.UserCredentials.Add(credential);
                await _context.SaveChangesAsync(cancellationToken);

                _logger.LogInformation("WebAuthn credential enrolled for {UserName} ({DeviceName}).", user.UserName, deviceName);

                return Ok(new
                {
                    IsSuccess = true,
                    Message = "Passkey registered",
                    Credential = Describe(credential)
                });
            }
            catch (Fido2VerificationException ex)
            {
                _logger.LogWarning(ex, "WebAuthn enrolment rejected for {UserName}.", user.UserName);
                return BadRequest(Fail(ex.Message));
            }
        }

        // =====================================================================
        // Login
        // =====================================================================

        /// <summary>
        /// POST <c>login-options</c> - starts a passkey login. Body:
        /// <c>{ userName? }</c>.
        ///
        /// With no username, the allow-list is empty and the browser offers
        /// whichever discoverable passkeys the device holds - the usernameless
        /// flow. With a username, the list is narrowed to that account's
        /// credentials.
        ///
        /// An unknown username deliberately returns a normal options object with
        /// an empty allow-list rather than an error: answering "no such user"
        /// here would turn this endpoint into a way to test which usernames
        /// exist, which the password login is careful not to be either.
        /// </summary>
        [HttpPost("login-options")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public Task<IActionResult> LoginOptions([FromBody] JsonElement body)
            => Guarded(() => LoginOptionsCore(body), "passkey login options");

        private async Task<IActionResult> LoginOptionsCore(JsonElement body)
        {
            var userName = ReadString(body, "userName");
            var allowed = new List<PublicKeyCredentialDescriptor>();

            if (!string.IsNullOrWhiteSpace(userName))
            {
                var user = await _userManager.FindByNameAsync(userName);
                if (user != null)
                {
                    var ids = await _context.UserCredentials
                        .AsNoTracking()
                        .Where(c => c.UserId == user.Id)
                        .Select(c => c.CredentialId)
                        .ToListAsync();

                    allowed.AddRange(ids.Select(id => new PublicKeyCredentialDescriptor(id)));
                }
            }

            var options = _fido2.GetAssertionOptions(new GetAssertionOptionsParams
            {
                AllowedCredentials = allowed,
                UserVerification = UserVerificationRequirement.Required
            });

            var ceremonyId = NewCeremonyId();
            _cache.Set(LoginKey(ceremonyId), options.ToJson(), CeremonyLifetime);

            return CeremonyResponse(ceremonyId, options.ToJson());
        }

        /// <summary>
        /// POST <c>login</c> - verifies the assertion and issues the session.
        /// Body: <c>{ ceremonyId, credential }</c>.
        ///
        /// The success response is deliberately the same shape as
        /// <c>AuthController.Login</c>'s, down to the field names, so the
        /// frontend stores a passkey session exactly as it stores a password
        /// one.
        /// </summary>
        [HttpPost("login")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public Task<IActionResult> Login([FromBody] JsonElement body, CancellationToken cancellationToken)
            => Guarded(() => LoginCore(body, cancellationToken), "passkey login");

        private async Task<IActionResult> LoginCore(JsonElement body, CancellationToken cancellationToken)
        {
            string optionsJson;
            string error;
            if (!TryTakeCeremony(body, LoginKey, out optionsJson, out error))
            {
                return BadRequest(Fail(error));
            }

            AuthenticatorAssertionRawResponse assertion;
            try
            {
                assertion = JsonSerializer.Deserialize<AuthenticatorAssertionRawResponse>(
                    body.GetProperty("credential").GetRawText());
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Malformed WebAuthn assertion payload.");
                return BadRequest(Fail("Malformed credential payload."));
            }

            // See the matching note in RegisterCore: `{}` deserialises cleanly
            // into an all-null object, and a null RawId used to reach the
            // credential lookup below.
            if (assertion?.RawId == null || assertion.Response == null)
            {
                return BadRequest(Fail("Malformed credential payload."));
            }

            var stored = await _context.UserCredentials
                .FirstOrDefaultAsync(c => c.CredentialId == assertion.RawId, cancellationToken);

            if (stored == null)
            {
                _logger.LogWarning("Passkey login attempt with an unknown credential id.");
                return Unauthorized(Fail("This passkey is not registered."));
            }

            var user = await _userManager.FindByIdAsync(stored.UserId);
            if (user == null)
            {
                return Unauthorized(Fail("This passkey is not registered."));
            }

            // Same gate the password path applies. A passkey is a stronger
            // credential, but a locked account is locked for reasons that have
            // nothing to do with how strong the credential is.
            if (await _userManager.IsLockedOutAsync(user))
            {
                _logger.LogWarning("Passkey login attempt for locked account: {UserName}", user.UserName);
                return Unauthorized(Fail("Account is locked. Please try again later."));
            }

            VerifyAssertionResult result;
            try
            {
                result = await _fido2.MakeAssertionAsync(new MakeAssertionParams
                {
                    AssertionResponse = assertion,
                    OriginalOptions = AssertionOptions.FromJson(optionsJson),
                    StoredPublicKey = stored.PublicKey,
                    StoredSignatureCounter = (uint)stored.SignCount,
                    IsUserHandleOwnerOfCredentialIdCallback = (args, ct) =>
                        Task.FromResult(args.UserHandle.SequenceEqual(stored.UserHandle))
                }, cancellationToken);
            }
            catch (Fido2VerificationException ex)
            {
                _logger.LogWarning(ex, "Passkey assertion failed for {UserName}.", user.UserName);
                return Unauthorized(Fail("Passkey verification failed."));
            }

            stored.SignCount = result.SignCount;
            stored.IsBackedUp = result.IsBackedUp;
            stored.LastUsedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            await _userManager.ResetAccessFailedCountAsync(user);

            // One fetch, handed to the issuer - it needed the same list and used
            // to load its own copy. Same fix as FaceAuthController.BuildSession.
            var userRoles = await _userManager.GetRolesAsync(user);
            var token = await _tokenIssuer.CreateJwtAsync(user, userRoles);
            var jwtId = token.Claims.First(c => c.Type == JwtRegisteredClaimNames.Jti).Value;
            var refreshToken = await _tokenIssuer.CreateRefreshTokenAsync(user, jwtId);

            _logger.LogInformation("User logged in with a passkey: {UserName}", user.UserName);

            return Ok(new
            {
                IsSuccess = true,
                Message = "Login successful",
                Token = new JwtSecurityTokenHandler().WriteToken(token),
                RefreshToken = refreshToken,
                Expiration = token.ValidTo,
                User = new
                {
                    Id = user.Id,
                    UserName = user.UserName,
                    Email = user.Email,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    Roles = userRoles.ToList()
                }
            });
        }

        // =====================================================================
        // Device management
        // =====================================================================

        /// <summary>GET <c>credentials</c> - the signed-in user's own passkeys.</summary>
        [HttpGet("credentials")]
        [Authorize]
        public Task<IActionResult> GetCredentials()
            => Guarded(GetCredentialsCore, "passkey list");

        private async Task<IActionResult> GetCredentialsCore()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Fail("Not signed in."));
            }

            var credentials = await _context.UserCredentials
                .AsNoTracking()
                .Where(c => c.UserId == userId)
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            return Ok(new
            {
                IsSuccess = true,
                Credentials = credentials.Select(Describe).ToList()
            });
        }

        /// <summary>
        /// DELETE <c>credentials/{id}</c> - removes one of the signed-in user's
        /// passkeys. Scoped to the caller's own rows: an id belonging to someone
        /// else reads as "not found", so this cannot be used to strip another
        /// account's credentials.
        /// </summary>
        [HttpDelete("credentials/{id:int}")]
        [Authorize]
        public Task<IActionResult> DeleteCredential(int id)
            => Guarded(() => DeleteCredentialCore(id), "passkey removal");

        private async Task<IActionResult> DeleteCredentialCore(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Fail("Not signed in."));
            }

            var credential = await _context.UserCredentials
                .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId);

            if (credential == null)
            {
                return NotFound(Fail("Passkey not found."));
            }

            _context.UserCredentials.Remove(credential);
            await _context.SaveChangesAsync();

            _logger.LogInformation("WebAuthn credential {Id} removed by its owner.", id);
            return Ok(new { IsSuccess = true, Message = "Passkey removed" });
        }

        // =====================================================================
        // Helpers
        // =====================================================================

        private static string RegKey(string ceremonyId)
        {
            return "webauthn:reg:" + ceremonyId;
        }

        private static string LoginKey(string ceremonyId)
        {
            return "webauthn:login:" + ceremonyId;
        }

        private static string NewCeremonyId()
        {
            return Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        }

        /// <summary>
        /// Reads the ceremony id from the request and takes its stored options
        /// out of the cache. Single-use by design: removing the entry is what
        /// stops one challenge being replayed, so this always removes, including
        /// on the paths that go on to fail.
        /// </summary>
        private bool TryTakeCeremony(JsonElement body, Func<string, string> keyFor, out string optionsJson, out string error)
        {
            optionsJson = null;
            error = null;

            var ceremonyId = ReadString(body, "ceremonyId");
            if (string.IsNullOrWhiteSpace(ceremonyId))
            {
                error = "Missing ceremonyId.";
                return false;
            }

            var key = keyFor(ceremonyId);
            string json;
            if (!_cache.TryGetValue(key, out json) || string.IsNullOrEmpty(json))
            {
                error = "This sign-in attempt expired. Please try again.";
                return false;
            }

            _cache.Remove(key);
            optionsJson = json;
            return true;
        }

        /// <summary>
        /// Writes the options object through verbatim. <c>options</c> is already
        /// spec-shaped JSON from Fido2NetLib; re-serialising it through MVC would
        /// re-case every field - see the class remarks.
        /// </summary>
        private IActionResult CeremonyResponse(string ceremonyId, string optionsJson)
        {
            var payload = new JsonObject
            {
                ["isSuccess"] = true,
                ["ceremonyId"] = ceremonyId,
                ["options"] = JsonNode.Parse(optionsJson)
            };

            return Content(payload.ToJsonString(), "application/json");
        }

        private static string ReadString(JsonElement body, string name)
        {
            if (body.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            JsonElement value;
            if (!body.TryGetProperty(name, out value))
            {
                return null;
            }

            return value.ValueKind == JsonValueKind.String ? value.GetString() : null;
        }

        private static object Describe(UserCredential c)
        {
            return new
            {
                Id = c.Id,
                DeviceName = c.DeviceName,
                IsBackedUp = c.IsBackedUp,
                Transports = c.Transports,
                CreatedAt = c.CreatedAt,
                LastUsedAt = c.LastUsedAt
            };
        }

        /// <summary>
        /// Runs an action and turns anything unexpected into a plain JSON 500.
        ///
        /// Matches what <c>AuthController</c> does on every one of its actions,
        /// and exists for the same reason: the frontend parses every response on
        /// this route as JSON, so an unhandled exception - a dropped database
        /// connection, a missing table - would otherwise reach it as an HTML
        /// error page or an empty body and surface as "could not reach the
        /// sign-in service", which points at the wrong thing entirely.
        ///
        /// The message deliberately says nothing about what failed. The detail
        /// goes to the log, where it belongs, not to an anonymous caller on a
        /// sign-in endpoint.
        /// </summary>
        private async Task<IActionResult> Guarded(Func<Task<IActionResult>> action, string what)
        {
            try
            {
                return await action();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled error during {What}.", what);
                return StatusCode(500, new { IsSuccess = false, Message = "An unexpected error occurred." });
            }
        }

        private static object Fail(string message)
        {
            return new { IsSuccess = false, Message = message };
        }
    }
}
