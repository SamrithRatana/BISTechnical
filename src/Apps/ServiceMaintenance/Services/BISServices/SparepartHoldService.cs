using ServiceMaintenance.Configuration;
using ServiceMaintenance.Models;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.BISServices
{
    public class SparepartHoldService
    {
        private readonly HttpClient _httpClient;
        private const string ApiEndpoint = "/api/spareparts/hold";

        public SparepartHoldService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<SparepartHoldResult> GetSparepartHoldAsync(
            int pageNumber = 1,
            int pageSize = 15,
            string searchTerm = null,
            string status = null,
            string serviceType = null,
            string sortBy = "holdqty",
            bool sortDescending = true)
        {
            try
            {
                var queryParams = new List<string>
                {
                    $"pageNumber={pageNumber}",
                    $"pageSize={pageSize}",
                    $"sortDescending={sortDescending}",
                    "api-version=1.0"
                };

                if (!string.IsNullOrWhiteSpace(searchTerm))
                    queryParams.Add($"searchTerm={Uri.EscapeDataString(searchTerm)}");
                if (!string.IsNullOrWhiteSpace(status))
                    queryParams.Add($"status={Uri.EscapeDataString(status)}");
                if (!string.IsNullOrWhiteSpace(serviceType))
                    queryParams.Add($"serviceType={Uri.EscapeDataString(serviceType)}");
                if (!string.IsNullOrWhiteSpace(sortBy))
                    queryParams.Add($"sortBy={sortBy}");

                var queryString = string.Join("&", queryParams);
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(
                    $"{ApiEndpoint}?{queryString}");

                Console.WriteLine($"[SparepartHoldService] GET {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var apiResponse = JsonSerializer.Deserialize<SparepartHoldApiResponse>(
                    content, options);

                return new SparepartHoldResult
                {
                    Items = apiResponse?.Items ?? new List<SparepartHoldSummary>(),
                    TotalCount = apiResponse?.TotalCount ?? 0,
                    TotalHoldQty = apiResponse?.TotalHoldQty ?? 0,
                    TotalHoldJobs = apiResponse?.TotalHoldJobs ?? 0,
                    PageNumber = pageNumber,
                    PageSize = pageSize,
                    TotalPages = apiResponse != null && apiResponse.TotalCount > 0
                                        ? (int)Math.Ceiling(
                                            apiResponse.TotalCount / (double)pageSize)
                                        : 0
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SparepartHoldService] Error: {ex.Message}");
                throw;
            }
        }
    }

    public class SparepartHoldApiResponse
    {
        public List<SparepartHoldSummary> Items { get; set; }
        public int TotalCount { get; set; }
        public int TotalHoldQty { get; set; }
        public int TotalHoldJobs { get; set; }
    }
}