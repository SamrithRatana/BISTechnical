using ServiceMaintenance.Configuration;
using ServiceMaintenance.Models;
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
namespace ServiceMaintenance.Services.BISServices
{
    public class CustomerRejectedService
    {
        private readonly HttpClient _httpClient;


        public CustomerRejectedService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        private string GetFullUrl(string endpoint)
        {
            return ApiConfiguration.BuildTechnicalServicesUrl(endpoint);
        }

        public async Task SetCustomerRejectedAsync(CustomerRejectedRequest request)
        {
            var fullUrl = GetFullUrl("/api/customerrejected");
            var response = await _httpClient.PostAsJsonAsync(fullUrl, request);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Failed to set customer rejection. Status: {response.StatusCode}, Response: {responseContent}");
            }
        }
    }
}
