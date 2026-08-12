using ServiceMaintenance.Configuration;
using ServiceMaintenance.Models;
using System.Net.Http.Json;

namespace ServiceMaintenance.Services.BISServices
{
    public class InspectingService
    {
        private readonly HttpClient _httpClient;

        public InspectingService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        private string GetFullUrl(string endpoint)
        {
            return ApiConfiguration.BuildTechnicalServicesUrl(endpoint);
        }

        public async Task SetInspectingAsync(SetInspectingRequest request)
        {
            var fullUrl = GetFullUrl("/api/inspecting");
            var response = await _httpClient.PostAsJsonAsync(fullUrl, request);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException(
                    $"Failed to set Inspecting status. Status: {response.StatusCode}, Response: {responseContent}");
            }
        }
    }
}