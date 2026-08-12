using ServiceMaintenance.Configuration;
using ServiceMaintenance.Models;
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.BISServices
{
    public class AwaitingCustomerConfirmService
    {
        private readonly HttpClient _httpClient;
      

        public AwaitingCustomerConfirmService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        private string GetFullUrl(string endpoint)
        {
            return ApiConfiguration.BuildTechnicalServicesUrl(endpoint);
        }

        public async Task SetAwaitingCustomerConfirmAsync(AwaitingCustomerConfirmRequest request)
        {
            var fullUrl = GetFullUrl("/api/awaitingcustomerConfirm");
            var response = await _httpClient.PostAsJsonAsync(fullUrl, request);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Failed to set awaiting customer confirmation. Status: {response.StatusCode}, Response: {responseContent}");
            }
        }
    }
}
