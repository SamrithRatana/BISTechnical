using Microsoft.Extensions.Logging;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace ServiceMaintenance.Services.JWT
{
    public class JwtSessionService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<JwtSessionService> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private const string JWT_TOKEN_KEY = "jwtToken";
        private const string REFRESH_TOKEN_KEY = "refreshToken";
        private const string TOKEN_EXPIRY_KEY = "tokenExpiry";

        public JwtSessionService(
            IHttpContextAccessor httpContextAccessor,
            ILogger<JwtSessionService> logger,
            IHttpClientFactory httpClientFactory)
        {
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
        }

        public void SetToken(string token)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(token))
                {
                    _logger.LogWarning("Attempted to store null or empty token");
                    return;
                }

                _httpContextAccessor.HttpContext?.Session.SetString(JWT_TOKEN_KEY, token);

                var handler = new JwtSecurityTokenHandler();
                var jwtToken = handler.ReadJwtToken(token);
                var expiry = jwtToken.ValidTo;

                _httpContextAccessor.HttpContext?.Session.SetString(TOKEN_EXPIRY_KEY, expiry.ToString("o"));

                _logger.LogDebug("Token stored successfully. Expires: {Expiry}", expiry);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error storing token");
            }
        }

        public void SetRefreshToken(string refreshToken)
        {
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                _logger.LogWarning("Attempted to store null refresh token");
                return;
            }

            _httpContextAccessor.HttpContext?.Session.SetString(REFRESH_TOKEN_KEY, refreshToken);
            _logger.LogDebug("Refresh token stored");
        }

        public string GetToken()
        {
            try
            {
                var token = _httpContextAccessor.HttpContext?.Session.GetString(JWT_TOKEN_KEY);

                if (string.IsNullOrEmpty(token))
                    return string.Empty;

                if (IsTokenExpired())
                {
                    _logger.LogWarning("Token expired, clearing session");
                    ClearTokens();
                    return string.Empty;
                }

                return token;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving token");
                return string.Empty;
            }
        }

        public async Task<string> GetOrRefreshTokenAsync()
        {
            try
            {
                var token = _httpContextAccessor.HttpContext?.Session.GetString(JWT_TOKEN_KEY);

                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogDebug("No token in session");
                    return string.Empty;
                }

                // ✅ FIXED: If expired, must refresh before returning
                if (IsTokenExpired())
                {
                    _logger.LogInformation("Token expired, attempting refresh");
                    var newToken = await RefreshTokenAsync();

                    if (string.IsNullOrEmpty(newToken))
                    {
                        _logger.LogWarning("Token refresh failed - clearing tokens");
                        ClearTokens();
                        return string.Empty; // Force re-login
                    }

                    return newToken;
                }

                // ✅ FIXED: Proactive refresh 2 minutes before expiry
                if (IsTokenExpiringSoon(2))
                {
                    _logger.LogDebug("Token expiring soon, attempting proactive refresh");

                    // Try to refresh synchronously
                    var newToken = await RefreshTokenAsync();

                    if (!string.IsNullOrEmpty(newToken))
                    {
                        _logger.LogInformation("✅ Token proactively refreshed");
                        return newToken;
                    }
                    else
                    {
                        _logger.LogWarning("⚠️ Proactive refresh failed, returning current token");
                        return token; // Fall back to current token if refresh fails
                    }
                }

                return token;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetOrRefreshTokenAsync");
                return string.Empty;
            }
        }

        public string GetRefreshToken()
        {
            return _httpContextAccessor.HttpContext?.Session.GetString(REFRESH_TOKEN_KEY) ?? string.Empty;
        }

        public bool IsTokenExpired()
        {
            try
            {
                var expiryString = _httpContextAccessor.HttpContext?.Session.GetString(TOKEN_EXPIRY_KEY);

                if (string.IsNullOrEmpty(expiryString))
                    return true;

                if (DateTime.TryParse(expiryString, out var expiry))
                {
                    var isExpired = expiry <= DateTime.UtcNow;

                    if (isExpired)
                        _logger.LogDebug("Token expired at {Expiry}", expiry);

                    return isExpired;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking expiration");
                return true;
            }
        }

        public bool IsTokenExpiringSoon(int minutesThreshold = 5)
        {
            try
            {
                var expiryString = _httpContextAccessor.HttpContext?.Session.GetString(TOKEN_EXPIRY_KEY);

                if (string.IsNullOrEmpty(expiryString))
                    return true;

                if (DateTime.TryParse(expiryString, out var expiry))
                {
                    var timeUntilExpiry = expiry - DateTime.UtcNow;
                    return timeUntilExpiry.TotalMinutes <= minutesThreshold;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if expiring soon");
                return true;
            }
        }

        public DateTime? GetTokenExpiration()
        {
            try
            {
                var expiryString = _httpContextAccessor.HttpContext?.Session.GetString(TOKEN_EXPIRY_KEY);

                if (string.IsNullOrEmpty(expiryString))
                    return null;

                if (DateTime.TryParse(expiryString, out var expiry))
                    return expiry;

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting expiration");
                return null;
            }
        }

        public Guid? GetCurrentUserId()
        {
            try
            {
                var token = GetToken();

                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogDebug("No JWT token for user ID extraction");
                    return null;
                }

                var handler = new JwtSecurityTokenHandler();
                var jwtToken = handler.ReadJwtToken(token);

                var userIdClaim = jwtToken.Claims.FirstOrDefault(c =>
                    c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier" ||
                    c.Type == ClaimTypes.NameIdentifier ||
                    c.Type == "sub" ||
                    c.Type == "nameid" ||
                    c.Type == "userId" ||
                    c.Type == "uid"
                );

                if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out Guid userId))
                {
                    _logger.LogDebug("User ID extracted: {UserId}", userId);
                    return userId;
                }

                foreach (var claim in jwtToken.Claims)
                {
                    if (Guid.TryParse(claim.Value, out Guid guidValue))
                    {
                        _logger.LogDebug("Found GUID in claim '{ClaimType}': {Guid}", claim.Type, guidValue);
                        return guidValue;
                    }
                }

                _logger.LogWarning("User ID not found in JWT claims");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception extracting user ID from JWT");
                return null;
            }
        }

        public string GetCurrentUsername()
        {
            try
            {
                var token = GetToken();

                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogDebug("No token for username extraction");
                    return string.Empty;
                }

                var handler = new JwtSecurityTokenHandler();
                var jwtToken = handler.ReadJwtToken(token);

                var usernameClaim = jwtToken.Claims.FirstOrDefault(c =>
                    c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name" ||
                    c.Type == ClaimTypes.Name ||
                    c.Type == "unique_name" ||
                    c.Type == "name" ||
                    c.Type == "preferred_username" ||
                    c.Type == "username"
                );

                if (usernameClaim != null)
                {
                    _logger.LogDebug("Username found: {Username}", usernameClaim.Value);
                    return usernameClaim.Value;
                }

                _logger.LogDebug("Username claim not found in JWT");
                return string.Empty;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting username");
                return string.Empty;
            }
        }

        private async Task<string> RefreshTokenAsync()
        {
            try
            {
                var refreshToken = GetRefreshToken();

                if (string.IsNullOrEmpty(refreshToken))
                {
                    _logger.LogWarning("No refresh token available");
                    return null;
                }

                _logger.LogInformation("Attempting token refresh");

                var client = _httpClientFactory.CreateClient("JwtApi");

                // ✅ FIXED: Use new refresh token endpoint
                var request = new { RefreshToken = refreshToken };

                var response = await client.PostAsJsonAsync("api/Auth/refresh-token", request);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Token refresh failed: {StatusCode}", response.StatusCode);
                    ClearTokens();
                    return null;
                }

                var result = await response.Content.ReadFromJsonAsync<RefreshTokenResponse>();

                if (result != null && !string.IsNullOrEmpty(result.Token))
                {
                    _logger.LogInformation("✅ Token refreshed successfully");

                    SetToken(result.Token);

                    // ✅ FIXED: Store new refresh token
                    if (!string.IsNullOrEmpty(result.RefreshToken))
                    {
                        SetRefreshToken(result.RefreshToken);
                        _logger.LogInformation("✅ New refresh token stored");
                    }

                    return result.Token;
                }

                _logger.LogError("Token refresh returned null");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception during token refresh");
                return null;
            }
        }
        public void ClearTokens()
        {
            try
            {
                _httpContextAccessor.HttpContext?.Session.Remove(JWT_TOKEN_KEY);
                _httpContextAccessor.HttpContext?.Session.Remove(REFRESH_TOKEN_KEY);
                _httpContextAccessor.HttpContext?.Session.Remove(TOKEN_EXPIRY_KEY);
                _logger.LogInformation("All tokens cleared");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing tokens");
            }
        }

        public bool IsAuthenticated()
        {
            var token = GetToken();
            return !string.IsNullOrEmpty(token);
        }

        public bool ShouldLogoutDueToExpiry()
        {
            try
            {
                var token = _httpContextAccessor.HttpContext?.Session.GetString(JWT_TOKEN_KEY);

                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogDebug("No token - should logout");
                    return true;
                }

                if (IsTokenExpired())
                {
                    _logger.LogDebug("Token expired - should logout");
                    return true;
                }

                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking logout condition");
                return true;
            }
        }

        public int GetRemainingTokenMinutes()
        {
            try
            {
                var expiryString = _httpContextAccessor.HttpContext?.Session.GetString(TOKEN_EXPIRY_KEY);

                if (string.IsNullOrEmpty(expiryString))
                    return 0;

                if (DateTime.TryParse(expiryString, out var expiry))
                {
                    var remaining = expiry - DateTime.UtcNow;
                    return Math.Max(0, (int)remaining.TotalMinutes);
                }

                return 0;
            }
            catch
            {
                return 0;
            }
        }
    }

    public class RefreshTokenResponse
    {
        public string Token { get; set; }
        public string RefreshToken { get; set; }
        public DateTime Expiration { get; set; }
    }
}