using ServiceMaintenance.Configuration;
using ServiceMaintenance.Models;

namespace ServiceMaintenance.Services.BISServices
{
    public class FinishItemService
    {
        private readonly HttpClient _httpClient;
       
        public FinishItemService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }
        private string GetFullUrl(string endpoint)
        {
            return ApiConfiguration.BuildTechnicalServicesUrl(endpoint);
        }

        public async Task FinishItemAsync(FinishItemRequest request)
        {
            var fullUrl = GetFullUrl("/api/finishedrepair");
            var response = await _httpClient.PostAsJsonAsync(fullUrl, request);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Failed to set awaiting customer confirmation. Status: {response.StatusCode}, Response: {responseContent}");
            }
        }
    }
}
