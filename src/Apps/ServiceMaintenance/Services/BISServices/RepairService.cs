using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.BISServices
{
    public class RepairService
    {
        private readonly HttpClient _httpClient;
        private const string ApiUrl = "/api/repairitem";

        public RepairService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task RepairAsync(RepairItemRequest request)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiUrl);
            var response = await _httpClient.PostAsJsonAsync(fullUrl, request);

            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Failed to set awaiting customer confirmation. Status: {response.StatusCode}, Response: {responseContent}");
            }
        }
    }
}