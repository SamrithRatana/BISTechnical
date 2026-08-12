using ServiceMaintenance.Configuration;
using ServiceMaintenance.Models;
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.BISServices
{
    public class SentSparepartsService
    {
        private readonly HttpClient _httpClient;

        public SentSparepartsService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        private string GetFullUrl(string endpoint)
        {
            return ApiConfiguration.BuildTechnicalServicesUrl(endpoint);
        }

        public async Task SetSentSparepartsAsync(Guid id, Guid setSentSparepartsBy)
        {
            var request = new SentSparepartsRequest
            {
                Id = id,
                SetSentSparepartsBy = setSentSparepartsBy
            };

            var fullUrl = GetFullUrl("/api/sentspareparts");
            var response = await _httpClient.PostAsJsonAsync(fullUrl, request);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException(
                    $"Failed to set Sent Spareparts. Status: {response.StatusCode}, Response: {responseContent}");
            }
        }
    }
}