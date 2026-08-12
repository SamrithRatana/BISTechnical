// File: ServiceMaintenance/Middleware/TokenExpiryMiddleware.cs
// REPLACE entire file with this:

using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using ServiceMaintenance.Services.JWT;

namespace ServiceMaintenance.Middleware
{
    /// <summary>
    /// ✅ FIXED: Handle both Web and API requests differently
    /// </summary>
    public class TokenExpiryMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<TokenExpiryMiddleware> _logger;

        public TokenExpiryMiddleware(RequestDelegate next, ILogger<TokenExpiryMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, JwtSessionService jwtSession)
        {
            var path = context.Request.Path.Value?.ToLower() ?? "";

            // Skip token check for public paths
            bool isPublicPath = path.StartsWith("/identity/account/login") ||
                               path.StartsWith("/identity/account/register") ||
                               path.StartsWith("/identity/account/logout") ||
                               path.Contains("/lib/") ||
                               path.Contains("/css/") ||
                               path.Contains("/js/") ||
                               path.Contains("/favicon");

            if (!isPublicPath && context.User.Identity?.IsAuthenticated == true)
            {
                if (jwtSession.ShouldLogoutDueToExpiry())
                {
                    _logger.LogWarning($"🚪 Token expired for user on path: {path}");

                    // Clear tokens
                    jwtSession.ClearTokens();

                    // ✅ FIXED: Different handling for API vs Web
                    if (path.StartsWith("/api/"))
                    {
                        // For API requests: return 401 JSON response
                        context.Response.StatusCode = 401;
                        context.Response.ContentType = "application/json";
                        await context.Response.WriteAsJsonAsync(new
                        {
                            Status = "Error",
                            Message = "Token expired. Please refresh your token or login again.",
                            ErrorCode = "TOKEN_EXPIRED"
                        });
                        return;
                    }
                    else
                    {
                        // For Web requests: redirect to login
                        context.Response.Redirect("/Identity/Account/Login?expired=true");
                        return;
                    }
                }
            }

            await _next(context);
        }
    }
}