using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Logging;
using ServiceMaintenance.Authentication;
using ServiceMaintenance.Services.JWT;
using System.Net.Http;
using System.Threading.Tasks;

namespace ServiceMaintenance.Areas.Identity.Pages.Account
{
    /// <summary>
    /// ✅ FIXED: Complete logout with authentication state notification
    ///
    /// ✅ FIXED (this pass) — removed the previous OnGet() handler that called
    /// OnPost() directly. GET must be safe/idempotent; a handler that logs the
    /// user out on GET means ANY GET request to this URL — link prefetching,
    /// an antivirus/security scanner following links, a stray <img src="..">
    /// from another page, a browser back/forward reload — silently logs the
    /// user out with no confirmation. Logout must only happen from the POST
    /// form submission below.
    /// </summary>
    [AllowAnonymous]
    public class LogoutModel : PageModel
    {
        private readonly ILogger<LogoutModel> _logger;
        private readonly JwtSessionService _jwtSessionService;
        private readonly JwtAuthenticationStateProvider _authStateProvider;
        private readonly GlobalUserService _globalUserCache;
        private readonly IHttpClientFactory _httpClientFactory;

        public LogoutModel(
            ILogger<LogoutModel> logger,
            JwtSessionService jwtSessionService,
            AuthenticationStateProvider authStateProvider,
            GlobalUserService globalUserCache,
            IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _jwtSessionService = jwtSessionService;
            _authStateProvider = authStateProvider as JwtAuthenticationStateProvider;
            _globalUserCache = globalUserCache;
            _httpClientFactory = httpClientFactory;
        }

        // ✅ FIXED — GET now just renders the confirmation page (see Logout.cshtml).
        // It performs NO logout side-effect. Only OnPost() below actually logs out.
        public void OnGet()
        {
        }

        public async Task<IActionResult> OnPost(string returnUrl = null)
        {
            _logger.LogInformation("=== LOGOUT STARTED ===");

            try
            {
                var currentUser = User?.Identity?.Name ?? "Unknown";
                _logger.LogInformation($"User logging out: {currentUser}");

                // ============================================
                // ✅ STEP 1: Revoke refresh token via API
                // ============================================
                var refreshToken = _jwtSessionService.GetRefreshToken();
                if (!string.IsNullOrEmpty(refreshToken))
                {
                    try
                    {
                        _logger.LogInformation("🔐 Revoking refresh token...");

                        var client = _httpClientFactory.CreateClient("JwtApi");
                        var request = new { RefreshToken = refreshToken };

                        var response = await client.PostAsJsonAsync("api/Auth/revoke-token", request);

                        if (response.IsSuccessStatusCode)
                        {
                            _logger.LogInformation("✅ Refresh token revoked successfully");
                        }
                        else
                        {
                            _logger.LogWarning($"⚠️ Token revocation failed: {response.StatusCode}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to revoke refresh token (continuing with logout)");
                    }
                }

                // ============================================
                // STEP 2: Clear JWT tokens from session
                // ============================================
                _jwtSessionService.ClearTokens();
                _logger.LogInformation("✅ JWT tokens cleared from session");

                // ============================================
                // STEP 3: Sign out of cookie authentication
                // ============================================
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                _logger.LogInformation("✅ Cookie authentication cleared");

                // ============================================
                // STEP 4: Clear entire session
                // ============================================
                HttpContext.Session.Clear();
                _logger.LogInformation("✅ Session cleared");

                // ============================================
                // STEP 5: Notify authentication state provider
                // ============================================
                if (_authStateProvider != null)
                {
                    _authStateProvider.NotifyUserLogout();
                    _logger.LogInformation("✅ Authentication state provider notified of logout");
                }

                // ============================================
                // STEP 6: Clear user cache
                // ============================================
                try
                {
                    _globalUserCache.ClearCache();
                    _logger.LogInformation("✅ User cache cleared");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to clear user cache (non-critical)");
                }

                _logger.LogInformation($"=== LOGOUT COMPLETED for user: {currentUser} ===");

                return RedirectToPage("/Account/Login", new { area = "Identity" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error during logout");
                return RedirectToPage("/Account/Login", new { area = "Identity" });
            }
        }
    }
}