using ServiceMaintenance.Configuration;
using ServiceMaintenance.Models;
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.BISServices
{
    public class AwaitingSparePartService
    {
        private readonly HttpClient _httpClient;

        public AwaitingSparePartService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        private string GetFullUrl(string endpoint)
        {
            return ApiConfiguration.BuildTechnicalServicesUrl(endpoint);
        }

        public async Task SetAwaitingSparePartAsync(AwaitingSparePartRequest request)
        {
            var fullUrl = GetFullUrl("/api/awaitingsparepart");
            var response = await _httpClient.PostAsJsonAsync(fullUrl, request);
            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Failed to set awaiting spare part. Status: {response.StatusCode}, Response: {responseContent}");
            }
        }
    }
}