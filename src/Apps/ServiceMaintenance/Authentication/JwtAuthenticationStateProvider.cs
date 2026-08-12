using Microsoft.AspNetCore.Components.Authorization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ServiceMaintenance.Services;
using ServiceMaintenance.Services.JWT;

namespace ServiceMaintenance.Authentication
{
    /// <summary>
    /// ✅ JWT-based Authentication State Provider for Blazor Server
    /// REPLACES: RevalidatingIdentityAuthenticationStateProvider<ApplicationUser>
    /// </summary>
    public class JwtAuthenticationStateProvider : AuthenticationStateProvider
    {
        private readonly JwtSessionService _jwtSessionService;
        private readonly ILogger<JwtAuthenticationStateProvider> _logger;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public JwtAuthenticationStateProvider(
            JwtSessionService jwtSessionService,
            ILogger<JwtAuthenticationStateProvider> logger,
            IHttpContextAccessor httpContextAccessor)
        {
            _jwtSessionService = jwtSessionService;
            _logger = logger;
            _httpContextAccessor = httpContextAccessor;
        }

        /// <summary>
        /// Get current authentication state from JWT token
        /// </summary>
        public override Task<AuthenticationState> GetAuthenticationStateAsync()
        {
            try
            {
                var token = _jwtSessionService.GetToken();

                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogDebug("No JWT token found - user is not authenticated");
                    return Task.FromResult(new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity())));
                }

                // Check if token is expired
                if (_jwtSessionService.IsTokenExpired())
                {
                    _logger.LogWarning("JWT token has expired");
                    _jwtSessionService.ClearTokens();
                    return Task.FromResult(new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity())));
                }

                // Parse JWT token and extract claims
                var claims = ParseClaimsFromJwt(token);
                var identity = new ClaimsIdentity(claims, "jwt");
                var user = new ClaimsPrincipal(identity);

                var userName = user.Identity?.Name ?? "Unknown";
                _logger.LogDebug($"✅ User authenticated via JWT: {userName}");

                return Task.FromResult(new AuthenticationState(user));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error getting authentication state");
                return Task.FromResult(new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity())));
            }
        }

        /// <summary>
        /// Notify that user has logged in with JWT token
        /// Call this after successful login
        /// </summary>
        public void NotifyUserAuthentication(string token)
        {
            try
            {
                var claims = ParseClaimsFromJwt(token);
                var identity = new ClaimsIdentity(claims, "jwt");
                var user = new ClaimsPrincipal(identity);

                var authState = Task.FromResult(new AuthenticationState(user));
                NotifyAuthenticationStateChanged(authState);

                _logger.LogInformation("✅ User authentication state updated");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error notifying user authentication");
            }
        }

        /// <summary>
        /// Notify that user has logged out
        /// Call this on logout
        /// </summary>
        public void NotifyUserLogout()
        {
            var anonymousUser = new ClaimsPrincipal(new ClaimsIdentity());
            var authState = Task.FromResult(new AuthenticationState(anonymousUser));
            NotifyAuthenticationStateChanged(authState);

            _logger.LogInformation("✅ User logged out - authentication state cleared");
        }

        /// <summary>
        /// Parse claims from JWT token
        /// </summary>
        private IEnumerable<Claim> ParseClaimsFromJwt(string jwt)
        {
            var claims = new List<Claim>();

            try
            {
                var handler = new JwtSecurityTokenHandler();
                var token = handler.ReadJwtToken(jwt);

                // Extract all claims from token
                claims.AddRange(token.Claims);

                // ✅ Ensure standard ClaimTypes are present

                // Add Name claim if not present
                if (!claims.Any(c => c.Type == ClaimTypes.Name))
                {
                    var usernameClaim = token.Claims.FirstOrDefault(c =>
                        c.Type == "unique_name" ||
                        c.Type == "name" ||
                        c.Type == "preferred_username" ||
                        c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name");

                    if (usernameClaim != null)
                    {
                        claims.Add(new Claim(ClaimTypes.Name, usernameClaim.Value));
                    }
                }

                // Add NameIdentifier (User ID) if not present
                if (!claims.Any(c => c.Type == ClaimTypes.NameIdentifier))
                {
                    var idClaim = token.Claims.FirstOrDefault(c =>
                        c.Type == "sub" ||
                        c.Type == "nameid" ||
                        c.Type == "userId" ||
                        c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier");

                    if (idClaim != null)
                    {
                        claims.Add(new Claim(ClaimTypes.NameIdentifier, idClaim.Value));
                    }
                }

                // Add Email if not present
                if (!claims.Any(c => c.Type == ClaimTypes.Email))
                {
                    var emailClaim = token.Claims.FirstOrDefault(c =>
                        c.Type == "email" ||
                        c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress");

                    if (emailClaim != null)
                    {
                        claims.Add(new Claim(ClaimTypes.Email, emailClaim.Value));
                    }
                }

                // Add Roles
                var roleClaims = token.Claims.Where(c =>
                    c.Type == "role" ||
                    c.Type == ClaimTypes.Role ||
                    c.Type == "http://schemas.microsoft.com/ws/2008/06/identity/claims/role");

                foreach (var roleClaim in roleClaims)
                {
                    if (!claims.Any(c => c.Type == ClaimTypes.Role && c.Value == roleClaim.Value))
                    {
                        claims.Add(new Claim(ClaimTypes.Role, roleClaim.Value));
                    }
                }

                _logger.LogDebug($"✅ Parsed {claims.Count} claims from JWT token");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error parsing JWT token claims");
            }

            return claims;
        }

        /// <summary>
        /// Get current user's ID from claims
        /// </summary>
        public async Task<string> GetCurrentUserIdAsync()
        {
            var authState = await GetAuthenticationStateAsync();
            var user = authState.User;

            if (user?.Identity?.IsAuthenticated == true)
            {
                return user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            }

            return null;
        }

        /// <summary>
        /// Get current user's name from claims
        /// </summary>
        public async Task<string> GetCurrentUserNameAsync()
        {
            var authState = await GetAuthenticationStateAsync();
            var user = authState.User;

            if (user?.Identity?.IsAuthenticated == true)
            {
                return user.Identity.Name;
            }

            return null;
        }

        /// <summary>
        /// Check if current user has specific role
        /// </summary>
        public async Task<bool> IsInRoleAsync(string role)
        {
            var authState = await GetAuthenticationStateAsync();
            var user = authState.User;

            return user?.IsInRole(role) ?? false;
        }

        /// <summary>
        /// Get all roles for current user
        /// </summary>
        public async Task<List<string>> GetUserRolesAsync()
        {
            var authState = await GetAuthenticationStateAsync();
            var user = authState.User;

            if (user?.Identity?.IsAuthenticated == true)
            {
                return user.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
            }

            return new List<string>();
        }
    }
}