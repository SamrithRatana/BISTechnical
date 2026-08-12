using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;

namespace ServiceMaintenance.Services.BISServices
{
    public class UnrepairableService
    {
        private readonly HttpClient _httpClient;
        private const string ApiEndpoint = "/api/unrepairable";

        public UnrepairableService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        private string BuildUrl(string endpoint)
        {
            return ApiConfiguration.BuildTechnicalServicesUrl(endpoint);
        }

        public async Task SetUnrepairableAsync(UnrepairableRequest request)
        {
            var fullUrl = BuildUrl(ApiEndpoint);
            var response = await _httpClient.PostAsJsonAsync(fullUrl, request);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Failed to set unrepairable. Status: {response.StatusCode}, Response: {responseContent}");
            }
        }
    }
}