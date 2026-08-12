using ServiceMaintenance.Configuration;
using ServiceMaintenance.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.BISServices
{
    /// <summary>
    /// Client service for the GET /api/spareparts/usage endpoint.
    /// </summary>
    public class SparepartUsageService
    {
        private readonly HttpClient _httpClient;
        private const string ApiEndpoint = "/api/spareparts/usage";

        public SparepartUsageService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<PaginatedResult<SparepartUsageSummary>> GetSparepartUsageAsync(
            int pageNumber = 1,
            int pageSize = 15,
            DateTime? fromDate = null,
            DateTime? toDate = null,
            string searchTerm = null,
            string status = null,
            string sortBy = "usedquantity",
            bool sortDescending = true,
            bool includeManualStockOut = true,
            string serviceType = null,
            string condition = null,
            string sourceFilter = null,   // ← NEW: "Service" | "Manual" | null
            string dateMode = "standard")
        {
            try
            {
                var queryParams = new List<string>
                {
                    $"pageNumber={pageNumber}",
                    $"pageSize={pageSize}",
                    $"sortDescending={sortDescending}",
                    $"includeManualStockOut={includeManualStockOut}",
                    $"dateMode={dateMode}",
                    "api-version=1.0"
                };

                if (fromDate.HasValue)
                    queryParams.Add($"fromDate={fromDate.Value:yyyy-MM-dd}");
                if (toDate.HasValue)
                    queryParams.Add($"toDate={toDate.Value:yyyy-MM-dd}");
                if (!string.IsNullOrWhiteSpace(searchTerm))
                    queryParams.Add($"searchTerm={Uri.EscapeDataString(searchTerm)}");
                if (!string.IsNullOrWhiteSpace(status))
                    queryParams.Add($"status={Uri.EscapeDataString(status)}");
                if (!string.IsNullOrWhiteSpace(sortBy))
                    queryParams.Add($"sortBy={sortBy}");
                if (!string.IsNullOrWhiteSpace(serviceType))
                    queryParams.Add($"serviceType={Uri.EscapeDataString(serviceType)}");
                if (!string.IsNullOrWhiteSpace(condition))
                    queryParams.Add($"condition={Uri.EscapeDataString(condition)}");
                if (!string.IsNullOrWhiteSpace(sourceFilter))
                    queryParams.Add($"sourceFilter={Uri.EscapeDataString(sourceFilter)}"); // ← NEW

                var queryString = string.Join("&", queryParams);
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiEndpoint}?{queryString}");

                Console.WriteLine($"[SparepartUsageService] GET {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

                if (content.Contains("\"items\"") && content.Contains("\"totalCount\""))
                {
                    var paged = JsonSerializer.Deserialize<SparepartUsageApiResponse>(content, options);
                    return new PaginatedResult<SparepartUsageSummary>
                    {
                        Items = paged?.Items ?? new List<SparepartUsageSummary>(),
                        TotalCount = paged?.TotalCount ?? 0,
                        TotalUsedQuantity = paged?.TotalUsedQuantity ?? 0,
                        TotalServiceUsedQuantity = paged?.TotalServiceUsedQuantity ?? 0, // ← NEW
                        TotalManualUsedQuantity = paged?.TotalManualUsedQuantity ?? 0,  // ← NEW
                        PageNumber = pageNumber,
                        PageSize = pageSize,
                        TotalPages = paged != null && paged.TotalCount > 0
                                                       ? (int)Math.Ceiling(paged.TotalCount / (double)pageSize)
                                                       : 0
                    };
                }

                // Fallback: plain list response
                var list = JsonSerializer.Deserialize<List<SparepartUsageSummary>>(content, options)
                           ?? new List<SparepartUsageSummary>();

                return new PaginatedResult<SparepartUsageSummary>
                {
                    Items = list,
                    TotalCount = list.Count,
                    TotalUsedQuantity = list.Sum(x => x.UsedQuantity),
                    TotalServiceUsedQuantity = list.Sum(x => x.ServiceUsedQty),  // ← NEW
                    TotalManualUsedQuantity = list.Sum(x => x.ManualUsedQty),   // ← NEW
                    PageNumber = pageNumber,
                    PageSize = pageSize,
                    TotalPages = list.Count > 0
                                                   ? (int)Math.Ceiling(list.Count / (double)pageSize)
                                                   : 0
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SparepartUsageService] Error: {ex.Message}");
                throw;
            }
        }
    }

    // ── API response wrapper ──────────────────────────────────────────────
    public class SparepartUsageApiResponse
    {
        public List<SparepartUsageSummary> Items { get; set; }
        public int TotalCount { get; set; }
        public int TotalUsedQuantity { get; set; }
        public int TotalServiceUsedQuantity { get; set; }  // ← NEW
        public int TotalManualUsedQuantity { get; set; }   // ← NEW
    }
}