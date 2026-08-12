using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;

namespace ServiceMaintenance.Services.BISServices
{
    public class ThirdPartyRepairService
    {
        private readonly HttpClient _httpClient;
        private const string ApiEndpoint = "/api/thirdpartyrepair";

        public ThirdPartyRepairService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        private string BuildUrl(string endpoint)
        {
            return ApiConfiguration.BuildTechnicalServicesUrl(endpoint);
        }

        public async Task SetThirdPartyRepairAsync(ThirdPartyRepairRequest request)
        {
            var fullUrl = BuildUrl(ApiEndpoint);
            var response = await _httpClient.PostAsJsonAsync(fullUrl, request);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Failed to set third party repair. Status: {response.StatusCode}, Response: {responseContent}");
            }
        }
    }
}