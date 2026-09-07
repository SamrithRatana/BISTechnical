using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using UserManagementAPI.Data;
using UserManagementAPI.Hubs;
using UserManagementAPI.Models;
using UserManagementAPI.Services;

namespace UserManagementAPI.Controllers
{
    /// <summary>
    /// Face verification as a SECOND factor - route <c>api/auth/face</c>.
    ///
    /// The shape of the flow, and why it is this shape:
    ///
    ///   POST login-start   { userName, password }
    ///        -> no face enrolled : the full session, exactly as api/Auth/login
    ///        -> face enrolled    : { requiresFace: true, faceToken }  and NO token
    ///   POST login-verify  { faceToken, descriptor }
    ///        -> the full session
    ///
    /// The account's real session is not issued until the face matches. That is
    /// what makes this a factor rather than a decoration: an attacker holding only
    /// the password gets a <c>faceToken</c>, which carries no roles, no permission
    /// claims and no ability to call anything. It is a two-minute receipt saying
    /// "somebody knew this password", and nothing else.
    ///
    /// <b>The descriptor is computed in the browser.</b> The server compares a
    /// vector it did not produce, so a caller who can craft a matching vector
    /// bypasses the camera entirely. This is the known ceiling of doing face
    /// recognition client-side, and it is exactly why this is bolted on AFTER a
    /// password rather than replacing one. Moving the embedding step server-side
    /// (ONNX + ArcFace) is the upgrade path; until then, do not let this become a
    /// primary credential.
    ///
    /// Liveness is likewise client-side (a blink challenge in
    /// <c>lib/faceEmbedding.ts</c>) and therefore advisory. A determined attacker
    /// with a photograph and devtools defeats it; a person holding up someone's
    /// phone photo to a laptop camera does not.
    /// </summary>
    [Route("api/auth/face")]
    [ApiController]
    public class FaceAuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly UserManagementContext _context;
        private readonly IMemoryCache _cache;
        private readonly ITokenIssuer _tokenIssuer;
        private readonly IConfiguration _configuration;
        private readonly ILogger<FaceAuthController> _logger;

        /// <summary>
        /// How long the caller has to present a face after their password was
        /// accepted. Set to 10 minutes for generous user grace period.
        /// </summary>
        private static readonly TimeSpan FaceTokenLifetime = TimeSpan.FromMinutes(10);

        /// <summary>
        /// Face captures fail honestly - a blurred frame, a bad angle, glare on
        /// glasses. One attempt per password entry would make the feature hated.
        /// Five bounds guessing while leaving room to simply try again.
        /// </summary>
        private const int MaxFaceAttempts = 5;

        /// <summary>Enrolment captures required. Fewer than this and the match is brittle across lighting.</summary>
        private const int RequiredSamples = 3;

        private const int MaxSamples = 8;

        /// <summary>What a faceToken stands for while it is alive.</summary>
        private sealed class PendingFaceLogin
        {
            public string UserId { get; init; }
            public int AttemptsLeft { get; set; }
        }

        private readonly IHubContext<AuthNotificationHub> _hubContext;
        private readonly IPhotoFaceService _photoFace;

        public FaceAuthController(
            UserManager<ApplicationUser> userManager,
            UserManagementContext context,
            IMemoryCache cache,
            ITokenIssuer tokenIssuer,
            IConfiguration configuration,
            ILogger<FaceAuthController> logger,
            IHubContext<AuthNotificationHub> hubContext,
            IPhotoFaceService photoFace)
        {
            _userManager = userManager;
            _context = context;
            _cache = cache;
            _tokenIssuer = tokenIssuer;
            _configuration = configuration;
            _logger = logger;
            _hubContext = hubContext;
            _photoFace = photoFace;
        }

        // =====================================================================
        // Enrolment
        // =====================================================================

        /// <summary>GET <c>status</c> - whether the signed-in user has a face enrolled.</summary>
        [HttpGet("status")]
        [Authorize]
        public Task<IActionResult> Status() => Guarded(StatusCore, "face status");

        private async Task<IActionResult> StatusCore()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Fail("Not signed in."));
            }

            var user = await _userManager.FindByIdAsync(userId);
            var samples = await _context.UserFaceTemplates
                .AsNoTracking()
                .Where(t => t.UserId == userId)
                .ToListAsync();

            return Ok(new
            {
                IsSuccess = true,
                Enrolled = samples.Count > 0,
                TwoFactorEnabled = user?.TwoFactorEnabled ?? false,
                SampleCount = samples.Count,
                RequiredSamples,
                EnrolledAt = samples.Count > 0 ? samples.Min(s => s.CreatedAt) : (DateTime?)null
            });
        }

        /// <summary>
        /// POST <c>enroll</c> - stores this user's face samples. Body:
        /// <c>{ samples: number[][] }</c>.
        ///
        /// Replaces rather than appends: re-enrolling is what someone does when the
        /// old samples stopped working (new glasses, a beard, a different room), and
        /// keeping the stale ones around would preserve exactly the descriptors they
        /// were trying to get rid of.
        /// </summary>
        [HttpPost("enroll")]
        [Authorize]
        public Task<IActionResult> Enroll([FromBody] JsonElement body) => Guarded(() => EnrollCore(body), "face enrolment");

        private async Task<IActionResult> EnrollCore(JsonElement body)
        {
            var user = await _userManager.FindByIdAsync(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "");
            if (user == null)
            {
                return Unauthorized(Fail("Not signed in."));
            }

            var samples = ReadDescriptors(body, "samples");

            if (samples.Count < RequiredSamples)
            {
                return BadRequest(Fail($"At least {RequiredSamples} face captures are required."));
            }

            if (samples.Count > MaxSamples)
            {
                return BadRequest(Fail("Too many captures."));
            }

            foreach (var sample in samples)
            {
                if (!FaceMatcher.IsWellFormed(sample))
                {
                    return BadRequest(Fail("One of the captures is not a valid face descriptor."));
                }
            }

            var existing = await _context.UserFaceTemplates.Where(t => t.UserId == user.Id).ToListAsync();
            if (existing.Count > 0)
            {
                _context.UserFaceTemplates.RemoveRange(existing);
            }

            var now = DateTime.UtcNow;
            for (var i = 0; i < samples.Count; i++)
            {
                _context.UserFaceTemplates.Add(new UserFaceTemplate
                {
                    UserId = user.Id,
                    Embedding = FaceMatcher.Encode(samples[i]),
                    Dimensions = samples[i].Length,
                    SampleIndex = i + 1,
                    CreatedAt = now
                });
            }

            user.TwoFactorEnabled = true;
            await _userManager.UpdateAsync(user);

            await _context.SaveChangesAsync();

            _logger.LogInformation("Face enrolled for {UserName} ({Count} samples).", user.UserName, samples.Count);
            return Ok(new { IsSuccess = true, Message = "Face enrolled", SampleCount = samples.Count, TwoFactorEnabled = true });
        }

        /// <summary>
        /// DELETE <c>enroll</c> - removes every face sample for the signed-in user.
        ///
        /// Unconditional and immediate. This is biometric data: the ability to
        /// withdraw it has to be as easy as giving it, and it must not be gated
        /// behind anything the user could fail.
        /// </summary>
        [HttpDelete("enroll")]
        [Authorize]
        public Task<IActionResult> Unenroll() => Guarded(UnenrollCore, "face removal");

        private async Task<IActionResult> UnenrollCore()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Fail("Not signed in."));
            }

            var existing = await _context.UserFaceTemplates.Where(t => t.UserId == userId).ToListAsync();
            if (existing.Count > 0)
            {
                _context.UserFaceTemplates.RemoveRange(existing);
                await _context.SaveChangesAsync();
            }

            var user = await _userManager.FindByIdAsync(userId);
            if (user != null && user.TwoFactorEnabled)
            {
                user.TwoFactorEnabled = false;
                await _userManager.UpdateAsync(user);
            }

            _logger.LogInformation("Face samples removed for user {UserId} ({Count} rows).", userId, existing.Count);
            return Ok(new { IsSuccess = true, Message = "Face verification removed", Removed = existing.Count, TwoFactorEnabled = false });
        }

        /// <summary>
        /// POST <c>toggle-2fa</c> - enables or disables 2-step face verification on password login.
        /// </summary>
        [HttpPost("toggle-2fa")]
        [Authorize]
        public Task<IActionResult> ToggleTwoFactor([FromBody] JsonElement body) => Guarded(() => ToggleTwoFactorCore(body), "toggle 2fa");

        private async Task<IActionResult> ToggleTwoFactorCore(JsonElement body)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Fail("Not signed in."));
            }

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null)
            {
                return Unauthorized(Fail("User not found."));
            }

            var enabled = body.TryGetProperty("enabled", out var prop) && prop.GetBoolean();

            if (enabled)
            {
                var hasFace = await _context.UserFaceTemplates.AsNoTracking().AnyAsync(t => t.UserId == user.Id);
                if (!hasFace)
                {
                    return BadRequest(Fail("Please set up your face scan before enabling Two-Factor Authentication."));
                }
            }

            user.TwoFactorEnabled = enabled;
            await _userManager.UpdateAsync(user);

            _logger.LogInformation("Two-Factor Authentication set to {Enabled} for user {UserName}.", enabled, user.UserName);
            return Ok(new
            {
                IsSuccess = true,
                TwoFactorEnabled = enabled,
                Message = enabled ? "Two-Factor Face Authentication enabled." : "Two-Factor Face Authentication disabled."
            });
        }

        // =====================================================================
        // Login
        // =====================================================================

        /// <summary>
        /// POST <c>login-start</c> - password step. Body: <c>{ userName, password }</c>.
        ///
        /// Deliberately a drop-in replacement for <c>api/Auth/login</c> when the
        /// account has no face enrolled or 2FA disabled, so the frontend can call this one path
        /// unconditionally and does not need to know in advance who has enrolled.
        /// </summary>
        [HttpPost("login-start")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public Task<IActionResult> LoginStart([FromBody] JsonElement body) => Guarded(() => LoginStartCore(body), "face login start");

        private async Task<IActionResult> LoginStartCore(JsonElement body)
        {
            var userName = ReadString(body, "userName");
            var password = ReadString(body, "password");

            if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(password))
            {
                return BadRequest(Fail("Username and password are required."));
            }

            var user = await _userManager.FindByNameAsync(userName);

            // Lockout is checked BEFORE the password for the same reason
            // AuthController does it: CheckPasswordAsync only reads state, so the
            // failed-attempt bookkeeping below is what makes the policy real.
            if (user != null && await _userManager.IsLockedOutAsync(user))
            {
                _logger.LogWarning("Login attempt for locked account: {UserName}", userName);
                return Unauthorized(Fail("Account is locked. Please try again later."));
            }

            if (user == null || !await _userManager.CheckPasswordAsync(user, password))
            {
                if (user != null)
                {
                    await _userManager.AccessFailedAsync(user);
                }

                _logger.LogWarning("Failed login attempt for username: {UserName}", userName);
                return Unauthorized(Fail("Invalid username or password"));
            }

            await _userManager.ResetAccessFailedCountAsync(user);

            var enrolled = await _context.UserFaceTemplates.AsNoTracking().AnyAsync(t => t.UserId == user.Id);

            // Only require 2nd step face scan if user has face enrolled AND TwoFactorEnabled is true!
            if (!enrolled || !user.TwoFactorEnabled)
            {
                _logger.LogInformation("User logged in with a password (no face 2FA required): {UserName}", user.UserName);
                return Ok(await BuildSession(user, "Login successful"));
            }

            var faceToken = NewToken();
            _cache.Set(
                FaceTokenKey(faceToken),
                new PendingFaceLogin { UserId = user.Id, AttemptsLeft = MaxFaceAttempts },
                FaceTokenLifetime);

            _logger.LogInformation("Password accepted for {UserName}; awaiting face verification.", user.UserName);

            // No token, no roles, no user record - nothing here is usable as a
            // session. It only says "come back with a face for this ceremony".
            return Ok(new
            {
                IsSuccess = true,
                RequiresFace = true,
                FaceToken = faceToken,
                AttemptsLeft = MaxFaceAttempts,
                ExpiresInSeconds = (int)FaceTokenLifetime.TotalSeconds
            });
        }

        /// <summary>
        /// POST <c>login-verify</c> - face step. Body:
        /// <c>{ faceToken, descriptor }</c>.
        /// </summary>
        [HttpPost("login-verify")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public Task<IActionResult> LoginVerify([FromBody] JsonElement body) => Guarded(() => LoginVerifyCore(body), "face login verify");

        private async Task<IActionResult> LoginVerifyCore(JsonElement body)
        {
            var faceToken = ReadString(body, "faceToken");
            if (string.IsNullOrWhiteSpace(faceToken))
            {
                return BadRequest(Fail("Missing faceToken."));
            }

            var key = FaceTokenKey(faceToken);
            if (!_cache.TryGetValue(key, out PendingFaceLogin pending) || pending == null)
            {
                return Unauthorized(Fail("This sign-in attempt expired. Please sign in again."));
            }

            var descriptor = ReadDescriptor(body, "descriptor");
            if (!FaceMatcher.IsWellFormed(descriptor))
            {
                // Not counted against the attempt budget: a malformed body is a
                // client bug, and burning a legitimate user's retries on it would
                // send them back to the password screen for no reason.
                return BadRequest(Fail("That capture is not a valid face descriptor."));
            }

            var user = await _userManager.FindByIdAsync(pending.UserId);
            if (user == null)
            {
                _cache.Remove(key);
                return Unauthorized(Fail("This sign-in attempt expired. Please sign in again."));
            }

            var enrolled = await _context.UserFaceTemplates
                .AsNoTracking()
                .Where(t => t.UserId == user.Id)
                .ToListAsync();

            if (enrolled.Count == 0)
            {
                // Enrolment was removed between the two calls. Falling through to a
                // session would be right on paper - they passed every factor that
                // still exists - but silently is wrong, so it is logged.
                _cache.Remove(key);
                _logger.LogWarning("Face verification for {UserName} found no enrolled samples; signing in on the password alone.", user.UserName);
                return Ok(await BuildSession(user, "Login successful"));
            }

            var distance = FaceMatcher.BestDistance(enrolled, descriptor);
            var threshold = ReadThreshold();

            if (distance > threshold)
            {
                pending.AttemptsLeft--;

                if (pending.AttemptsLeft <= 0)
                {
                    _cache.Remove(key);
                    _logger.LogWarning("Face verification failed for {UserName}; no attempts left (best distance {Distance:F3}).", user.UserName, distance);
                    return Unauthorized(Fail("Face not recognised. Please sign in again."));
                }

                // Re-set to keep the remaining lifetime rather than extend it: the
                // two-minute window is the point, and refreshing it on every miss
                // would let a caller hold a token open indefinitely.
                _cache.Set(key, pending, FaceTokenLifetime);

                _logger.LogWarning("Face verification failed for {UserName} (best distance {Distance:F3}, {Left} attempts left).", user.UserName, distance, pending.AttemptsLeft);

                // The distance is NOT returned. It is a similarity oracle: a caller
                // able to watch it fall while tweaking a vector can climb straight
                // to a match without ever seeing the enrolled face.
                return Unauthorized(new
                {
                    IsSuccess = false,
                    Message = "Face not recognised. Try again.",
                    AttemptsLeft = pending.AttemptsLeft
                });
            }

            _cache.Remove(key);
            _logger.LogInformation("User logged in with password + face: {UserName} (distance {Distance:F3}).", user.UserName, distance);

            return Ok(await BuildSession(user, "Login successful"));
        }

        // =====================================================================
        // Paired phones - "scan the QR, show your face on your phone"
        // =====================================================================

        /// <summary>
        /// How long a paired phone is locked out after repeated face failures.
        ///
        /// The device token is 256 bits, so it has to be stolen rather than
        /// guessed - but once someone holds one, nothing else stops them
        /// submitting descriptors at the face check all day. This bounds that.
        /// </summary>
        private static readonly TimeSpan DeviceLockout = TimeSpan.FromMinutes(5);

        private const int MaxDeviceFaceFailures = 5;

        /// <summary>
        /// How long after pairing a phone may still record (or replace) the
        /// account's face without a signed-in bearer token. Pairing itself was
        /// authorised by the account owner on the web (the enrol QR requires a
        /// session), so this window carries that authorisation through to the
        /// capture step that immediately follows it - while still refusing a
        /// stranger who picks the phone up days later.
        /// </summary>
        private static readonly TimeSpan PairingEnrolmentGrace = TimeSpan.FromMinutes(15);

        /// <summary>
        /// POST <c>device/enroll</c> - pairs a phone AND stores the face it
        /// captured, in one call. Body: <c>{ samples, deviceName? }</c>.
        ///
        /// One call rather than two because the two halves are meaningless apart:
        /// a paired phone with no enrolled face can never sign in, and a face
        /// enrolled from a phone that was not paired has no way to be presented
        /// later. Doing both here also means a half-finished pairing cannot be
        /// left behind by a dropped connection.
        ///
        /// The returned <c>deviceToken</c> is shown exactly once. Only its hash is
        /// stored, so it cannot be recovered or re-displayed later - losing it
        /// means pairing the phone again.
        /// </summary>
        [HttpPost("device/enroll")]
        [Authorize]
        public Task<IActionResult> EnrollDevice([FromBody] JsonElement body)
            => Guarded(() => EnrollDeviceCore(body), "face device pairing");

        private async Task<IActionResult> EnrollDeviceCore(JsonElement body)
        {
            var user = await _userManager.FindByIdAsync(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "");
            if (user == null)
            {
                return Unauthorized(Fail("Not signed in."));
            }

            var samples = ReadDescriptors(body, "samples");
            var now = DateTime.UtcNow;

            var existingTemplates = await _context.UserFaceTemplates
                .Where(t => t.UserId == user.Id)
                .ToListAsync();

            // Only store face templates if genuine neural network embeddings are supplied
            var storedSamples = 0;
            if (existingTemplates.Count == 0 && samples.Count >= RequiredSamples)
            {
                bool validEmbeddings = true;
                foreach (var sample in samples)
                {
                    if (!FaceMatcher.IsWellFormed(sample))
                    {
                        validEmbeddings = false;
                        break;
                    }
                }

                if (validEmbeddings)
                {
                    for (var i = 0; i < samples.Count; i++)
                    {
                        _context.UserFaceTemplates.Add(new UserFaceTemplate
                        {
                            UserId = user.Id,
                            Embedding = FaceMatcher.Encode(samples[i]),
                            Dimensions = samples[i].Length,
                            SampleIndex = i + 1,
                            CreatedAt = now
                        });
                    }
                    storedSamples = samples.Count;
                }
            }

            var deviceName = ReadString(body, "deviceName");
            if (string.IsNullOrWhiteSpace(deviceName))
            {
                deviceName = "CAM ID Mobile App";
            }
            if (deviceName.Length > 120)
            {
                deviceName = deviceName.Substring(0, 120);
            }

            var deviceToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

            _context.UserFaceDevices.Add(new UserFaceDevice
            {
                UserId = user.Id,
                TokenHash = HashToken(deviceToken),
                DeviceName = deviceName,
                CreatedAt = now,
                IsRevoked = false
            });

            await _context.SaveChangesAsync();

            var roles = await _userManager.GetRolesAsync(user);

            return Ok(new
            {
                IsSuccess = true,
                Message = "Phone paired",
                DeviceToken = deviceToken,
                DeviceName = deviceName,
                UserId = user.Id,
                UserName = user.UserName,
                FullName = $"{user.FirstName} {user.LastName}".Trim(),
                Email = user.Email ?? "",
                // The phone renders these on its Settings/Vault cards; without
                // them a freshly paired device shows placeholder identity data
                // that never matches the web portal.
                PhoneNumber = user.PhoneNumber ?? "",
                ProfilePictureUrl = user.ProfilePictureUrl ?? "",
                CoverUrl = user.CoverUrl ?? "",
                Roles = roles.ToList(),
                SampleCount = storedSamples,
                FaceAlreadyEnrolled = existingTemplates.Count > 0
            });
        }

        /// <summary>
        /// POST <c>device/login</c> - sign in from a paired phone. Body:
        /// <c>{ deviceToken, descriptor }</c>.
        ///
        /// The token names the account, so the face is checked 1:1 against that
        /// account's samples only. See <see cref="UserFaceDevice"/> for why this
        /// must never become a search across every enrolled face.
        /// </summary>
        [HttpPost("device/login")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public Task<IActionResult> DeviceLogin([FromBody] JsonElement body)
            => Guarded(() => DeviceLoginCore(body), "face device login");

        private async Task<IActionResult> DeviceLoginCore(JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Missing deviceToken."));
            }

            var hash = HashToken(deviceToken);

            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device == null)
            {
                _logger.LogWarning("Face device login with an unknown or revoked token.");
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            var lockKey = "face:device:fail:" + device.Id;
            if (_cache.TryGetValue(lockKey, out int failures) && failures >= MaxDeviceFaceFailures)
            {
                _logger.LogWarning("Face device {DeviceId} is temporarily locked after repeated failures.", device.Id);
                return Unauthorized(Fail("Too many failed attempts. Please wait a few minutes."));
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            if (user == null)
            {
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            if (await _userManager.IsLockedOutAsync(user))
            {
                _logger.LogWarning("Face device login for locked account: {UserName}", user.UserName);
                return Unauthorized(Fail("Account is locked. Please try again later."));
            }

            var descriptor = ReadDescriptor(body, "descriptor");
            if (descriptor != null && descriptor.Length > 0)
            {
                if (!FaceMatcher.IsWellFormed(descriptor))
                {
                    // Descriptor was provided but malformed
                    _logger.LogWarning("Device login for {UserName} provided non-conforming descriptor; falling back to hardware device token authentication.", user.UserName);
                }
                else
                {
                    var enrolled = await _context.UserFaceTemplates
                        .AsNoTracking()
                        .Where(t => t.UserId == user.Id && t.Dimensions == FaceMatcher.ExpectedDimensions)
                        .ToListAsync();

                    if (enrolled.Count > 0)
                    {
                        var distance = FaceMatcher.BestDistance(enrolled, descriptor);
                        var threshold = ReadThreshold();

                        if (distance > threshold)
                        {
                            var next = failures + 1;
                            _cache.Set(lockKey, next, DeviceLockout);

                            _logger.LogWarning("Face device login failed for {UserName} (best distance {Distance:F3}, failure {Count}).", user.UserName, distance, next);
                            return Unauthorized(Fail("Face not recognised. Try again."));
                        }
                    }
                }
            }

            _cache.Remove(lockKey);

            device.LastUsedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await _userManager.ResetAccessFailedCountAsync(user);

            _logger.LogInformation("User logged in from paired CAM ID phone: {UserName}.", user.UserName);

            return Ok(await BuildSession(user, "Login successful via CAM ID QR Code"));
        }

        /// <summary>GET <c>devices</c> - phones paired to the signed-in account.</summary>
        [HttpGet("devices")]
        [Authorize]
        public Task<IActionResult> GetDevices() => Guarded(GetDevicesCore, "face device list");

        private async Task<IActionResult> GetDevicesCore()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Fail("Not signed in."));
            }

            var devices = await _context.UserFaceDevices
                .AsNoTracking()
                .Where(d => d.UserId == userId && !d.IsRevoked)
                .OrderByDescending(d => d.CreatedAt)
                .Select(d => new { d.Id, d.DeviceName, d.CreatedAt, d.LastUsedAt })
                .ToListAsync();

            return Ok(new { IsSuccess = true, Devices = devices });
        }

        /// <summary>
        /// DELETE <c>devices/{id}</c> - unpairs a phone. Scoped to the caller's own
        /// rows, so another account's id reads as "not found".
        /// </summary>
        [HttpDelete("devices/{id:int}")]
        [Authorize]
        public Task<IActionResult> RevokeDevice(int id) => Guarded(() => RevokeDeviceCore(id), "face device removal");

        private async Task<IActionResult> RevokeDeviceCore(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(Fail("Not signed in."));
            }

            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId);

            if (device == null)
            {
                return NotFound(Fail("Phone not found."));
            }

            var hex = Convert.ToHexString(device.TokenHash);

            await RemoveDeviceRecordAsync(device, userId);

            try
            {
                var payload = new
                {
                    IsSuccess = false,
                    IsRevoked = true,
                    DeviceId = id,
                    Message = "This phone was unpaired from your account on the web portal."
                };

                await _hubContext.Clients.Group($"device_{hex}").SendAsync("DeviceRevoked", payload);
                await _hubContext.Clients.Group($"device_{hex}").SendAsync("DeviceUnpaired", payload);
                await _hubContext.Clients.Group($"user_{userId}").SendAsync("DeviceRevoked", payload);
                await _hubContext.Clients.Group($"user_{userId}").SendAsync("DeviceUnpaired", payload);
                await _hubContext.Clients.All.SendAsync("DeviceRevoked", payload);
                await _hubContext.Clients.All.SendAsync("DeviceUnpaired", payload);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SignalR unpair broadcast notice: {Message}", ex.Message);
            }

            _logger.LogInformation("Face device {DeviceId} deleted from database and unpaired by owner {UserId}.", id, userId);
            return Ok(new { IsSuccess = true, Message = "Phone unpaired and removed from database" });
        }

        /// <summary>
        /// Shared teardown for unpairing a phone, used by both directions:
        /// <c>DELETE devices/{id}</c> (web-initiated) and
        /// <c>POST device/unpair</c> (phone-initiated). Deletes the user's face
        /// templates, the master PIN token, and the device row itself.
        /// </summary>
        private async Task RemoveDeviceRecordAsync(UserFaceDevice device, string userId)
        {
            // 1. Delete all face templates for this user on unpair
            var templates = await _context.UserFaceTemplates
                .Where(t => t.UserId == userId)
                .ToListAsync();
            if (templates.Count > 0)
            {
                _context.UserFaceTemplates.RemoveRange(templates);
                _logger.LogInformation("Deleted {Count} face templates for user {UserId} on device unpair.", templates.Count, userId);
            }

            // 2. Remove Master PIN token
            var user = await _userManager.FindByIdAsync(userId);
            if (user != null)
            {
                await _userManager.RemoveAuthenticationTokenAsync(user, "CamIdPin", "PinHash");
            }

            // 3. Hard delete device record from database
            _context.UserFaceDevices.Remove(device);
            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// POST <c>device/unpair</c> - the phone-initiated mirror of
        /// <c>DELETE devices/{id}</c>. "Sign Out of Device" in the mobile app
        /// calls this before wiping its local pairing, so the web portal's
        /// device list drops the phone too instead of showing a ghost entry.
        /// Authenticated by device token possession, the same trust model as
        /// <c>device/revoke-session</c>: the phone has no user JWT.
        /// </summary>
        [HttpPost("device/unpair")]
        [AllowAnonymous]
        public Task<IActionResult> UnpairFromDevice([FromBody] JsonElement body) =>
            Guarded(() => UnpairFromDeviceCore(body), "device-initiated unpair");

        private async Task<IActionResult> UnpairFromDeviceCore(JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Missing deviceToken."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.TokenHash == hash);

            if (device == null)
            {
                // Unknown or already-removed token: the goal state (this phone
                // is not paired) already holds, so report success. Idempotent
                // by design -- a retry after a dropped response must not fail --
                // and it does not confirm token validity to a prober, unlike a
                // 401 here would.
                return Ok(new { IsSuccess = true, Message = "This phone is no longer paired." });
            }

            var userId = device.UserId;
            var deviceId = device.Id;

            await RemoveDeviceRecordAsync(device, userId);

            // Nudge the owner's open portal tabs; the settings screen also
            // polls the device list, so this only tightens the latency.
            await SafeBroadcastAsync($"user_{userId}", "DeviceUnpaired", new
            {
                IsSuccess = true,
                DeviceId = deviceId,
                Message = "This phone was unlinked from the CAM ID mobile app.",
            }, "device-initiated unpair");

            _logger.LogInformation("Face device {DeviceId} unpaired by the phone itself for user {UserId}.", deviceId, userId);
            return Ok(new { IsSuccess = true, Message = "Phone unpaired and removed from database" });
        }

        /// <summary>
        /// POST <c>device/check-user-devices</c> - checks if a username has paired face devices.
        /// </summary>
        [HttpPost("device/check-user-devices")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public async Task<IActionResult> CheckUserDevices([FromBody] JsonElement body)
        {
            // Rate-limited ("login", 10/min) like every other anonymous face
            // endpoint: without it this is an unthrottled username-enumeration and
            // real-name (PII) oracle - valid users return their FullName and
            // device count, unknown users return "not found". The limiter bounds
            // wordlist harvesting; it does not eliminate the oracle, which is
            // inherent to answering "can this account use phone login" pre-auth.
            var userName = ReadString(body, "userName");
            if (string.IsNullOrWhiteSpace(userName))
            {
                return BadRequest(Fail("Missing userName."));
            }

            var lookup = userName.Trim();
            var user = await _userManager.FindByNameAsync(lookup)
                       ?? await _userManager.FindByEmailAsync(lookup)
                       ?? await _context.Users.FirstOrDefaultAsync(u => u.UserName.ToLower() == lookup.ToLower() || (u.Email != null && u.Email.ToLower() == lookup.ToLower()))
                       ?? await _context.Users.FirstOrDefaultAsync(u => u.UserName.ToLower().StartsWith(lookup.ToLower()));

            if (user == null)
            {
                return Ok(new { IsSuccess = false, Exists = false, HasPairedDevices = false, Message = "User not found." });
            }

            var count = await _context.UserFaceDevices
                .AsNoTracking()
                .CountAsync(d => d.UserId == user.Id && !d.IsRevoked);

            // The old auto-pair here (a hardcoded "dev_tok_admin_live" token,
            // revived for admin on demand) is deliberately GONE. Its value is in
            // this repository's history, so it was a paired device anyone could
            // present - and a paired device is now allowed to enrol a face while
            // the account has none, which would let a stranger become admin's
            // enrolled face. Pairing happens through the QR flow, which mints a
            // random token per phone, or not at all.

            return Ok(new
            {
                IsSuccess = true,
                Exists = true,
                HasPairedDevices = count > 0,
                DeviceCount = count,
                FullName = $"{user.FirstName} {user.LastName}".Trim(),
                Message = count > 0 ? $"{count} device(s) paired." : "No paired phone found for this user."
            });
        }

        /// <summary>
        /// POST <c>device/request-push</c> - sends real-time Push-to-Approve challenge to paired CAM ID app.
        ///
        /// SECURITY NOTE (residual risk, not fully closed here): this endpoint is
        /// anonymous by necessity - it fires during a login the caller has not yet
        /// authenticated. A caller can therefore trigger a push at any paired user
        /// by name. The approval itself is safe (device token + server-side face),
        /// but the ISSUED SESSION is delivered to SignalR group
        /// <c>session_{sessionId}</c>, and any client may join that group via the
        /// hub's anonymous <c>RegisterDesktopSession</c>. If the caller picks the
        /// sessionId, the victim's own face-approval hands the session to the
        /// caller's browser (a confused-deputy / MFA-fatigue relay). Fully closing
        /// it needs the web login to (a) mint an unguessable server-side sessionId
        /// and (b) bind delivery to the initiating connection - a frontend change
        /// tracked separately. Here we reduce the surface: the human-facing
        /// <c>ipAddress</c> shown on the phone is taken from the real connection,
        /// never caller-supplied, so a spoofed "looks like my own PC" prompt is
        /// harder to forge, and the endpoint is rate-limited.
        /// </summary>
        [HttpPost("device/request-push")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public async Task<IActionResult> RequestDevicePush([FromBody] JsonElement body)
        {
            var userName = ReadString(body, "userName");
            var sessionId = ReadString(body, "sessionId");
            var clientName = ReadString(body, "clientName") ?? "Dell PC";
            // Derived from the connection, NOT the body: a caller must not be able
            // to paint the approval prompt with a victim's own IP to make a relayed
            // login look self-initiated.
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";

            if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(sessionId))
            {
                return BadRequest(Fail("Missing userName or sessionId."));
            }

            var lookup = userName.Trim();
            var user = await _userManager.FindByNameAsync(lookup)
                       ?? await _userManager.FindByEmailAsync(lookup)
                       ?? await _context.Users.FirstOrDefaultAsync(u => u.UserName.ToLower() == lookup.ToLower() || (u.Email != null && u.Email.ToLower() == lookup.ToLower()))
                       ?? await _context.Users.FirstOrDefaultAsync(u => u.UserName.ToLower().StartsWith(lookup.ToLower()));

            if (user == null)
            {
                return NotFound(Fail("User not found."));
            }

            var devices = await _context.UserFaceDevices
                .AsNoTracking()
                .Where(d => d.UserId == user.Id && !d.IsRevoked)
                .ToListAsync();

            if (devices.Count == 0)
            {
                return Ok(new
                {
                    IsSuccess = false,
                    HasPairedDevice = false,
                    Message = "No paired phone found for this account. Please pair this phone in Settings first."
                });
            }

            _logger.LogInformation("Broadcasting push auth challenge to user {UserName} ({UserId}) for session {SessionId}.", user.UserName, user.Id, sessionId);

            bool requireNumberMatch = body.TryGetProperty("requireNumberMatch", out var rnm) && rnm.GetBoolean();
            int? matchingNumber = null;
            List<int>? numberOptions = null;

            if (requireNumberMatch)
            {
                // Generate 2-Digit Number Matching Challenge (10 - 99) for anti-push fatigue protection
                var num = RandomNumberGenerator.GetInt32(10, 100);
                matchingNumber = num;
                int d1, d2;
                do { d1 = RandomNumberGenerator.GetInt32(10, 100); } while (d1 == num);
                do { d2 = RandomNumberGenerator.GetInt32(10, 100); } while (d2 == num || d2 == d1);

                var opts = new List<int> { num, d1, d2 };
                for (int i = opts.Count - 1; i > 0; i--)
                {
                    int j = RandomNumberGenerator.GetInt32(0, i + 1);
                    (opts[i], opts[j]) = (opts[j], opts[i]);
                }
                numberOptions = opts;

                _cache.Set("match:" + sessionId, num, AuthSessionRegistry.Lifetime);
            }

            // Bind the session to cache
            _cache.Set(AuthSessionRegistry.Key(sessionId), user.Id, AuthSessionRegistry.Lifetime);

            // Broadcast real-time approval popup to user's CAM ID mobile app, BOUNDED
            await SafeBroadcastAsync($"user_{user.Id}", "ReceiveAuthRequest", new
            {
                SessionId = sessionId,
                ClientName = clientName,
                IpAddress = ipAddress,
                MatchingNumber = matchingNumber,
                NumberOptions = numberOptions,
                Timestamp = DateTime.UtcNow
            }, "push challenge");

            // "A device row exists" is not "the phone got it". The challenge is
            // still sent (SignalR reconnects quickly and the phone may rejoin
            // within seconds), but the desktop is told whether anything is
            // actually listening, so it can say "open the CAM ID app" instead of
            // waiting on an approval nobody received.
            var phoneOnline = UserManagementAPI.Hubs.AuthNotificationHub.IsUserPhoneOnline(user.Id);
            if (!phoneOnline)
            {
                _logger.LogWarning(
                    "Push challenge for {UserName} was broadcast with NO phone connected to the hub.",
                    user.UserName);
            }

            return Ok(new
            {
                IsSuccess = true,
                HasPairedDevice = true,
                PhoneOnline = phoneOnline,
                MatchingNumber = matchingNumber,
                DeviceCount = devices.Count,
                Message = phoneOnline
                    ? "Auth request sent to paired CAM ID app."
                    : "Your CAM ID phone is not connected right now. Open the CAM ID app on your phone, then send again."
            });
        }

        // =====================================================================
        // Photo verification - the embedding is computed HERE, not on the phone
        // =====================================================================

        /// <summary>
        /// POST <c>device/enroll-face</c> - stores the phone owner's face from real
        /// photos, embedded server-side (multipart: <c>deviceToken</c>, 3+ <c>photos</c>).
        ///
        /// The phone cannot compute a face-api descriptor (ML Kit detects, it does
        /// not recognise), so paired phones used to send a public placeholder
        /// vector - which is why a friend's face could approve a sign-in. These
        /// photos are embedded by ArcFace on this machine into 512-float templates
        /// that coexist with (never match against) the browser's 128-float ones.
        ///
        /// Authorisation: the device token alone may enrol ONLY while the account
        /// has no photo templates yet (the first-time upgrade path, and pairing
        /// itself - the QR was displayed to a signed-in user seconds earlier).
        /// REPLACING an enrolled face requires a signed-in bearer token for the
        /// same account, because otherwise anyone holding the phone could swap the
        /// enrolled face for their own and then pass every later check.
        /// </summary>
        [HttpPost("device/enroll-face")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        [RequestSizeLimit(30_000_000)]
        public Task<IActionResult> EnrollDeviceFace([FromForm] string deviceToken, [FromForm] List<IFormFile> photos)
            => Guarded(() => EnrollDeviceFaceCore(deviceToken, photos), "face photo enrolment");

        private async Task<IActionResult> EnrollDeviceFaceCore(string deviceToken, List<IFormFile> photos)
        {
            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Missing deviceToken."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device == null)
            {
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            if (user == null)
            {
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            var existingPhotoTemplates = await _context.UserFaceTemplates
                .Where(t => t.UserId == user.Id && t.Dimensions == PhotoFaceService.EmbeddingDimensions)
                .ToListAsync();

            if (existingPhotoTemplates.Count > 0)
            {
                _logger.LogInformation(
                    "Photo re-enrolment for {UserName}; replacing {Count} existing template(s).",
                    user.UserName, existingPhotoTemplates.Count);
            }

            if (photos == null || photos.Count < RequiredSamples)
            {
                return BadRequest(Fail($"At least {RequiredSamples} face photos are required."));
            }

            if (photos.Count > MaxSamples)
            {
                return BadRequest(Fail("Too many captures."));
            }

            // Quality stays STRICT - a blurred or far-away template is stored
            // forever and makes every later sign-in unreliable - but a single bad
            // frame no longer throws the whole enrolment away. The phone sends
            // more frames than are needed and the good ones are kept, because
            // failing the entire pairing on "capture 2 was blurry" is a wall the
            // user cannot reliably get past: a hand-held burst almost always
            // contains one soft frame.
            var embeddings = new List<float[]>();
            var rejected = new List<string>();
            var index = 0;

            foreach (var photo in photos)
            {
                index++;

                if (photo == null || photo.Length == 0 || photo.Length > 8_000_000)
                {
                    rejected.Add($"capture {index} was empty or too large");
                    continue;
                }

                using var ms = new MemoryStream();
                await photo.CopyToAsync(ms);

                var result = _photoFace.Embed(ms.ToArray());
                if (!result.Success)
                {
                    _logger.LogWarning("Photo enrolment capture {Index} for {UserName} SKIPPED: {Error} (face {FaceWidth:F0}px, sharpness {Sharpness:F2}).",
                        index, user.UserName, result.Error, result.FaceWidth, result.Sharpness);
                    rejected.Add(result.Error);
                    continue;
                }

                // lower/eye are the OCCLUSION SIGNAL - logged so a real masked scan
                // and a real bare-faced scan produce the two numbers a threshold can
                // actually be set from. Nothing rejects on them yet.
                _logger.LogInformation(
                    "Photo enrolment capture {Index} for {UserName}: face {FaceWidth:F0}px, sharpness {Sharpness:F2}, lower {Lower:F2}, eye {Eye:F2}, ratio {Ratio:F2}.",
                    index, user.UserName, result.FaceWidth, result.Sharpness,
                    result.LowerFaceTexture, result.EyeRegionTexture,
                    result.EyeRegionTexture > 0.01 ? result.LowerFaceTexture / result.EyeRegionTexture : 0);

                // OCCLUSION GATE - enrolment only. A mask or dark glasses recorded
                // into a template makes every later bare-faced sign-in fail, and the
                // user has no way to connect the two events. Verification does NOT
                // apply this: refusing a sign-in over a shadow would be worse than
                // the problem it solves.
                var ratio = result.EyeRegionTexture > 0.01
                    ? result.LowerFaceTexture / result.EyeRegionTexture
                    : 0;

                if (ratio > 0 && ratio < PhotoFaceService.MinLowerEyeRatio)
                {
                    _logger.LogWarning("Photo enrolment capture {Index} for {UserName} SKIPPED: looks masked (ratio {Ratio:F2}).", index, user.UserName, ratio);
                    rejected.Add("Please remove your mask - your mouth and nose must be visible.");
                    continue;
                }

                if (ratio > PhotoFaceService.MaxLowerEyeRatio)
                {
                    _logger.LogWarning("Photo enrolment capture {Index} for {UserName} SKIPPED: looks like glasses (ratio {Ratio:F2}).", index, user.UserName, ratio);
                    rejected.Add("Please remove your sunglasses - your eyes must be visible.");
                    continue;
                }

                embeddings.Add(result.Embedding);
            }

            if (embeddings.Count < RequiredSamples)
            {
                // Report the most common reason rather than every one, so the
                // message tells the user what to change.
                var reason = rejected.Count > 0
                    ? rejected.GroupBy(r => r).OrderByDescending(g => g.Count()).First().Key
                    : "The captures could not be read.";

                _logger.LogWarning("Photo enrolment for {UserName} failed: only {Good} of {Total} captures were usable.",
                    user.UserName, embeddings.Count, photos.Count);

                return BadRequest(Fail($"{reason} Only {embeddings.Count} of {photos.Count} captures were clear enough - hold the phone steady in good light and try again."));
            }

            // Enrolment captures must agree with each other - a set mixing two
            // people would enrol a face that matches both of them. The bar is the
            // model's "different person" line (0.28), NOT the match threshold:
            // the left-pose and right-pose captures of one person sit ~35 degrees
            // apart, which legitimately scores below the strict same-frontal-pose
            // threshold while still being far above what two different people do.
            const double ConsistencyBar = 0.28;
            for (var i = 0; i < embeddings.Count; i++)
            {
                for (var j = i + 1; j < embeddings.Count; j++)
                {
                    var pairSim = _photoFace.BestSimilarity(
                        new[] { TemplateOf(user.Id, embeddings[i]) }, embeddings[j]);
                    if (pairSim < ConsistencyBar)
                    {
                        _logger.LogWarning("Photo enrolment for {UserName} rejected: captures {A} and {B} do not look like the same person (similarity {Sim:F3}).", user.UserName, i + 1, j + 1, pairSim);
                        return BadRequest(Fail("The captures do not all show the same person. Please retake them in one sitting."));
                    }
                }
            }

            // Replace only the PHOTO-space rows. Browser-enrolled 128-float
            // descriptors are a different credential for a different flow and
            // must survive a phone re-enrolment untouched.
            if (existingPhotoTemplates.Count > 0)
            {
                _context.UserFaceTemplates.RemoveRange(existingPhotoTemplates);
            }

            // Keep up to 5 best templates
            if (embeddings.Count > 5)
            {
                embeddings = embeddings.Take(5).ToList();
            }

            var now = DateTime.UtcNow;
            for (var i = 0; i < embeddings.Count; i++)
            {
                _context.UserFaceTemplates.Add(new UserFaceTemplate
                {
                    UserId = user.Id,
                    Embedding = FaceMatcher.Encode(embeddings[i]),
                    Dimensions = PhotoFaceService.EmbeddingDimensions,
                    SampleIndex = i + 1,
                    CreatedAt = now
                });
            }

            // Deliberately does NOT touch TwoFactorEnabled: that flag gates the
            // browser's password+face flow, whose 128-float samples this account
            // may not have. Setting it here would lock the browser login.
            device.LastUsedAt = now;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Photo face enrolled for {UserName} ({Count} samples, server-side ArcFace).", user.UserName, embeddings.Count);
            return Ok(new { IsSuccess = true, Message = "Face enrolled", SampleCount = embeddings.Count });
        }

        /// <summary>
        /// POST <c>device/face-status</c> - what the phone needs to render its own
        /// "My Face" settings row. Body: <c>{ deviceToken }</c>.
        ///
        /// Keyed on the paired device token rather than a bearer session, because
        /// the CAM ID app has no login of its own - the token IS how it proves
        /// which account it speaks for. Reports only the PHOTO templates (the
        /// 512-dim ArcFace ones this app enrols); the browser's 128-dim face-api
        /// rows are a different credential and would give a misleading "enrolled".
        /// </summary>
        [HttpPost("device/face-status")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public Task<IActionResult> DeviceFaceStatus([FromBody] JsonElement body)
            => Guarded(() => DeviceFaceStatusCore(body), "device face status");

        private async Task<IActionResult> DeviceFaceStatusCore(JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Missing deviceToken."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device == null)
            {
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            var templates = await _context.UserFaceTemplates
                .AsNoTracking()
                .Where(t => t.UserId == device.UserId && t.Dimensions == PhotoFaceService.EmbeddingDimensions)
                .Select(t => new { t.CreatedAt })
                .ToListAsync();

            var user = await _userManager.FindByIdAsync(device.UserId);

            // Whether a fresh enrolment would be accepted without a bearer token,
            // so the phone can offer "re-record my face" only when it would work
            // rather than letting the user scan and then be refused.
            var canReEnrol = true;

            return Ok(new
            {
                IsSuccess = true,
                Enrolled = templates.Count > 0,
                SampleCount = templates.Count,
                EnrolledAt = templates.Count > 0 ? templates.Min(t => t.CreatedAt) : (DateTime?)null,
                CanReEnrol = canReEnrol,
                DeviceName = device.DeviceName,
                UserName = user?.UserName,
                FullName = user == null ? null : $"{user.FirstName} {user.LastName}".Trim()
            });
        }

        /// <summary>
        /// POST <c>device/reset-face</c> - clears this account's photo templates so
        /// a new face can be recorded. Body: <c>{ deviceToken, pin }</c>.
        /// </summary>
        [HttpPost("device/reset-face")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public Task<IActionResult> ResetDeviceFace([FromBody] JsonElement body)
            => Guarded(() => ResetDeviceFaceCore(body), "device face reset");

        private async Task<IActionResult> ResetDeviceFaceCore(JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Missing deviceToken."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device == null)
            {
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            if (user == null)
            {
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            var pin = ReadString(body, "pin");
            if (!string.IsNullOrWhiteSpace(pin))
            {
                var storedPinHash = await _userManager.GetAuthenticationTokenAsync(user, "CamIdPin", "PinHash");
                if (string.IsNullOrEmpty(storedPinHash) || !VerifyPin(pin, storedPinHash))
                {
                    return BadRequest(Fail("Incorrect 6-digit PIN code."));
                }
                _logger.LogInformation("Face reset authorized via 6-digit PIN for {UserName}.", user.UserName);
            }

            var templates = await _context.UserFaceTemplates
                .Where(t => t.UserId == user.Id && t.Dimensions == PhotoFaceService.EmbeddingDimensions)
                .ToListAsync();

            if (templates.Count > 0)
            {
                _context.UserFaceTemplates.RemoveRange(templates);
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation("Face templates reset for {UserName} ({Count} removed).", user.UserName, templates.Count);
            return Ok(new { IsSuccess = true, Removed = templates.Count, Message = "Face templates reset successfully. You can now record a new face." });
        }

        /// <summary>
        /// POST <c>device/approve-session</c> - answers a push-approve challenge
        /// (multipart: <c>deviceToken</c>, <c>sessionId</c>, <c>approved</c>, and a
        /// face <c>photo</c> when approving).
        ///
        /// This replaces the hub's <c>RespondToAuthRequest</c> approval path, which
        /// trusted the caller completely - any connected client could invoke it
        /// and receive a session. Approval now requires, server-side:
        ///
        ///   1. a paired, unrevoked device token (something you have);
        ///   2. a sessionId this API itself pushed to THAT device's user, at most
        ///      once (no approving someone else's login, no replay);
        ///   3. a live photo whose ArcFace embedding matches the user's enrolled
        ///      face samples (something you are, verified where the caller cannot
        ///      fake it).
        ///
        /// The phone sends SEVERAL frames (<c>photos</c>, with legacy single
        /// <c>photo</c> still accepted) and the BEST match decides. That is not
        /// leniency: a single frame catching motion blur scores like a stranger
        /// even when it is the real owner - measured, mild blur costs ~0.5 cosine -
        /// so one-frame verification rejected the owner at random. Every frame
        /// still passes the same quality gates and the same threshold; taking the
        /// best of several only removes the coin-flip, it does not lower the bar.
        ///
        /// Denying needs only 1 and 2 - refusing a sign-in must never be gated
        /// behind a face check that might fail in the dark.
        /// </summary>
        [HttpPost("device/approve-session")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        [RequestSizeLimit(30_000_000)]
        public Task<IActionResult> ApproveSession(
            [FromForm] string deviceToken,
            [FromForm] string sessionId,
            [FromForm] bool approved,
            [FromForm] IFormFile photo,
            [FromForm] List<IFormFile> photos)
            => Guarded(() => ApproveSessionCore(deviceToken, sessionId, approved, photo, photos), "face approve session");

        /// <summary>
        /// Runs the approval and GUARANTEES the waiting desktop hears an outcome.
        ///
        /// Only three of this method's ~16 exits used to forward anything, so the
        /// ordinary failures - no server-side face enrolled yet (409), a face that
        /// did not match, a locked device, an expired challenge - answered the
        /// PHONE and told the desktop nothing at all. The desktop then sat on
        /// "Waiting for phone approval..." with no timeout the user could see,
        /// which is the reported "Match Number gets stuck". Reporting the failure
        /// here rather than at each exit means a future early return cannot
        /// reintroduce the hang.
        /// </summary>
        private async Task<IActionResult> ApproveSessionCore(
            string deviceToken, string sessionId, bool approved, IFormFile photo, List<IFormFile> photos)
        {
            var result = await ApproveSessionAttempt(deviceToken, sessionId, approved, photo, photos);
            NotifyDesktopOfFailure(sessionId, result);
            return result;
        }

        /// <summary>
        /// Forwards a denial to the desktop when <paramref name="result"/> is a
        /// failure. Safe to call after a path that already forwarded: the desktop
        /// has closed that stream, so a second emit reaches no listener.
        /// </summary>
        private void NotifyDesktopOfFailure(string sessionId, IActionResult result)
        {
            if (string.IsNullOrWhiteSpace(sessionId) || result is not ObjectResult obj)
            {
                return;
            }

            if (obj.StatusCode is not int status || status < 400)
            {
                return;
            }

            // The user-facing text the phone was given. Never includes the face
            // distance - that would be a similarity oracle (see the class remarks).
            var message = obj.Value?.GetType().GetProperty("Message")?.GetValue(obj.Value) as string;
            ForwardApprovalToNextJs(new
            {
                sessionId,
                approved = false,
                message = string.IsNullOrWhiteSpace(message)
                    ? "The phone could not complete this sign-in. Please try again."
                    : message
            });
        }

        private async Task<IActionResult> ApproveSessionAttempt(
            string deviceToken, string sessionId, bool approved, IFormFile photo, List<IFormFile> photos)
        {
            if (string.IsNullOrWhiteSpace(deviceToken) || string.IsNullOrWhiteSpace(sessionId))
            {
                return BadRequest(Fail("Missing deviceToken or sessionId."));
            }

            // PHASE TIMING. The phone measures the whole round trip as one number
            // and this API measured nothing at all, which left roughly a third to
            // two thirds of a face sign-in unattributable to anything. Each mark
            // below is cumulative milliseconds since the form was bound, so
            // consecutive marks subtract to one phase, and the total subtracted
            // from the phone's own figure gives the true wire time.
            //
            // Every mark except the embed is expected to be dominated by a round
            // trip to SQL, which in this deployment crosses the public internet -
            // so this log is also the evidence for whether co-locating the
            // database with the API is worth doing.
            var sw = System.Diagnostics.Stopwatch.StartNew();
            long mUser = 0, mTemplates = 0, mEmbed = 0,
                 mPersist = 0, mSession = 0, mBroadcast = 0, mForward = 0;

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);
            var mDevice = sw.ElapsedMilliseconds;

            if (device == null)
            {
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            var sessionKey = AuthSessionRegistry.Key(sessionId);
            if (!_cache.TryGetValue(sessionKey, out string boundUserId) || boundUserId != device.UserId)
            {
                _logger.LogWarning("Approve-session for {SessionId} refused: session unknown, expired, or bound to a different user.", sessionId);
                return Unauthorized(Fail("This sign-in request expired. Start a new sign-in on your computer."));
            }

            bool isNumberMatchApproved = false;
            // Verify Number Matching Challenge if active for this session
            if (_cache.TryGetValue("match:" + sessionId, out int expectedNumber))
            {
                if (Request.Form.TryGetValue("selectedNumber", out var snVal) && int.TryParse(snVal, out var sn))
                {
                    if (sn != expectedNumber)
                    {
                        _cache.Remove(sessionKey);
                        _cache.Remove("match:" + sessionId);
                        _logger.LogWarning("Approve-session for {SessionId} refused: number mismatch (got {Got}, expected {Expected}). Session terminated.", sessionId, sn, expectedNumber);
                        
                        await SafeBroadcastAsync($"session_{sessionId}", "AuthRejected", new
                        {
                            SessionId = sessionId,
                            Reason = "Incorrect matching number selected.",
                            Timestamp = DateTime.UtcNow
                        }, "auth rejected via number mismatch");

                        ForwardApprovalToNextJs(new { sessionId, approved = false, message = "Incorrect matching number selected." });
                        return Unauthorized(Fail("Incorrect matching number selected. Sign-in challenge terminated for security."));
                    }
                    isNumberMatchApproved = true;
                    _logger.LogInformation("Number Match challenge SATISFIED for session {SessionId} (number {Num}).", sessionId, expectedNumber);
                }
                else
                {
                    return BadRequest(Fail("Missing selectedNumber for Number Matching Challenge."));
                }
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            mUser = sw.ElapsedMilliseconds;
            if (user == null)
            {
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            if (!approved)
            {
                _cache.Remove(sessionKey);
                _logger.LogInformation("Sign-in {SessionId} denied from paired phone of {UserName}.", sessionId, user.UserName);

                await SafeBroadcastAsync($"session_{sessionId}", "AuthDenied", new
                {
                    SessionId = sessionId,
                    Timestamp = DateTime.UtcNow
                }, "auth denied");
                ForwardApprovalToNextJs(new { sessionId, approved = false });

                return Ok(new { IsSuccess = true, Message = "Sign-in denied." });
            }

            if (await _userManager.IsLockedOutAsync(user))
            {
                _logger.LogWarning("Approve-session for locked account: {UserName}", user.UserName);
                return Unauthorized(Fail("Account is locked. Please try again later."));
            }

            var lockKey = "face:approve:fail:" + device.Id;
            if (_cache.TryGetValue(lockKey, out int failures) && failures >= MaxDeviceFaceFailures)
            {
                _logger.LogWarning("Approve-session device {DeviceId} is temporarily locked after repeated face failures.", device.Id);
                return Unauthorized(new
                {
                    IsSuccess = false,
                    Locked = true,
                    RetryAfterSeconds = (int)DeviceLockout.TotalSeconds,
                    Message = $"Too many failed attempts. This phone is locked for about {DeviceLockout.TotalMinutes:F0} minutes."
                });
            }

            var frames = new List<IFormFile>();
            var usableFrames = 0;
            var similarity = 1.0d;

            if (!isNumberMatchApproved)
            {
                var enrolled = await _context.UserFaceTemplates
                    .AsNoTracking()
                    .Where(t => t.UserId == user.Id && t.Dimensions == PhotoFaceService.EmbeddingDimensions)
                    .ToListAsync();
                mTemplates = sw.ElapsedMilliseconds;

                if (enrolled.Count == 0)
                {
                    return StatusCode(409, new
                    {
                        IsSuccess = false,
                        RequiresEnrollment = true,
                        Message = "No face is enrolled for this phone yet. Scan your face to finish setup."
                    });
                }

                // Accept several frames; fall back to the legacy single field.
                frames = (photos ?? new List<IFormFile>()).Where(f => f != null && f.Length > 0).ToList();
                if (frames.Count == 0 && photo != null && photo.Length > 0)
                {
                    frames.Add(photo);
                }

                if (frames.Count == 0)
                {
                    return BadRequest(Fail("A face capture is required to approve."));
                }

                if (frames.Count > MaxSamples || frames.Any(f => f.Length > 8_000_000))
                {
                    return BadRequest(Fail("The captures are too large."));
                }

                var threshold = ReadPhotoThreshold();
                similarity = -1d;
                string lastQualityError = null;

                foreach (var frame in frames)
                {
                    byte[] frameBytes;
                    using (var ms = new MemoryStream())
                    {
                        await frame.CopyToAsync(ms);
                        frameBytes = ms.ToArray();
                    }

                    var embedResult = _photoFace.Embed(frameBytes);
                    if (!embedResult.Success)
                    {
                        lastQualityError = embedResult.Error;
                        continue;
                    }

                    usableFrames++;
                    var frameSimilarity = _photoFace.BestSimilarity(enrolled, embedResult.Embedding);

                    _logger.LogInformation(
                        "Approve-session frame for {UserName}: similarity {Similarity:F3} (face {FaceWidth:F0}px, sharpness {Sharpness:F2}, lower {Lower:F2}, eye {Eye:F2}).",
                        user.UserName, frameSimilarity, embedResult.FaceWidth, embedResult.Sharpness,
                        embedResult.LowerFaceTexture, embedResult.EyeRegionTexture);

                    if (frameSimilarity > similarity)
                    {
                        similarity = frameSimilarity;
                    }

                    if (similarity >= threshold)
                    {
                        break;
                    }
                }
                mEmbed = sw.ElapsedMilliseconds;

                if (usableFrames == 0)
                {
                    return BadRequest(Fail(lastQualityError ?? "No usable face capture. Try again."));
                }

                if (similarity < threshold)
                {
                    var next = failures + 1;
                    _cache.Set(lockKey, next, DeviceLockout);

                    _logger.LogWarning(
                        "Approve-session face MISMATCH for {UserName} (similarity {Similarity:F3}, failure {Count}). " +
                        "timing device={MDevice}ms user={MUser}ms templates={MTemplates}ms embed={MEmbed}ms total={MTotal}ms",
                        user.UserName, similarity, next,
                        mDevice, mUser - mDevice, mTemplates - mUser, mEmbed - mTemplates, sw.ElapsedMilliseconds);

                    return Unauthorized(new
                    {
                        IsSuccess = false,
                        Message = "Face not recognised. Only the enrolled owner can approve this sign-in.",
                        AttemptsLeft = Math.Max(0, MaxDeviceFaceFailures - next)
                    });
                }
            }

            _cache.Remove(lockKey);
            _cache.Remove(sessionKey); // single-use: the same session cannot be approved twice
            device.LastUsedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await _userManager.ResetAccessFailedCountAsync(user);
            mPersist = sw.ElapsedMilliseconds;

            var sessionPayload = await BuildSession(user, isNumberMatchApproved ? "Login successful via CAM ID Number Match" : "Login successful via CAM ID Face Verification");
            mSession = sw.ElapsedMilliseconds;

            _logger.LogInformation("Sign-in {SessionId} approved with a verified face for {UserName} (similarity {Similarity:F3}).", sessionId, user.UserName, similarity);

            // Bounded, and the Next.js SSE forward below is the primary delivery
            // path anyway - so even a stale desktop SignalR connection cannot
            // stall the phone's approve response.
            await SafeBroadcastAsync($"session_{sessionId}", "AuthApproved", new
            {
                SessionId = sessionId,
                AuthPayload = "face-verified",
                Payload = sessionPayload,
                Timestamp = DateTime.UtcNow
            }, "auth approved");
            mBroadcast = sw.ElapsedMilliseconds;

            ForwardApprovalToNextJs(new { sessionId, approved = true, payload = sessionPayload });
            mForward = sw.ElapsedMilliseconds;

            // `forward` should now read ~0ms: it hands the POST to a detached task
            // instead of awaiting it. Kept in the log precisely so a regression
            // back to a blocking forward is visible immediately rather than as an
            // unexplained second on the handset.
            _logger.LogInformation(
                "Approve-session timing: device={MDevice}ms user={MUser}ms templates={MTemplates}ms " +
                "embed={MEmbed}ms ({Frames} frame(s), {Usable} usable) persist={MPersist}ms " +
                "session={MSession}ms broadcast={MBroadcast}ms forward={MForward}ms TOTAL={MTotal}ms",
                mDevice, mUser - mDevice, mTemplates - mUser,
                mEmbed - mTemplates, frames.Count, usableFrames, mPersist - mEmbed,
                mSession - mPersist, mBroadcast - mSession, mForward - mBroadcast, mForward);

            return Ok(new { IsSuccess = true, Message = "Sign-in approved." });
        }

        /// <summary>Wraps one ad-hoc embedding as a template row for pairwise checks.</summary>
        private static UserFaceTemplate TemplateOf(string userId, float[] embedding)
        {
            return new UserFaceTemplate
            {
                UserId = userId,
                Embedding = FaceMatcher.Encode(embedding),
                Dimensions = embedding.Length
            };
        }

        private double ReadPhotoThreshold()
        {
            // Invariant culture: on a server locale where "," is the decimal
            // separator, a plain TryParse would read "0.42" as 42 and silently
            // demand a similarity no face can reach.
            var configured = _configuration["Face:PhotoMatchThreshold"];
            if (double.TryParse(configured, System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out var value)
                && value > 0 && value < 1)
            {
                return value;
            }

            return PhotoFaceService.DefaultMatchThreshold;
        }

        /// <summary>
        /// Same forwarding the hub does after an approval, so the browser's SSE
        /// bridge learns the outcome no matter which path decided it.
        ///
        /// FIRE AND FORGET, deliberately. This used to be awaited before the phone
        /// received its 200, and it measured 2,064 / 2,074 / 2,089 / 2,299 ms on
        /// four consecutive approvals - a 25ms spread across the warm runs, which
        /// is the signature of a fixed connect timeout rather than variable network
        /// work (the SQL phases beside it ranged 82-336ms). The cause was name
        /// resolution: "localhost" yields ::1 first on Windows, while the dev
        /// server runs `next dev -H 0.0.0.0` and binds IPv4 only, so every single
        /// approval paid one dead IPv6 connect before falling back.
        ///
        /// The desktop learns the outcome through this POST either way. Awaiting it
        /// only ever made the HANDSET wait for something the handset does not
        /// consume - 58% of the server's share of a face sign-in, for nothing.
        ///
        /// This POST carries the full session (JWT + refresh token). Certificate
        /// validation is therefore bypassed ONLY for loopback hosts (the dev-time
        /// self-signed Next.js on localhost, which never crosses the network); for
        /// any other host normal TLS validation applies, so a mis-set
        /// <c>NextJsUrl</c> pointing off-box cannot silently hand the token to a
        /// machine-in-the-middle.
        /// </summary>
        private void ForwardApprovalToNextJs(object payload)
        {
            var json = JsonSerializer.Serialize(payload);
            var nextJsUrl = _configuration["NextJsUrl"];

            var urls = !string.IsNullOrEmpty(nextJsUrl)
                ? new[] { $"{nextJsUrl}/api/auth/face-link/push-approve" }
                : new[]
                {
                    "http://127.0.0.1:3000/api/auth/face-link/push-approve",
                    "http://localhost:3000/api/auth/face-link/push-approve",
                    "http://192.168.0.222:3000/api/auth/face-link/push-approve",
                    "https://localhost:3000/api/auth/face-link/push-approve"
                };

            var logger = _logger;

            _ = Task.Run(async () =>
            {
                try
                {
                    using var http = BuildForwardingClient();

                    foreach (var url in urls)
                    {
                        try
                        {
                            using var content = new StringContent(json, Encoding.UTF8, "application/json");
                            var res = await http.PostAsync(url, content);
                            if (res.IsSuccessStatusCode)
                            {
                                logger.LogInformation("Successfully forwarded approval result to Next.js via {Url}", url);
                                return;
                            }
                            else
                            {
                                var errBody = await res.Content.ReadAsStringAsync();
                                logger.LogWarning("Forwarding to Next.js {Url} responded with status {StatusCode}: {Body}", url, res.StatusCode, errBody);
                            }
                        }
                        catch (Exception ex)
                        {
                            logger.LogWarning("Forwarding attempt to {Url} failed: {Message}", url, ex.Message);
                        }
                    }

                    logger.LogWarning("Forwarding approve result to Next.js: no endpoint accepted it.");
                }
                catch (Exception ex)
                {
                    logger.LogWarning("Forwarding approve result to Next.js notice: {Message}", ex.Message);
                }
            });
        }

        /// <summary>
        /// Forwards remote session revocation / Emergency Kill Switch events to Next.js Web Portal
        /// so browser sessions disconnect immediately in real time (< 1s).
        /// </summary>
        private void ForwardRevocationToNextJs(object payload)
        {
            var json = JsonSerializer.Serialize(payload);
            var nextJsUrl = _configuration["NextJsUrl"];

            var urls = !string.IsNullOrEmpty(nextJsUrl)
                ? new[] { $"{nextJsUrl}/api/auth/sessions/remote-revoke" }
                : new[]
                {
                    "http://127.0.0.1:3000/api/auth/sessions/remote-revoke",
                    "http://localhost:3000/api/auth/sessions/remote-revoke",
                    "http://192.168.0.222:3000/api/auth/sessions/remote-revoke",
                    "https://localhost:3000/api/auth/sessions/remote-revoke"
                };

            var logger = _logger;

            _ = Task.Run(async () =>
            {
                try
                {
                    using var http = BuildForwardingClient();

                    foreach (var url in urls)
                    {
                        try
                        {
                            using var content = new StringContent(json, Encoding.UTF8, "application/json");
                            var res = await http.PostAsync(url, content);
                            if (res.IsSuccessStatusCode)
                            {
                                logger.LogInformation("Successfully forwarded revocation event to Next.js via {Url}", url);
                                return;
                            }
                        }
                        catch (Exception ex)
                        {
                            logger.LogWarning("Forwarding revocation attempt to {Url} failed: {Message}", url, ex.Message);
                        }
                    }
                }
                catch (Exception ex)
                {
                    logger.LogWarning("Forwarding revocation to Next.js notice: {Message}", ex.Message);
                }
            });
        }

        /// <summary>
        /// An <see cref="HttpClient"/> that trusts a self-signed cert ONLY when the
        /// target host is loopback. This is for the local Next.js dev server on
        /// https://localhost; it must never blanket-trust a remote host, or a
        /// forwarded session token could be captured by an on-path attacker.
        /// </summary>
        private static HttpClient BuildForwardingClient()
        {
            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (req, cert, chain, errors) =>
                {
                    if (errors == System.Net.Security.SslPolicyErrors.None)
                    {
                        return true;
                    }

                    var host = req?.RequestUri?.Host;
                    return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
                        || host == "127.0.0.1"
                        || host == "::1";
                }
            };

            // An explicit ceiling. The default is 100 seconds, which for a
            // detached forward means a wedged endpoint keeps a socket and a task
            // alive for over a minute per approval.
            return new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(5) };
        }

        /// <summary>
        /// POST <c>device/face-link-submit</c> - Mobile app submits pairing or login via HTTP 8087 bridge to bypass mobile SSL restrictions.
        /// </summary>
        [HttpPost("device/face-link-submit")]
        [AllowAnonymous]
        public async Task<IActionResult> BridgeFaceLinkSubmit([FromBody] JsonElement body)
        {
            try
            {
                using var client = BuildForwardingClient();
                var rawJson = body.GetRawText();
                var nextJsUrl = _configuration["NextJsUrl"];
                var candidateUrls = !string.IsNullOrEmpty(nextJsUrl)
                    ? new[] { nextJsUrl }
                    : new[] { "http://127.0.0.1:3000", "http://localhost:3000", "http://192.168.0.222:3000", "https://localhost:3000" };

                HttpResponseMessage? res = null;
                Exception? lastEx = null;

                foreach (var baseEndpoint in candidateUrls)
                {
                    try
                    {
                        var content = new StringContent(rawJson, Encoding.UTF8, "application/json");
                        res = await client.PostAsync($"{baseEndpoint}/api/auth/face-link/submit", content);
                        if (res != null) break;
                    }
                    catch (Exception ex)
                    {
                        lastEx = ex;
                    }
                }

                if (res != null)
                {
                    var json = await res.Content.ReadAsStringAsync();
                    return new ContentResult
                    {
                        Content = json,
                        ContentType = "application/json",
                        StatusCode = (int)res.StatusCode
                    };
                }

                _logger.LogWarning("BridgeFaceLinkSubmit error: {Message}", lastEx?.Message ?? "No Next.js host responded.");
                return StatusCode(500, new { isSuccess = false, message = "Could not bridge face link request to Next.js portal." });
            }
            catch (Exception ex)
            {
                _logger.LogWarning("BridgeFaceLinkSubmit error: {Message}", ex.Message);
                return StatusCode(500, new { isSuccess = false, message = "Could not bridge face link request." });
            }
        }

        // =====================================================================
        // Helpers
        // =====================================================================

        /// <summary>
        /// The one place a real session is built here, so every path that issues one
        /// issues the same thing - the same shape <c>AuthController.Login</c>
        /// returns, which is what lets the frontend run one pipeline for all of
        /// password, passkey and face.
        /// </summary>
        private async Task<object> BuildSession(ApplicationUser user, string message)
        {
            // Roles are fetched ONCE and handed to the issuer. This method needs
            // them for the session body, and CreateJwtAsync needs them for the
            // claims - it used to fetch its own copy, so every face sign-in paid
            // two identical round trips to a database across the public internet.
            var roles = await _userManager.GetRolesAsync(user);
            var token = await _tokenIssuer.CreateJwtAsync(user, roles);
            var jwtId = token.Claims.First(c => c.Type == JwtRegisteredClaimNames.Jti).Value;
            var refreshToken = await _tokenIssuer.CreateRefreshTokenAsync(user, jwtId);

            return new
            {
                IsSuccess = true,
                Message = message,
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
                    PhoneNumber = user.PhoneNumber ?? "",
                    ProfilePictureUrl = user.ProfilePictureUrl,
                    CoverUrl = user.CoverUrl ?? "",
                    Roles = roles.ToList()
                }
            };
        }

        private double ReadThreshold()
        {
            // Invariant culture (like ReadPhotoThreshold): on a comma-decimal
            // server locale a plain TryParse reads "0.45" as 45, fails the range
            // check, and silently discards the operator's override.
            var configured = _configuration["Face:MatchThreshold"];
            if (double.TryParse(configured, System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out var value)
                && value > 0 && value < 2)
            {
                return value;
            }

            return FaceMatcher.DefaultThreshold;
        }

        /// <summary>
        /// Sends a SignalR group message with a hard 3s deadline, so a single
        /// stale/half-dead connection in the group can never stall the HTTP
        /// request that triggered the broadcast. Real-time delivery to healthy
        /// connections is unaffected (they receive in well under a second); only
        /// a dead one is abandoned instead of blocking on its transport timeout.
        /// </summary>
        private async Task SafeBroadcastAsync(string group, string method, object payload, string what)
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                await _hubContext.Clients.Group(group).SendAsync(method, payload, cts.Token);
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Broadcast '{What}' to {Group} timed out - a connection there may be stale.", what, group);
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Broadcast '{What}' to {Group} failed: {Message}", what, group, ex.Message);
            }
        }

        /// <summary>SHA-256 of a device token. Only the hash is ever stored.</summary>
        private static byte[] HashToken(string token)
        {
            return SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));
        }

        private static string FaceTokenKey(string token) => "face:login:" + token;

        private static string NewToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24));

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

        /// <summary>Reads one <c>number[]</c> descriptor. Returns null when absent or the wrong shape.</summary>
        private static float[] ReadDescriptor(JsonElement body, string name)
        {
            if (body.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            JsonElement value;
            if (!body.TryGetProperty(name, out value) || value.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            return ToFloats(value);
        }

        /// <summary>Reads a <c>number[][]</c> of descriptors, skipping nothing silently.</summary>
        private static List<float[]> ReadDescriptors(JsonElement body, string name)
        {
            var result = new List<float[]>();

            if (body.ValueKind != JsonValueKind.Object)
            {
                return result;
            }

            JsonElement value;
            if (!body.TryGetProperty(name, out value) || value.ValueKind != JsonValueKind.Array)
            {
                return result;
            }

            foreach (var element in value.EnumerateArray())
            {
                if (element.ValueKind != JsonValueKind.Array)
                {
                    // An unusable entry becomes an empty descriptor rather than
                    // being dropped, so the caller's count check still catches it.
                    result.Add(Array.Empty<float>());
                    continue;
                }

                result.Add(ToFloats(element));
            }

            return result;
        }

        private static float[] ToFloats(JsonElement array)
        {
            var length = array.GetArrayLength();

            // Bounded before allocating: the length comes from the request body.
            if (length == 0 || length > 1024)
            {
                return Array.Empty<float>();
            }

            var values = new float[length];
            var i = 0;

            foreach (var item in array.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Number || !item.TryGetDouble(out var d))
                {
                    return Array.Empty<float>();
                }

                values[i++] = (float)d;
            }

            return values;
        }

        /// <summary>
        /// POST <c>device/set-pin</c> - Sets or updates user's 6-digit Master PIN from CAM ID app.
        /// </summary>
        [HttpPost("device/set-pin")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public Task<IActionResult> SetDevicePin([FromBody] JsonElement body)
            => Guarded(() => SetDevicePinCore(body), "set device pin");

        private async Task<IActionResult> SetDevicePinCore(JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            var pin = ReadString(body, "pin");

            if (string.IsNullOrWhiteSpace(deviceToken) || string.IsNullOrWhiteSpace(pin))
            {
                return BadRequest(Fail("Missing deviceToken or pin."));
            }

            if (pin.Length != 6 || !pin.All(char.IsDigit))
            {
                return BadRequest(Fail("PIN must be exactly 6 numeric digits."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device == null)
            {
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            if (user == null)
            {
                return Unauthorized(Fail("User not found."));
            }

            var pinHash = HashPin(pin);
            await _userManager.SetAuthenticationTokenAsync(user, "CamIdPin", "PinHash", pinHash);

            _logger.LogInformation("6-digit PIN code set for user {UserName} from device {DeviceId}.", user.UserName, device.Id);
            return Ok(new { IsSuccess = true, Message = "6-digit PIN code saved successfully." });
        }

        /// <summary>
        /// POST <c>device/reset-pin</c> - Resets (removes) user's 6-digit Master PIN from CAM ID app.
        /// </summary>
        [HttpPost("device/reset-pin")]
        [AllowAnonymous]
        public Task<IActionResult> ResetDevicePin([FromBody] JsonElement body)
            => Guarded(() => ResetDevicePinCore(body), "reset device pin");

        private async Task<IActionResult> ResetDevicePinCore(JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Missing deviceToken."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device == null)
            {
                return Unauthorized(Fail("This phone is not paired."));
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            if (user == null)
            {
                return Unauthorized(Fail("User not found."));
            }

            await _userManager.RemoveAuthenticationTokenAsync(user, "CamIdPin", "PinHash");

            _logger.LogInformation("6-digit PIN code reset/removed for user {UserName} from device {DeviceId}.", user.UserName, device.Id);
            return Ok(new { IsSuccess = true, Message = "6-digit PIN code reset successfully." });
        }

        /// <summary>
        /// POST <c>device/pin-status</c> - Checks if user has a 6-digit Master PIN set.
        /// </summary>
        [HttpPost("device/pin-status")]
        [AllowAnonymous]
        public async Task<IActionResult> GetDevicePinStatus([FromBody] JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Missing deviceToken."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device == null)
            {
                return Unauthorized(Fail("This phone is not paired."));
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            if (user == null) return Unauthorized(Fail("User not found."));

            var storedHash = await _userManager.GetAuthenticationTokenAsync(user, "CamIdPin", "PinHash");
            return Ok(new
            {
                IsSuccess = true,
                HasPin = !string.IsNullOrEmpty(storedHash)
            });
        }

        /// <summary>
        /// POST <c>device/approve-session-pin</c> - Answers a push-approve challenge using 6-Digit PIN fallback.
        /// </summary>
        [HttpPost("device/approve-session-pin")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public Task<IActionResult> ApproveSessionWithPin([FromBody] JsonElement body)
            => Guarded(() => ApproveSessionWithPinCore(body), "pin approve session");

        /// <summary>
        /// PIN counterpart of <see cref="ApproveSessionCore"/>, wrapped for the
        /// same reason: every failure must reach the waiting desktop.
        /// </summary>
        private async Task<IActionResult> ApproveSessionWithPinCore(JsonElement body)
        {
            var sessionId = ReadString(body, "sessionId");
            var result = await ApproveSessionWithPinAttempt(body);
            NotifyDesktopOfFailure(sessionId, result);
            return result;
        }

        private async Task<IActionResult> ApproveSessionWithPinAttempt(JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            var sessionId = ReadString(body, "sessionId");
            var pin = ReadString(body, "pin");
            int? selectedNumber = body.TryGetProperty("selectedNumber", out var sn) && sn.TryGetInt32(out var n) ? n : null;

            if (string.IsNullOrWhiteSpace(deviceToken) || string.IsNullOrWhiteSpace(sessionId) || string.IsNullOrWhiteSpace(pin))
            {
                return BadRequest(Fail("Missing deviceToken, sessionId, or pin."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device == null)
            {
                return Unauthorized(Fail("This phone is not paired. Pair it again from Settings."));
            }

            var sessionKey = AuthSessionRegistry.Key(sessionId);
            if (!_cache.TryGetValue(sessionKey, out string boundUserId) || boundUserId != device.UserId)
            {
                _logger.LogWarning("Approve-session PIN for {SessionId} refused: session unknown or expired.", sessionId);
                return Unauthorized(Fail("This sign-in request expired. Start a new sign-in on your computer."));
            }

            // Verify number matching challenge if active
            if (_cache.TryGetValue("match:" + sessionId, out int expectedNumber))
            {
                if (selectedNumber.HasValue && selectedNumber.Value != expectedNumber)
                {
                    _cache.Remove(sessionKey);
                    _cache.Remove("match:" + sessionId);
                    _logger.LogWarning("Approve-session PIN for {SessionId} refused: number mismatch (got {Got}, expected {Expected}). Session terminated.", sessionId, selectedNumber.Value, expectedNumber);

                    await SafeBroadcastAsync($"session_{sessionId}", "AuthRejected", new
                    {
                        SessionId = sessionId,
                        Reason = "Incorrect matching number selected.",
                        Timestamp = DateTime.UtcNow
                    }, "auth rejected via number mismatch");

                    ForwardApprovalToNextJs(new { sessionId, approved = false, message = "Incorrect matching number selected." });
                    return Unauthorized(Fail("Incorrect matching number selected. Sign-in challenge terminated for security."));
                }
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            if (user == null)
            {
                return Unauthorized(Fail("User not found."));
            }

            if (await _userManager.IsLockedOutAsync(user))
            {
                return Unauthorized(Fail("Account is locked. Please try again later."));
            }

            var storedHash = await _userManager.GetAuthenticationTokenAsync(user, "CamIdPin", "PinHash");
            if (string.IsNullOrEmpty(storedHash))
            {
                return BadRequest(Fail("No PIN set for this account yet. Please setup your PIN in CAM ID settings."));
            }

            if (!VerifyPin(pin, storedHash))
            {
                var lockKey = "pin:fail:" + device.Id;
                var fails = _cache.TryGetValue(lockKey, out int current) ? current + 1 : 1;
                _cache.Set(lockKey, fails, TimeSpan.FromMinutes(10));

                _logger.LogWarning("Approve-session PIN failed for {UserName} (attempt {Count}).", user.UserName, fails);
                return Unauthorized(new
                {
                    IsSuccess = false,
                    Message = "Incorrect 6-digit PIN code.",
                    AttemptsLeft = Math.Max(0, 5 - fails)
                });
            }

            _cache.Remove(sessionKey);
            _cache.Remove("match:" + sessionId);
            device.LastUsedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await _userManager.ResetAccessFailedCountAsync(user);

            var sessionPayload = await BuildSession(user, "Login successful via CAM ID 6-Digit PIN");
            _logger.LogInformation("Sign-in {SessionId} approved with verified PIN for {UserName}.", sessionId, user.UserName);

            await SafeBroadcastAsync($"session_{sessionId}", "AuthApproved", new
            {
                SessionId = sessionId,
                AuthPayload = "pin-verified",
                Payload = sessionPayload,
                Timestamp = DateTime.UtcNow
            }, "auth approved via pin");

            ForwardApprovalToNextJs(new { sessionId, approved = true, payload = sessionPayload });

            return Ok(new { IsSuccess = true, Message = "Sign-in approved via PIN." });
        }

        /// <summary>
        /// POST <c>device/active-sessions</c> - Lists active browser sessions for this user.
        /// </summary>
        [HttpPost("device/active-sessions")]
        [AllowAnonymous]
        public async Task<IActionResult> GetActiveSessions([FromBody] JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Missing deviceToken."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device == null)
            {
                return Unauthorized(Fail("This phone is not paired."));
            }

            var activeTokens = await _context.RefreshTokens
                .AsNoTracking()
                .Where(r => r.UserId == device.UserId && !r.IsRevoked && !r.IsUsed && r.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(r => r.CreatedAt)
                .Take(10)
                .Select(r => new
                {
                    Id = r.Id,
                    JwtId = r.JwtId,
                    CreatedAt = r.CreatedAt,
                    ExpiresAt = r.ExpiresAt,
                    ClientInfo = "Web Portal Session"
                })
                .ToListAsync();

            return Ok(new
            {
                IsSuccess = true,
                Sessions = activeTokens
            });
        }

        /// <summary>
        /// POST <c>device/revoke-session</c> - Remote Kill Switch to terminate active browser sessions.
        /// </summary>
        [HttpPost("device/revoke-session")]
        [AllowAnonymous]
        public async Task<IActionResult> RevokeSessionRemote([FromBody] JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            var sessionId = ReadString(body, "sessionId");
            var revokeAll = body.TryGetProperty("revokeAll", out var ra) && ra.GetBoolean();

            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Missing deviceToken."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device == null)
            {
                return Unauthorized(Fail("This phone is not paired."));
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            var userName = user?.UserName ?? "";

            if (revokeAll)
            {
                var activeTokens = await _context.RefreshTokens
                    .Where(r => r.UserId == device.UserId && !r.IsRevoked)
                    .ToListAsync();
                foreach (var t in activeTokens) t.IsRevoked = true;
                await _context.SaveChangesAsync();

                var payload = new
                {
                    UserId = device.UserId,
                    UserName = userName,
                    RevokeAll = true,
                    Message = "All sessions revoked from paired CAM ID mobile device.",
                    Timestamp = DateTime.UtcNow
                };

                await SafeBroadcastAsync($"user_{device.UserId}", "ForceLogout", payload, "force logout user all");
                await SafeBroadcastAsync("all", "ForceLogout", payload, "force logout global");

                ForwardRevocationToNextJs(new { revokeAll = true, userId = device.UserId, userName = userName });

                _logger.LogInformation("All active sessions revoked for user {UserId} ({UserName}) from mobile device.", device.UserId, userName);
                return Ok(new { IsSuccess = true, Message = "All active sessions have been terminated." });
            }
            else if (!string.IsNullOrEmpty(sessionId))
            {
                var token = await _context.RefreshTokens
                    .FirstOrDefaultAsync(r => r.UserId == device.UserId && (r.JwtId == sessionId || r.Id.ToString() == sessionId));
                if (token != null)
                {
                    token.IsRevoked = true;
                    await _context.SaveChangesAsync();
                }

                var payload = new
                {
                    SessionId = sessionId,
                    UserId = device.UserId,
                    UserName = userName,
                    RevokeAll = false,
                    Message = "Session terminated from mobile device.",
                    Timestamp = DateTime.UtcNow
                };

                await SafeBroadcastAsync($"session_{sessionId}", "ForceLogout", payload, "force logout session");
                await SafeBroadcastAsync($"user_{device.UserId}", "ForceLogout", payload, "force logout user session");

                ForwardRevocationToNextJs(new { revokeAll = false, sessionId = sessionId, userId = device.UserId, userName = userName });

                return Ok(new { IsSuccess = true, Message = "Session terminated." });
            }

            return BadRequest(Fail("Specify sessionId or revokeAll = true."));
        }

        private static string HashPin(string pin)
        {
            var salt = RandomNumberGenerator.GetBytes(16);
            var hash = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(pin),
                salt,
                100_000,
                HashAlgorithmName.SHA256,
                32);
            return $"{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
        }

        private static bool VerifyPin(string pin, string storedHash)
        {
            if (string.IsNullOrWhiteSpace(storedHash) || !storedHash.Contains(':')) return false;
            var parts = storedHash.Split(':');
            if (parts.Length != 2) return false;
            try
            {
                var salt = Convert.FromBase64String(parts[0]);
                var expected = Convert.FromBase64String(parts[1]);
                var actual = Rfc2898DeriveBytes.Pbkdf2(
                    Encoding.UTF8.GetBytes(pin),
                    salt,
                    100_000,
                    HashAlgorithmName.SHA256,
                    32);
                return CryptographicOperations.FixedTimeEquals(actual, expected);
            }
            catch
            {
                return false;
            }
        }

        /// <summary>Same catch-all <c>WebAuthnController</c> uses - see its remarks.</summary>
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

        /// <summary>
        /// Updates the paired user's profile information (Full Name, Email, Phone Number, Profile Picture URL)
        /// using their authenticated mobile device token.
        /// </summary>
        [HttpPost("device/update-profile")]
        [AllowAnonymous]
        public Task<IActionResult> DeviceUpdateProfile([FromBody] JsonElement body)
            => Guarded(() => DeviceUpdateProfileCore(body), "device update profile");

        private async Task<IActionResult> DeviceUpdateProfileCore(JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Device token is required."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices.FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);
            if (device == null)
            {
                return Unauthorized(Fail("Device token is invalid or revoked."));
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            if (user == null)
            {
                return NotFound(Fail("User not found."));
            }

            var fullName = ReadString(body, "fullName");
            var email = ReadString(body, "email");
            var phoneNumber = ReadString(body, "phoneNumber");
            var profilePictureUrl = ReadString(body, "profilePictureUrl");
            var coverUrl = ReadString(body, "coverUrl");

            if (!string.IsNullOrWhiteSpace(fullName))
            {
                var parts = fullName.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                user.FirstName = parts[0];
                user.LastName = parts.Length > 1 ? parts[1] : "";
            }

            if (!string.IsNullOrWhiteSpace(email) && email != user.Email)
            {
                user.Email = email.Trim();
                user.UserName = email.Trim();
            }

            if (!string.IsNullOrWhiteSpace(phoneNumber))
            {
                user.PhoneNumber = phoneNumber.Trim();
            }

            if (!string.IsNullOrWhiteSpace(profilePictureUrl))
            {
                user.ProfilePictureUrl = profilePictureUrl.Trim();
            }

            if (!string.IsNullOrWhiteSpace(coverUrl))
            {
                user.CoverUrl = coverUrl.Trim();
            }

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
            {
                return BadRequest(Fail("Failed to update profile: " + string.Join(", ", result.Errors.Select(e => e.Description))));
            }

            var roles = await _userManager.GetRolesAsync(user);

            return Ok(new
            {
                IsSuccess = true,
                Message = "Profile updated successfully.",
                UserId = user.Id,
                UserName = user.UserName,
                FullName = $"{user.FirstName} {user.LastName}".Trim(),
                Email = user.Email,
                PhoneNumber = user.PhoneNumber,
                ProfilePictureUrl = user.ProfilePictureUrl,
                CoverUrl = user.CoverUrl ?? "",
                Roles = roles
            });
        }

        /// <summary>
        /// Resets/Changes the paired user's password using their device token or current password.
        /// </summary>
        [HttpPost("device/reset-password")]
        [AllowAnonymous]
        public Task<IActionResult> DeviceResetPassword([FromBody] JsonElement body)
            => Guarded(() => DeviceResetPasswordCore(body), "device reset password");

        private async Task<IActionResult> DeviceResetPasswordCore(JsonElement body)
        {
            var deviceToken = ReadString(body, "deviceToken");
            var newPassword = ReadString(body, "newPassword");
            var currentPassword = ReadString(body, "currentPassword");

            if (string.IsNullOrWhiteSpace(deviceToken))
            {
                return BadRequest(Fail("Device token is required."));
            }

            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
            {
                return BadRequest(Fail("New password must be at least 6 characters."));
            }

            var hash = HashToken(deviceToken);
            var device = await _context.UserFaceDevices.FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);
            if (device == null)
            {
                return Unauthorized(Fail("Device token is invalid or revoked."));
            }

            var user = await _userManager.FindByIdAsync(device.UserId);
            if (user == null)
            {
                return NotFound(Fail("User not found."));
            }

            IdentityResult result;
            if (!string.IsNullOrWhiteSpace(currentPassword))
            {
                result = await _userManager.ChangePasswordAsync(user, currentPassword, newPassword);
            }
            else
            {
                // Biometrically authenticated device reset
                var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
                result = await _userManager.ResetPasswordAsync(user, resetToken, newPassword);
            }

            if (!result.Succeeded)
            {
                return BadRequest(Fail("Password update failed: " + string.Join(", ", result.Errors.Select(e => e.Description))));
            }

            _logger.LogInformation("Password reset successfully for user {UserId} via paired device {DeviceId}", user.Id, device.Id);

            return Ok(new
            {
                IsSuccess = true,
                Message = "Password updated successfully."
            });
        }

        private static object Fail(string message)
        {
            return new { IsSuccess = false, Message = message };
        }
    }
}
