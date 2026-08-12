namespace ServiceMaintenance.Configuration
{
    /// <summary>
    /// Centralized API configuration for all services
    /// </summary>
    public static class ApiConfiguration
    {

        /// <summary>
        /// Technical Services API Base URL
        /// Change this URL to affect ALL technical service classes
        /// </summary>
        public const string TechnicalServicesBaseUrl = "https://technicalservicesapi.camprotec.com.kh";

        /// <summary>
        /// Customer API Base URL
        /// </summary>
        public const string CustomerApiBaseUrl = "https://customerapi.camprotec.com.kh";

        /// <summary>
        /// JWT/User API Base URL
        /// </summary>
        public const string JwtApiBaseUrl = "https://user.camprotec.com.kh";

        // ========================================
        // API VERSION
        // ========================================

        /// <summary>
        /// Default API version for all endpoints
        /// </summary>
        public const string ApiVersion = "1.0";

        // ========================================
        // HELPER METHODS
        // ========================================

        /// <summary>
        /// Builds a full URL with API version
        /// </summary>
        /// <param name="baseUrl">Base URL</param>
        /// <param name="endpoint">API endpoint</param>
        /// <returns>Complete URL with API version</returns>
        public static string BuildUrl(string baseUrl, string endpoint)
        {
            var url = $"{baseUrl}{endpoint}";

            // Add API version if not already present
            if (!url.Contains("api-version"))
            {
                var separator = url.Contains("?") ? "&" : "?";
                url = $"{url}{separator}api-version={ApiVersion}";
            }

            return url;
        }

        /// <summary>
        /// Builds a full URL for Technical Services API
        /// </summary>
        /// <param name="endpoint">API endpoint (e.g., "/api/items")</param>
        /// <returns>Complete URL</returns>
        public static string BuildTechnicalServicesUrl(string endpoint)
        {
            return BuildUrl(TechnicalServicesBaseUrl, endpoint);
        }

        /// <summary>
        /// Builds a full URL for Customer API
        /// </summary>
        /// <param name="endpoint">API endpoint</param>
        /// <returns>Complete URL</returns>
        public static string BuildCustomerApiUrl(string endpoint)
        {
            return BuildUrl(CustomerApiBaseUrl, endpoint);
        }

        /// <summary>
        /// Builds a full URL for JWT/User API
        /// </summary>
        /// <param name="endpoint">API endpoint</param>
        /// <returns>Complete URL</returns>
        public static string BuildJwtApiUrl(string endpoint)
        {
            return BuildUrl(JwtApiBaseUrl, endpoint);
        }
    }
}