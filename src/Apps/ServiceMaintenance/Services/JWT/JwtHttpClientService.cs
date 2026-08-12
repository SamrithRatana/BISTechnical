using System.Net.Http.Headers;
using Microsoft.Extensions.Logging;

namespace ServiceMaintenance.Services.JWT
{
    /// <summary>
    /// Service to create authenticated HTTP clients with JWT tokens
    /// Use this when calling external APIs that require JWT authentication
    /// </summary>
    public class JwtHttpClientService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly JwtSessionService _jwtSessionService;
        private readonly ILogger<JwtHttpClientService> _logger;

        public JwtHttpClientService(
            IHttpClientFactory httpClientFactory,
            JwtSessionService jwtSessionService,
            ILogger<JwtHttpClientService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _jwtSessionService = jwtSessionService;
            _logger = logger;
        }

        /// <summary>
        /// Get an HTTP client with JWT token in Authorization header
        /// Automatically refreshes token if expiring soon
        /// </summary>
        public async Task<HttpClient> GetAuthenticatedClientAsync(string clientName = "JwtApi")
        {
            try
            {
                var client = _httpClientFactory.CreateClient(clientName);

                // Get token and refresh if needed
                var token = await _jwtSessionService.GetOrRefreshTokenAsync();

                if (string.IsNullOrEmpty(token))
                {
                    _logger.LogWarning("No valid JWT token available for authenticated request");
                    return client; // Return client without auth header
                }

                // Set Authorization header
                client.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", token);

                _logger.LogDebug("HTTP client configured with JWT token");

                return client;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating authenticated HTTP client");
                return _httpClientFactory.CreateClient(clientName); // Return client without auth
            }
        }

        /// <summary>
        /// Make a GET request with JWT authentication
        /// </summary>
        public async Task<HttpResponseMessage> GetAsync(string url, string clientName = "JwtApi")
        {
            var client = await GetAuthenticatedClientAsync(clientName);
            return await client.GetAsync(url);
        }

        /// <summary>
        /// Make a POST request with JWT authentication
        /// </summary>
        public async Task<HttpResponseMessage> PostAsync(
            string url,
            HttpContent content,
            string clientName = "JwtApi")
        {
            var client = await GetAuthenticatedClientAsync(clientName);
            return await client.PostAsync(url, content);
        }

        /// <summary>
        /// Make a PUT request with JWT authentication
        /// </summary>
        public async Task<HttpResponseMessage> PutAsync(
            string url,
            HttpContent content,
            string clientName = "JwtApi")
        {
            var client = await GetAuthenticatedClientAsync(clientName);
            return await client.PutAsync(url, content);
        }

        /// <summary>
        /// Make a DELETE request with JWT authentication
        /// </summary>
        public async Task<HttpResponseMessage> DeleteAsync(string url, string clientName = "JwtApi")
        {
            var client = await GetAuthenticatedClientAsync(clientName);
            return await client.DeleteAsync(url);
        }

        /// <summary>
        /// Check if user has valid JWT authentication
        /// </summary>
        public bool IsAuthenticated()
        {
            return _jwtSessionService.IsAuthenticated();
        }

        /// <summary>
        /// Get token expiration time
        /// </summary>
        public DateTime? GetTokenExpiration()
        {
            return _jwtSessionService.GetTokenExpiration();
        }
    }
}