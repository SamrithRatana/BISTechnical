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
    public class ItemService
    {
        private readonly HttpClient _httpClient;
        private const string ApiUrl = "/api/items";

        public ItemService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        // FIXED: Get paginated items for the grid
        public async Task<PaginatedResult<Repairs>> GetItemsPagedAsync(int pageNumber = 1, int pageSize = 10)
        {
            try
            {
                // FIX: Build query string correctly - use "?" not "&"
                var queryParams = new List<string>
                {
                    $"pageNumber={pageNumber}",
                    $"pageSize={pageSize}"
                };

                var queryString = $"?{string.Join("&", queryParams)}";
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiUrl}{queryString}");

                Console.WriteLine($"Fetching: {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Response preview: {responseContent.Substring(0, Math.Min(200, responseContent.Length))}...");

                PaginatedItemsApiResponse paginatedItems = null;
                List<Repairs> items = null;
                int totalCount = 0;

                try
                {
                    if (responseContent.Contains("\"items\"") && responseContent.Contains("\"totalCount\""))
                    {
                        paginatedItems = JsonSerializer.Deserialize<PaginatedItemsApiResponse>(responseContent, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        items = paginatedItems?.Items;
                        totalCount = paginatedItems?.TotalCount ?? 0;
                        Console.WriteLine($"Parsed as PaginatedItemsApiResponse. Items: {items?.Count}, Total: {totalCount}");
                    }
                    else
                    {
                        items = JsonSerializer.Deserialize<List<Repairs>>(responseContent, new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        totalCount = items?.Count ?? 0;
                        Console.WriteLine($"Parsed as List<Repairs>. Items: {items?.Count}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Deserialization error: {ex.Message}");
                    throw;
                }

                return new PaginatedResult<Repairs>
                {
                    Items = items ?? new List<Repairs>(),
                    TotalCount = totalCount,
                    PageNumber = pageNumber,
                    PageSize = pageSize,
                    TotalPages = totalCount > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 0
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetItemsPagedAsync: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                throw;
            }
        }

        // FIXED: Optimized method to get unique item names with search
        public async Task<List<string>> GetUniqueItemNamesAsync(string searchTerm = null, int pageNumber = 1, int pageSize = 50)
        {
            try
            {
                var queryParams = new List<string>();

                if (pageNumber > 0)
                {
                    queryParams.Add($"pageNumber={pageNumber}");
                }

                if (pageSize > 0)
                {
                    queryParams.Add($"pageSize={pageSize}");
                }

                // OPTIMIZATION: Only add searchTerm if it has at least 2 characters
                if (!string.IsNullOrWhiteSpace(searchTerm) && searchTerm.Length >= 2)
                {
                    queryParams.Add($"searchTerm={Uri.EscapeDataString(searchTerm)}");
                }

                // FIX: Use "?" for first parameter, not "&"
                var queryString = queryParams.Count > 0 ? $"?{string.Join("&", queryParams)}" : "";
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/items/unique-names{queryString}");

                Console.WriteLine($"Fetching unique names: {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();

                if (responseContent.Contains("\"items\""))
                {
                    var paginatedResponse = JsonSerializer.Deserialize<UniqueNamesApiResponse>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    var uniqueNames = paginatedResponse?.Items ?? new List<string>();
                    Console.WriteLine($"Loaded {uniqueNames.Count} unique item names (filtered)");
                    return uniqueNames;
                }
                else
                {
                    var uniqueNames = JsonSerializer.Deserialize<List<string>>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    Console.WriteLine($"Loaded {uniqueNames?.Count ?? 0} unique item names");
                    return uniqueNames ?? new List<string>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetUniqueItemNamesAsync: {ex.Message}");
                return new List<string>();
            }
        }

        // FIXED: Optimized method to get unique item types with search
        public async Task<List<string>> GetUniqueItemTypesAsync(string searchTerm = null, int pageNumber = 1, int pageSize = 50)
        {
            try
            {
                var queryParams = new List<string>();

                if (pageNumber > 0)
                {
                    queryParams.Add($"pageNumber={pageNumber}");
                }

                if (pageSize > 0)
                {
                    queryParams.Add($"pageSize={pageSize}");
                }

                // OPTIMIZATION: Only add searchTerm if it has at least 2 characters
                if (!string.IsNullOrWhiteSpace(searchTerm) && searchTerm.Length >= 2)
                {
                    queryParams.Add($"searchTerm={Uri.EscapeDataString(searchTerm)}");
                }

                // FIX: Use "?" for first parameter, not "&"
                var queryString = queryParams.Count > 0 ? $"?{string.Join("&", queryParams)}" : "";
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/items/unique-types{queryString}");

                Console.WriteLine($"Fetching unique types: {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();

                if (responseContent.Contains("\"items\""))
                {
                    var paginatedResponse = JsonSerializer.Deserialize<UniqueTypesApiResponse>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    var uniqueTypes = paginatedResponse?.Items ?? new List<string>();
                    Console.WriteLine($"Loaded {uniqueTypes.Count} unique item types (filtered)");
                    return uniqueTypes;
                }
                else
                {
                    var uniqueTypes = JsonSerializer.Deserialize<List<string>>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    Console.WriteLine($"Loaded {uniqueTypes?.Count ?? 0} unique item types");
                    return uniqueTypes ?? new List<string>();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetUniqueItemTypesAsync: {ex.Message}");
                return new List<string>();
            }
        }

        // FIXED: Search items with pagination and filtering
        public async Task<PaginatedResult<Repairs>> SearchItemsAsync(
            int pageNumber = 1,
            int pageSize = 10,
            string searchTerm = null,
            string itemType = null,
            string sortBy = "ItemName",
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

                if (!string.IsNullOrEmpty(itemType))
                    queryParams.Add($"itemType={Uri.EscapeDataString(itemType)}");

                if (!string.IsNullOrEmpty(sortBy))
                    queryParams.Add($"sortBy={sortBy}");

                queryParams.Add($"sortDescending={sortDescending}");

                // FIX: Use "?" for first parameter, not "&"
                var queryString = $"?{string.Join("&", queryParams)}";
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/items/search{queryString}");

                Console.WriteLine($"Searching items: {fullUrl}");

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();

                PaginatedItemsApiResponse paginatedItems = null;

                if (responseContent.Contains("\"items\"") && responseContent.Contains("\"totalCount\""))
                {
                    paginatedItems = JsonSerializer.Deserialize<PaginatedItemsApiResponse>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }
                else
                {
                    var items = JsonSerializer.Deserialize<List<Repairs>>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    paginatedItems = new PaginatedItemsApiResponse
                    {
                        Items = items,
                        TotalCount = items?.Count ?? 0
                    };
                }

                return new PaginatedResult<Repairs>
                {
                    Items = paginatedItems?.Items ?? new List<Repairs>(),
                    TotalCount = paginatedItems?.TotalCount ?? 0,
                    PageNumber = pageNumber,
                    PageSize = pageSize,
                    TotalPages = paginatedItems != null && paginatedItems.TotalCount > 0
                        ? (int)Math.Ceiling(paginatedItems.TotalCount / (double)pageSize)
                        : 0
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in SearchItemsAsync: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                throw;
            }
        }

        public async Task<IEnumerable<Repairs>> GetItemsAsync()
        {
            try
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiUrl);
                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                List<Repairs> items = null;

                if (responseContent.Contains("\"items\"") && responseContent.Contains("\"totalCount\""))
                {
                    var paginatedResponse = JsonSerializer.Deserialize<PaginatedItemsApiResponse>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    items = paginatedResponse?.Items;
                }
                else
                {
                    items = JsonSerializer.Deserialize<List<Repairs>>(responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }

                return items ?? new List<Repairs>();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetItemsAsync: {ex.Message}");
                return new List<Repairs>();
            }
        }

        public async Task<Repairs> GetItemByIdAsync(Guid id)
        {
            var allItems = await GetItemsAsync();
            var item = allItems?.FirstOrDefault(i => i.Id == id);
            if (item == null)
            {
                throw new KeyNotFoundException($"Item with ID {id} was not found.");
            }
            return item;
        }

        public async Task<Repairs> GetItemBySerialNumberAsync(string serialNumber)
        {
            var allItems = await GetItemsAsync();
            var item = allItems?.FirstOrDefault(i => i.SerialNumber.Equals(serialNumber, StringComparison.OrdinalIgnoreCase));
            if (item == null)
            {
                throw new KeyNotFoundException($"Item with Serial Number {serialNumber} was not found.");
            }
            return item;
        }

        public async Task CreateItemAsync(Repairs item)
        {
            if (!await IsSerialNumberUniqueAsync(item.SerialNumber))
            {
                throw new InvalidOperationException("Serial number must be unique.");
            }
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiUrl);
            var response = await _httpClient.PostAsJsonAsync(fullUrl, item);
            response.EnsureSuccessStatusCode();
        }

        public async Task UpdateItemAsync(Repairs item)
        {
            if (!await IsSerialNumberUniqueAsync(item.SerialNumber, item.Id))
            {
                throw new InvalidOperationException("Serial number must be unique.");
            }
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiUrl);
            var response = await _httpClient.PutAsJsonAsync(fullUrl, item);
            response.EnsureSuccessStatusCode();
        }

        public async Task UpdateItemNameBySerialNumberAsync(string serialNumber, string newItemName)
        {
            try
            {
                var existingItem = await GetItemBySerialNumberAsync(serialNumber);
                existingItem.ItemName = newItemName;
                await UpdateItemAsync(existingItem);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"Failed to update item name for serial number {serialNumber}: {ex.Message}", ex);
            }
        }

        public async Task DeleteItemAsync(Guid id)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/items/{id}");
            var response = await _httpClient.DeleteAsync(fullUrl);
            if (!response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Delete request failed: {responseContent}");
            }
        }

        private async Task<bool> IsSerialNumberUniqueAsync(string serialNumber, Guid? itemId = null)
        {
            var existingItems = await GetItemsAsync();
            return existingItems.All(i => i.SerialNumber != serialNumber || i.Id == itemId);
        }

        public async Task<IEnumerable<Repairs>> GetUniqueItemsAsync()
        {
            var allItems = await GetItemsAsync();
            var uniqueItems = allItems
                .GroupBy(item => item.ItemName)
                .Select(group => group.First())
                .ToList();
            return uniqueItems;
        }
    }

    // Pagination models
    public class PaginatedItemsApiResponse
    {
        public List<Repairs> Items { get; set; }
        public int TotalCount { get; set; }
    }
    public class UniqueNamesApiResponse
    {
        public List<string> Items { get; set; }
        public int TotalCount { get; set; }
    }
    public class UniqueTypesApiResponse
    {
        public List<string> Items { get; set; }
        public int TotalCount { get; set; }
    }
}