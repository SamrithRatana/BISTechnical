using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.BISServices
{
    public class ServiceSparePart
    {
        private readonly HttpClient _httpClient;
        private const string ApiEndpoint = "/api/spareparts";

        public ServiceSparePart(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        private string BuildUrl(string endpoint)
        {
            return ApiConfiguration.BuildTechnicalServicesUrl(endpoint);
        }

        // NEW: Get paginated spare parts for the grid
        public async Task<PaginatedResult<SparePartObject>> GetSparePartsPagedAsync(int pageNumber = 1, int pageSize = 10)
        {
            try
            {
                var fullUrl = BuildUrl($"{ApiEndpoint}?pageNumber={pageNumber}&pageSize={pageSize}");
                Console.WriteLine($"Fetching spare parts: {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Response preview: {responseContent.Substring(0, Math.Min(200, responseContent.Length))}...");

                PaginatedSparePartsApiResponse paginatedSpareParts = null;
                List<SparePartObject> items = null;
                int totalCount = 0;

                try
                {
                    if (responseContent.Contains("\"items\"") && responseContent.Contains("\"totalCount\""))
                    {
                        paginatedSpareParts = JsonSerializer.Deserialize<PaginatedSparePartsApiResponse>(responseContent, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        items = paginatedSpareParts?.Items;
                        totalCount = paginatedSpareParts?.TotalCount ?? 0;
                        Console.WriteLine($"Parsed as PaginatedSparePartsApiResponse. Items: {items?.Count}, Total: {totalCount}");
                    }
                    else
                    {
                        items = JsonSerializer.Deserialize<List<SparePartObject>>(responseContent, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        totalCount = items?.Count ?? 0;
                        Console.WriteLine($"Parsed as List<SparePartObject>. Items: {items?.Count}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Deserialization error: {ex.Message}");
                    throw;
                }

                return new PaginatedResult<SparePartObject>
                {
                    Items = items ?? new List<SparePartObject>(),
                    TotalCount = totalCount,
                    PageNumber = pageNumber,
                    PageSize = pageSize,
                    TotalPages = totalCount > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 0
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetSparePartsPagedAsync: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                throw;
            }
        }

        // ── Manual Stock Out ──────────────────────────────────────────────────────
        public async Task<bool> InsertManualStockOutAsync(ManualStockOutObject model)
        {
            try
            {
                var fullUrl = BuildUrl($"{ApiEndpoint}/manual-stockout");

                var response = await _httpClient.PostAsJsonAsync(fullUrl, new
                {
                    sparepartId = model.SparepartId,
                    quantity = model.Quantity,
                    reason = model.Reason,
                    performedBy = model.PerformedBy
                });

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    throw new Exception(error);
                }

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"InsertManualStockOutAsync error: {ex.Message}");
                throw;
            }
        }

        // ── Remarks (SparepartItem) ──────────────────────────────────────────────
        // ✅ NEW: POST-only update of the Remarks field on a single SparepartItem row,
        // identified by its own Id (NOT SparepartId). Independent of the service/
        // inspect flow — safe to call any time after the item exists, and does not
        // touch Quantity/SparepartId/Condition/IsHoldStatus, so it never triggers
        // stock adjustment logic on the backend.
        public async Task<bool> UpdateSparepartItemRemarksAsync(Guid sparepartItemId, string remarks)
        {
            try
            {
                var fullUrl = BuildUrl($"{ApiEndpoint}/items/{sparepartItemId}/remarks");
                Console.WriteLine($"Updating remarks: {fullUrl}");

                var response = await _httpClient.PostAsJsonAsync(fullUrl, new
                {
                    remarks = remarks
                });

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"UpdateSparepartItemRemarksAsync failed: {response.StatusCode} — {error}");
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"UpdateSparepartItemRemarksAsync error: {ex.Message}");
                throw;
            }
        }

        // NEW: Search spare parts with pagination and filtering
        public async Task<PaginatedResult<SparePartObject>> SearchSparePartsAsync(
            int pageNumber = 1,
            int pageSize = 10,
            string searchTerm = null,
            string sortBy = "PartName",
            bool sortDescending = false)
        {
            try
            {
                var queryParams = new List<string>
                {
                    $"pageNumber={pageNumber}",
                    $"pageSize={pageSize}"
                };

                if (!string.IsNullOrEmpty(searchTerm))
                    queryParams.Add($"searchTerm={Uri.EscapeDataString(searchTerm)}");

                if (!string.IsNullOrEmpty(sortBy))
                    queryParams.Add($"sortBy={sortBy}");

                queryParams.Add($"sortDescending={sortDescending}");

                var queryString = string.Join("&", queryParams);
                var fullUrl = BuildUrl($"{ApiEndpoint}/search?{queryString}");

                Console.WriteLine($"Searching spare parts: {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();

                PaginatedSparePartsApiResponse paginatedSpareParts = null;

                if (responseContent.Contains("\"items\"") && responseContent.Contains("\"totalCount\""))
                {
                    paginatedSpareParts = JsonSerializer.Deserialize<PaginatedSparePartsApiResponse>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }
                else
                {
                    var items = JsonSerializer.Deserialize<List<SparePartObject>>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    paginatedSpareParts = new PaginatedSparePartsApiResponse
                    {
                        Items = items,
                        TotalCount = items?.Count ?? 0
                    };
                }

                return new PaginatedResult<SparePartObject>
                {
                    Items = paginatedSpareParts?.Items ?? new List<SparePartObject>(),
                    TotalCount = paginatedSpareParts?.TotalCount ?? 0,
                    PageNumber = pageNumber,
                    PageSize = pageSize,
                    TotalPages = paginatedSpareParts != null && paginatedSpareParts.TotalCount > 0
                        ? (int)Math.Ceiling(paginatedSpareParts.TotalCount / (double)pageSize)
                        : 0
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in SearchSparePartsAsync: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                throw;
            }
        }

        // EXISTING: Get all spare parts (keep for backward compatibility)
        public async Task<List<SparePartObject>> GetAllSparePartsAsync()
        {
            try
            {
                var fullUrl = BuildUrl(ApiEndpoint);
                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                List<SparePartObject> items = null;

                if (responseContent.Contains("\"items\"") && responseContent.Contains("\"totalCount\""))
                {
                    var paginatedResponse = JsonSerializer.Deserialize<PaginatedSparePartsApiResponse>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    items = paginatedResponse?.Items;
                }
                else
                {
                    items = JsonSerializer.Deserialize<List<SparePartObject>>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }

                return items ?? new List<SparePartObject>();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetAllSparePartsAsync: {ex.Message}");
                return new List<SparePartObject>();
            }
        }

        public async Task<List<string>> SearchItemNamesAsync(string searchTerm, int pageSize = 10)
        {
            try
            {
                var queryParams = new List<string>
                {
                    $"pageNumber=1",
                    $"pageSize={pageSize}"
                };

                if (!string.IsNullOrEmpty(searchTerm))
                    queryParams.Add($"searchTerm={Uri.EscapeDataString(searchTerm)}");

                var queryString = string.Join("&", queryParams);
                var fullUrl = BuildUrl($"{ApiEndpoint}/search?{queryString}");

                Console.WriteLine($"Searching item names: {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                PaginatedSparePartsApiResponse paginatedSpareParts = null;

                if (responseContent.Contains("\"items\"") && responseContent.Contains("\"totalCount\""))
                {
                    paginatedSpareParts = JsonSerializer.Deserialize<PaginatedSparePartsApiResponse>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }
                else
                {
                    var items = JsonSerializer.Deserialize<List<SparePartObject>>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    paginatedSpareParts = new PaginatedSparePartsApiResponse
                    {
                        Items = items,
                        TotalCount = items?.Count ?? 0
                    };
                }

                // Extract unique item names from the results
                var itemNames = paginatedSpareParts?.Items?
                    .Select(sp => sp.ItemName?.Trim())
                    .Where(name => !string.IsNullOrEmpty(name))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList() ?? new List<string>();

                return itemNames;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in SearchItemNamesAsync: {ex.Message}");
                return new List<string>();
            }
        }

        public async Task<List<string>> GetSerialNumbersByPrefixAsync(string prefix, int pageSize = 100)
        {
            try
            {
                var queryParams = new List<string>
                {
                    $"pageNumber=1",
                    $"pageSize={pageSize}",
                    $"searchTerm={Uri.EscapeDataString(prefix)}"
                };

                var queryString = string.Join("&", queryParams);
                var fullUrl = BuildUrl($"{ApiEndpoint}/search?{queryString}");

                Console.WriteLine($"Searching serial numbers: {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                PaginatedSparePartsApiResponse paginatedSpareParts = null;

                if (responseContent.Contains("\"items\"") && responseContent.Contains("\"totalCount\""))
                {
                    paginatedSpareParts = JsonSerializer.Deserialize<PaginatedSparePartsApiResponse>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }
                else
                {
                    var items = JsonSerializer.Deserialize<List<SparePartObject>>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    paginatedSpareParts = new PaginatedSparePartsApiResponse
                    {
                        Items = items,
                        TotalCount = items?.Count ?? 0
                    };
                }

                // Extract serial numbers that match the prefix
                var serialNumbers = paginatedSpareParts?.Items?
                    .Select(sp => sp.SerialNumber)
                    .Where(sn => !string.IsNullOrEmpty(sn) && sn.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    .ToList() ?? new List<string>();

                return serialNumbers;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting serial numbers by prefix: {ex.Message}");
                return new List<string>();
            }
        }

        public async Task<SparePartObject> GetSparePartByIdAsync(Guid id)
        {
            var fullUrl = BuildUrl($"{ApiEndpoint}/{id}");
            var response = await _httpClient.GetAsync(fullUrl);

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }

            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<SparePartObject>();
        }

        public async Task CreateSparePartAsync(SparePartObject sparePart)
        {
            var fullUrl = BuildUrl(ApiEndpoint);
            var response = await _httpClient.PostAsJsonAsync(fullUrl, sparePart);
            response.EnsureSuccessStatusCode();
        }

        // ── Update ─────────────────────────────────────────────────────────────
        // REPLACES the previous single-parameter version — kept as a thin wrapper
        // so any existing callers that don't pass a user still compile unchanged.
        public async Task UpdateSparePartAsync(SparePartObject sparePart)
            => await UpdateSparePartAsync(sparePart, Guid.Empty);

        // ✅ NEW overload — pass the current user's id so the API can call
        // sp_set_session_context before SaveChangesAsync, letting
        // trg_Spareparts_AuditQuantity write a real PerformedBy instead of NULL.
        public async Task UpdateSparePartAsync(SparePartObject sparePart, Guid performedBy)
        {
            var fullUrl = BuildUrl(ApiEndpoint);
            var payload = new
            {
                sparePart.Id,
                sparePart.ItemName,
                sparePart.SerialNumber,
                sparePart.Description,
                sparePart.UseFor,
                sparePart.PictureUrl,
                sparePart.LinkItemId,
                sparePart.Quantity,
                sparePart.DefaultPrice,
                PerformedBy = performedBy
            };
            var response = await _httpClient.PutAsJsonAsync(fullUrl, payload);
            response.EnsureSuccessStatusCode();
        }

        public async Task DeleteSparePartAsync(Guid id)
        {
            var fullUrl = BuildUrl($"{ApiEndpoint}/{id}");
            var response = await _httpClient.DeleteAsync(fullUrl);
            response.EnsureSuccessStatusCode();
        }

        public async Task<List<SparePartObject>> GetSparePartsUsedInServicesAsync()
        {
            try
            {
                var fullUrl = BuildUrl($"{ApiEndpoint}/used-in-services");
                Console.WriteLine($"Fetching: {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();

                // ✅ Deserialize as SparepartWithUsage then map to SparePartObject
                var items = JsonSerializer.Deserialize<List<SparepartWithUsageDto>>(content,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                // Map to SparePartObject (includes UsageCount + TotalQtyUsed)
                var result = items?.Select(x => new SparePartObject
                {
                    Id = x.Id,
                    ItemName = x.ItemName,
                    SerialNumber = x.SerialNumber,
                    Description = x.Description,
                    UseFor = x.UseFor,
                    PictureUrl = x.PictureUrl,
                    LinkItemId = x.LinkItemId,
                    Quantity = x.Quantity,
                    UsageCount = x.UsageCount,
                    TotalQtyUsed = x.TotalQtyUsed
                }).ToList();

                Console.WriteLine($"Spareparts used in services: {result?.Count}");
                return result ?? new List<SparePartObject>();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"GetSparePartsUsedInServicesAsync error: {ex.Message}");
                return new List<SparePartObject>();
            }
        }
    }

    public class SparepartWithUsageDto
    {
        public Guid Id { get; set; }
        public string ItemName { get; set; }
        public string SerialNumber { get; set; }
        public string Description { get; set; }
        public string UseFor { get; set; }
        public string PictureUrl { get; set; }
        public Guid LinkItemId { get; set; }
        public int Quantity { get; set; }
        public int UsageCount { get; set; }
        public int TotalQtyUsed { get; set; }
    }

    // Pagination models for SpareParts
    public class PaginatedSparePartsApiResponse
    {
        public List<SparePartObject> Items { get; set; }
        public int TotalCount { get; set; }
    }

    // Helper classes for parsing services response
    public class RepairServicesLite
    {
        public Guid Id { get; set; }
        public List<SparepartItemLite> SparepartItems { get; set; } = new();
    }

    public class SparepartItemLite
    {
        public Guid SparepartId { get; set; }
    }

    public class PaginatedServicesResponse
    {
        public List<RepairServicesLite> Items { get; set; }
        public int TotalCount { get; set; }
    }
}