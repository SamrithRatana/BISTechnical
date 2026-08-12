using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ServiceMaintenance.Authentication;
using ServiceMaintenance.Services;
using ServiceMaintenance.Services.JWT;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ServiceMaintenance.Areas.Identity.Pages.Account
{
    /// <summary>
    /// ✅ Pure JWT Authentication Login (No Identity)
    /// Authenticates with JWT API and creates cookie-based session
    /// </summary>
    [AllowAnonymous]
    public class LoginModel : PageModel
    {
        private readonly ILogger<LoginModel> _logger;
        private readonly JwtApiService _jwtApiService;
        private readonly JwtSessionService _jwtSessionService;
        private readonly JwtAuthenticationStateProvider _authStateProvider;
        private readonly GlobalUserService _globalUserCache;
        private readonly IServiceScopeFactory _scopeFactory; // ✅ NEW — needed for safe fire-and-forget

        public LoginModel(
            ILogger<LoginModel> logger,
            JwtApiService jwtApiService,
            JwtSessionService jwtSessionService,
            AuthenticationStateProvider authStateProvider,
            GlobalUserService globalUserCache,
            IServiceScopeFactory scopeFactory) // ✅ NEW
        {
            _logger = logger;
            _jwtApiService = jwtApiService;
            _jwtSessionService = jwtSessionService;
            _authStateProvider = authStateProvider as JwtAuthenticationStateProvider;
            _globalUserCache = globalUserCache;
            _scopeFactory = scopeFactory; // ✅ NEW
        }

        [BindProperty]
        public InputModel Input { get; set; }

        public string ReturnUrl { get; set; }

        [TempData]
        public string ErrorMessage { get; set; }

        public class InputModel
        {
            [Required]
            [Display(Name = "Email or Username")]
            public string Email { get; set; }

            [Required]
            [DataType(DataType.Password)]
            public string Password { get; set; }

            [Display(Name = "Remember me?")]
            public bool RememberMe { get; set; }
        }

        public void OnGet(string returnUrl = null)
        {
            if (!string.IsNullOrEmpty(ErrorMessage))
            {
                ModelState.AddModelError(string.Empty, ErrorMessage);
            }

            returnUrl ??= Url.Content("~/");
            ReturnUrl = returnUrl;

            _logger.LogInformation($"Login page loaded. ReturnUrl: {returnUrl}");
        }

        public async Task<IActionResult> OnPostAsync(string returnUrl = null)
        {
            returnUrl ??= Url.Content("~/");
            ReturnUrl = returnUrl;

            _logger.LogInformation($"=== LOGIN ATTEMPT STARTED ===");
            _logger.LogInformation($"Username/Email: {Input.Email}");
            _logger.LogInformation($"Remember Me: {Input.RememberMe}");

            if (!ModelState.IsValid)
            {
                _logger.LogWarning("Model state is invalid");
                return Page();
            }

            try
            {
                // ============================================
                // STEP 1: Authenticate with JWT API
                // ============================================
                _logger.LogInformation("Step 1: Calling JWT API for authentication...");

                var jwtResponse = await _jwtApiService.LoginAsync(
                    Input.Email,
                    Input.Password,
                    Input.RememberMe
                );

                if (!jwtResponse.IsSuccess || string.IsNullOrEmpty(jwtResponse.Token))
                {
                    _logger.LogWarning($"JWT API authentication failed: {jwtResponse.Message}");
                    ModelState.AddModelError(string.Empty, jwtResponse.Message ?? "Invalid login attempt.");
                    return Page();
                }

                _logger.LogInformation("✅ JWT API authentication successful");
                _logger.LogInformation($"Token received, expires: {jwtResponse.Expiration:yyyy-MM-dd HH:mm:ss UTC}");
                _logger.LogInformation($"User: {jwtResponse.User?.UserName}, Email: {jwtResponse.User?.Email}");

                // ============================================
                // STEP 2: Store JWT tokens in session
                // ============================================
                _logger.LogInformation("Step 2: Storing JWT tokens in session...");

                _jwtSessionService.SetToken(jwtResponse.Token);

                if (!string.IsNullOrEmpty(jwtResponse.RefreshToken))
                {
                    _jwtSessionService.SetRefreshToken(jwtResponse.RefreshToken);
                    _logger.LogInformation("✅ Refresh token stored");
                }
                else
                {
                    _logger.LogWarning("⚠️ No refresh token provided by API");
                }

                // ============================================
                // ✅ FIXED — STEP 2.5: Warm up Global User Cache (NON-BLOCKING)
                // ----------------------------------------------------------------
                // Previously this called GetUsersAsync/GetUsersWithDetailsAsync with
                // forceRefresh: true and awaited both — that forced a full paginated
                // API crawl (twice) on every single login, which is why login was
                // sometimes slow (worse with more users / slower API / higher load).
                //
                // This is just a cache warm-up convenience, not a requirement for
                // authentication to succeed, so it must never block the redirect.
                //
                // We fire it on a background Task using a NEW DI scope (not this
                // request's scope, which will be disposed as soon as we return the
                // redirect result) so it can safely keep running after the response
                // has been sent.
                // ============================================
                _logger.LogInformation("Step 2.5: Triggering background user cache warm-up (non-blocking)...");

                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var scope = _scopeFactory.CreateScope();
                        var globalUserCache = scope.ServiceProvider.GetRequiredService<GlobalUserService>();

                        // ✅ forceRefresh: false — reuse cache if still fresh (30 min TTL),
                        // only hits the API if the cache is actually empty/expired.
                        await globalUserCache.GetUsersAsync(forceRefresh: false);
                        await globalUserCache.GetUsersWithDetailsAsync(forceRefresh: false);

                        _logger.LogInformation("✅ Background user cache warm-up completed");
                    }
                    catch (Exception cacheEx)
                    {
                        _logger.LogWarning(cacheEx, "⚠️ Background user cache warm-up failed (non-critical)");
                    }
                });

                // ============================================
                // STEP 3: Create authentication claims from JWT
                // ============================================
                _logger.LogInformation("Step 3: Creating authentication claims...");

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, jwtResponse.User?.Id ?? Guid.NewGuid().ToString()),
                    new Claim(ClaimTypes.Name, jwtResponse.User?.UserName ?? Input.Email),
                    new Claim(ClaimTypes.Email, jwtResponse.User?.Email ?? Input.Email)
                };

                // Add roles
                if (jwtResponse.User?.Roles != null && jwtResponse.User.Roles.Any())
                {
                    foreach (var role in jwtResponse.User.Roles)
                    {
                        claims.Add(new Claim(ClaimTypes.Role, role));
                    }
                    _logger.LogInformation($"✅ Roles added: {string.Join(", ", jwtResponse.User.Roles)}");
                }

                // Add custom claims if needed
                if (!string.IsNullOrEmpty(jwtResponse.User?.FirstName))
                {
                    claims.Add(new Claim("FirstName", jwtResponse.User.FirstName));
                }
                if (!string.IsNullOrEmpty(jwtResponse.User?.LastName))
                {
                    claims.Add(new Claim("LastName", jwtResponse.User.LastName));
                }

                // ============================================
                // STEP 4: Sign in with cookie authentication
                // ============================================
                _logger.LogInformation("Step 4: Signing in user with cookie...");

                var claimsIdentity = new ClaimsIdentity(
                    claims,
                    CookieAuthenticationDefaults.AuthenticationScheme
                );

                var authProperties = new AuthenticationProperties
                {
                    IsPersistent = Input.RememberMe,
                    ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8), // Match your session timeout
                    AllowRefresh = true
                };

                await HttpContext.SignInAsync(
                    CookieAuthenticationDefaults.AuthenticationScheme,
                    new ClaimsPrincipal(claimsIdentity),
                    authProperties
                );

                _logger.LogInformation($"✅ User signed in successfully: {jwtResponse.User?.UserName}");
                _logger.LogInformation($"Session ID: {HttpContext.Session.Id}");

                // ============================================
                // STEP 5: Notify authentication state provider
                // ============================================
                if (_authStateProvider != null)
                {
                    _authStateProvider.NotifyUserAuthentication(jwtResponse.Token);
                    _logger.LogInformation("✅ Authentication state provider notified");
                }

                _logger.LogInformation("=== LOGIN PROCESS COMPLETED ===");

                // ============================================
                // STEP 6: Redirect to return URL or home
                // ============================================
                if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
                {
                    _logger.LogInformation($"Redirecting to: {returnUrl}");
                    return LocalRedirect(returnUrl);
                }
                else
                {
                    _logger.LogInformation("Redirecting to home page");
                    return LocalRedirect("~/");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ EXCEPTION during login process for user: {Email}", Input.Email);
                _logger.LogError($"Exception type: {ex.GetType().Name}");
                _logger.LogError($"Exception message: {ex.Message}");
                _logger.LogError($"Stack trace: {ex.StackTrace}");

                ModelState.AddModelError(string.Empty, $"An error occurred during login: {ex.Message}");
                return Page();
            }
        }
    }
}