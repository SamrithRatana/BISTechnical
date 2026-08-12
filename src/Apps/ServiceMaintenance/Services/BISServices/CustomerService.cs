using ServiceMaintenance.Configuration;
using ServiceMaintenance.Infrastructure.Shared.Caching;
using ServiceMaintenance.Models;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json.Serialization;

namespace ServiceMaintenance.Services.BISServices
{
    public class CustomerService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<CustomerService> _logger;
        private readonly CacheHelper _cache;

        private static readonly TimeSpan CustomerListExpiry = TimeSpan.FromMinutes(3);
        private static readonly TimeSpan CustomerTypesExpiry = TimeSpan.FromMinutes(15);

        // Shared JSON options: the Customer API serializes with camelCase
        // property names (ASP.NET Core's default System.Text.Json output
        // formatter), while our C# models (PagedResponse<T>, etc.) use
        // PascalCase. Without PropertyNameCaseInsensitive = true, the
        // outer wrapper properties (Data/TotalRecords/TotalPages/...)
        // silently fail to bind and you get an empty result instead of
        // an error.
        private static readonly System.Text.Json.JsonSerializerOptions JsonOptions = new System.Text.Json.JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        public CustomerService(HttpClient httpClient, ILogger<CustomerService> logger, CacheHelper cache)
        {
            _httpClient = httpClient;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        }

        private string GetFullUrl(string endpoint)
        {
            return ApiConfiguration.BuildCustomerApiUrl(endpoint);
        }

        #region Customer Methods

        /// <summary>
        /// Cached via Redis (CacheHelper.GetOrSetAsync), keyed by
        /// page/size/search/isActive/missingTypeOnly (CacheKeys.CustomerCenterPage),
        /// 3-minute TTL.
        ///
        /// missingTypeOnly: filters at the DATABASE level (via the API
        /// query) for customers with no CustomerTypeListId — NOT just the
        /// currently loaded page — so results are accurate over the whole
        /// table.
        ///
        /// callerToken: optional token from the calling component so the
        /// caller can abort the outbound HTTP request when disposed
        /// mid-request.
        /// </summary>
        public async Task<PagedResponse<Customer>> GetCustomersPaginatedAsync(
            int pageNumber = 1,
            int pageSize = 10,
            string searchTerm = null,
            bool? isActive = null,
            bool? missingTypeOnly = null,
            CancellationToken callerToken = default)
        {
            string cacheKey = CacheKeys.CustomerCenterPage(pageNumber, pageSize, searchTerm, isActive, missingTypeOnly);

            var cached = await _cache.GetOrSetAsync(
                cacheKey,
                () => FetchCustomersPageFromApiAsync(pageNumber, pageSize, searchTerm, isActive, missingTypeOnly, callerToken),
                CustomerListExpiry
            );

            return cached ?? new PagedResponse<Customer>(new List<Customer>(), pageNumber, pageSize, 0);
        }

        private async Task<PagedResponse<Customer>> FetchCustomersPageFromApiAsync(
            int pageNumber, int pageSize, string searchTerm, bool? isActive,
            bool? missingTypeOnly = null,
            CancellationToken callerToken = default)
        {
            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(timeoutCts.Token, callerToken);

            try
            {
                var endpoint = $"/api/Customer?pageNumber={pageNumber}&pageSize={pageSize}";

                if (!string.IsNullOrEmpty(searchTerm))
                    endpoint += $"&searchTerm={Uri.EscapeDataString(searchTerm)}";

                if (isActive.HasValue)
                    endpoint += $"&isActive={isActive.Value}";

                if (missingTypeOnly == true)
                    endpoint += "&missingTypeOnly=true";

                var url = GetFullUrl(endpoint);
                _logger.LogDebug("API Request: {Url}", url);

                var response = await _httpClient.GetAsync(url, linkedCts.Token);

                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogDebug("Response length: {Length} characters", responseContent.Length);

                    var pagedResponse = await response.Content.ReadFromJsonAsync<PagedResponse<Customer>>(JsonOptions, linkedCts.Token);

                    if (pagedResponse?.Data != null)
                    {
                        var filteredData = pagedResponse.Data
                            .Where(c => !string.IsNullOrWhiteSpace(c.CompanyName))
                            .ToList();

                        _logger.LogDebug("Successfully loaded {Count} customers", filteredData.Count);

                        return new PagedResponse<Customer>(
                            filteredData,
                            pagedResponse.PageNumber,
                            pagedResponse.PageSize,
                            pagedResponse.TotalRecords
                        );
                    }
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("API error - Status: {StatusCode}, Content: {Content}", response.StatusCode, errorContent);
                }

                return new PagedResponse<Customer>(new List<Customer>(), pageNumber, pageSize, 0);
            }
            catch (OperationCanceledException) when (callerToken.IsCancellationRequested)
            {
                _logger.LogDebug("Request cancelled by caller (page {Page})", pageNumber);
                return new PagedResponse<Customer>(new List<Customer>(), pageNumber, pageSize, 0);
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Request timeout loading customers (page {Page})", pageNumber);
                return new PagedResponse<Customer>(new List<Customer>(), pageNumber, pageSize, 0);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception loading paginated customers");
                return new PagedResponse<Customer>(new List<Customer>(), pageNumber, pageSize, 0);
            }
        }

        [Obsolete("Use GetCustomersPaginatedAsync for better performance")]
        public async Task<List<Customer>> GetCustomersAsync()
        {
            var result = await GetCustomersPaginatedAsync(pageNumber: 1, pageSize: 1000);
            return result.Data.ToList();
        }

        public async Task<string> GetCustomerTypeByCompanyName(string companyName)
        {
            var customer = await GetCustomerByCompanyName(companyName);
            return customer?.CustomerType ?? string.Empty;
        }

        public async Task<Customer> GetCustomerByCompanyName(string companyName)
        {
            if (string.IsNullOrWhiteSpace(companyName))
            {
                _logger.LogDebug("GetCustomerByCompanyName: Company name is null or empty");
                return null;
            }

            try
            {
                var pagedResponse = await GetCustomersPaginatedAsync(
                    pageNumber: 1,
                    pageSize: 20,
                    searchTerm: companyName
                );

                var customer = pagedResponse?.Data?.FirstOrDefault(c =>
                    c.CompanyName.Equals(companyName, StringComparison.OrdinalIgnoreCase));

                if (customer != null)
                {
                    _logger.LogDebug("Found customer: {CompanyName}", companyName);
                    return customer;
                }

                _logger.LogDebug("Customer not found: {CompanyName}", companyName);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting customer {CompanyName}", companyName);
                return null;
            }
        }

        #endregion

        #region Customer CRUD (Customer Center)

        public async Task<Customer> CreateCustomerAsync(Customer customer)
        {
            try
            {
                var url = GetFullUrl("/api/Customer");
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

                var response = await _httpClient.PostAsJsonAsync(url, customer, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    Customer created = null;
                    try
                    {
                        created = await response.Content.ReadFromJsonAsync<Customer>(JsonOptions, cts.Token);
                    }
                    catch (System.Text.Json.JsonException)
                    {
                        _logger.LogDebug("Create customer returned no JSON body; using submitted payload");
                    }

                    await _cache.InvalidateByPrefixAsync(CacheKeys.PrefixCustomerCenterCustomers);
                    _logger.LogInformation("✅ Created customer: {CompanyName}", customer.CompanyName);
                    return created ?? customer;
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to create customer. Status: {Status}, Content: {Content}", response.StatusCode, errorContent);
                throw new HttpRequestException($"Failed to create customer: {response.StatusCode} - {errorContent}");
            }
            catch (Exception ex) when (!(ex is HttpRequestException))
            {
                _logger.LogError(ex, "Error creating customer {CompanyName}", customer.CompanyName);
                throw;
            }
        }

        public async Task<bool> UpdateCustomerAsync(Customer customer)
        {
            try
            {
                var url = GetFullUrl($"/api/Customer/{customer.Id}");
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

                var response = await _httpClient.PutAsJsonAsync(url, customer, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    await _cache.InvalidateByPrefixAsync(CacheKeys.PrefixCustomerCenterCustomers);
                    _logger.LogInformation("✅ Updated customer: {CompanyName} ({Id})", customer.CompanyName, customer.Id);
                    return true;
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to update customer {Id}. Status: {Status}, Content: {Content}", customer.Id, response.StatusCode, errorContent);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating customer {Id}", customer.Id);
                return false;
            }
        }

        /// <summary>
        /// ➕ NEW — bulk-assign a Customer Type to many customers in ONE
        /// API call (PUT /api/Customer/bulk-assign-type), instead of looping
        /// UpdateCustomerAsync per row. Returns the number of customers
        /// actually updated on the server.
        /// customerTypeListId may be null to clear the type on all of them.
        /// </summary>
        public async Task<int> BulkAssignCustomerTypeAsync(IEnumerable<Guid> customerIds, int? customerTypeListId, string modifiedBy = null)
        {
            var idList = customerIds?.ToList() ?? new List<Guid>();
            if (idList.Count == 0)
                return 0;

            try
            {
                var url = GetFullUrl("/api/Customer/bulk-assign-type");
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));

                var payload = new
                {
                    customerIds = idList,
                    customerTypeListId,
                    modifiedBy
                };

                var response = await _httpClient.PutAsJsonAsync(url, payload, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    await _cache.InvalidateByPrefixAsync(CacheKeys.PrefixCustomerCenterCustomers);

                    var result = await response.Content.ReadFromJsonAsync<BulkAssignResultDto>(JsonOptions, cts.Token);
                    var updatedCount = result?.UpdatedCount ?? idList.Count;

                    _logger.LogInformation("✅ Bulk-assigned customer type {TypeId} to {Count} customer(s)", customerTypeListId, updatedCount);
                    return updatedCount;
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to bulk-assign customer type. Status: {Status}, Content: {Content}", response.StatusCode, errorContent);
                return 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error bulk-assigning customer type to {Count} customer(s)", idList.Count);
                return 0;
            }
        }

        public async Task<bool> DeleteCustomerAsync(Guid id)
        {
            try
            {
                var url = GetFullUrl($"/api/Customer/{id}");
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

                var response = await _httpClient.DeleteAsync(url, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    await _cache.InvalidateByPrefixAsync(CacheKeys.PrefixCustomerCenterCustomers);
                    _logger.LogInformation("✅ Deleted customer {Id}", id);
                    return true;
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to delete customer {Id}. Status: {Status}, Content: {Content}", id, response.StatusCode, errorContent);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting customer {Id}", id);
                return false;
            }
        }

        #endregion

        #region CustomerType Methods

        public async Task<List<CustomerTypeDto>> GetAllCustomerTypesAsync(bool forceRefresh = false)
        {
            if (forceRefresh)
                await _cache.InvalidateAsync(CacheKeys.CustomerCenterAllTypes);

            var cached = await _cache.GetOrSetAsync(
                CacheKeys.CustomerCenterAllTypes,
                FetchAllCustomerTypesFromApiAsync,
                CustomerTypesExpiry
            );

            return (cached ?? new List<CustomerTypeDto>()).Where(ct => ct.IsActive).ToList();
        }

        private async Task<List<CustomerTypeDto>> FetchAllCustomerTypesFromApiAsync()
        {
            try
            {
                _logger.LogDebug("Loading customer types from dedicated API...");

                var allTypes = new List<CustomerTypeDto>();
                int pageNumber = 1;
                int pageSize = 100;
                bool hasMore = true;

                while (hasMore)
                {
                    var pagedResponse = await FetchCustomerTypesPageFromApiAsync(pageNumber, pageSize, null, true);

                    if (pagedResponse?.Data != null && pagedResponse.Data.Any())
                    {
                        allTypes.AddRange(pagedResponse.Data);
                        hasMore = pagedResponse.HasNext;
                        pageNumber++;
                    }
                    else
                    {
                        hasMore = false;
                    }
                }

                _logger.LogInformation("✅ Loaded {Count} customer types", allTypes.Count);
                return allTypes;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading customer types");
                return new List<CustomerTypeDto>();
            }
        }

        public Task<PagedResponse<CustomerTypeDto>> GetCustomerTypesPaginatedAsync(
            int pageNumber = 1,
            int pageSize = 100,
            string searchTerm = null,
            bool? isActive = true)
            => FetchCustomerTypesPageFromApiAsync(pageNumber, pageSize, searchTerm, isActive);

        private async Task<PagedResponse<CustomerTypeDto>> FetchCustomerTypesPageFromApiAsync(
            int pageNumber, int pageSize, string searchTerm, bool? isActive)
        {
            try
            {
                var endpoint = $"/api/CustomerType?pageNumber={pageNumber}&pageSize={pageSize}";

                if (!string.IsNullOrEmpty(searchTerm))
                    endpoint += $"&searchTerm={Uri.EscapeDataString(searchTerm)}";

                if (isActive.HasValue)
                    endpoint += $"&isActive={isActive.Value}";

                var url = GetFullUrl(endpoint);
                _logger.LogDebug("API Request: {Url}", url);

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                var response = await _httpClient.GetAsync(url, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogDebug("CustomerType response length: {Length} characters", responseContent.Length);

                    var pagedResponse = System.Text.Json.JsonSerializer.Deserialize<PagedResponse<CustomerTypeDto>>(responseContent, JsonOptions);
                    return pagedResponse ?? new PagedResponse<CustomerTypeDto>(new List<CustomerTypeDto>(), pageNumber, pageSize, 0);
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to load customer types. Status: {Status}, Content: {Content}", response.StatusCode, errorContent);
                return new PagedResponse<CustomerTypeDto>(new List<CustomerTypeDto>(), pageNumber, pageSize, 0);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading customer types");
                return new PagedResponse<CustomerTypeDto>(new List<CustomerTypeDto>(), pageNumber, pageSize, 0);
            }
        }

        #endregion

        #region CustomerType CRUD (Customer Center)

        public async Task<CustomerTypeDto> CreateCustomerTypeAsync(CustomerTypeDto type)
        {
            try
            {
                var url = GetFullUrl("/api/CustomerType");
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

                var response = await _httpClient.PostAsJsonAsync(url, type, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    CustomerTypeDto created = null;
                    try
                    {
                        created = await response.Content.ReadFromJsonAsync<CustomerTypeDto>(JsonOptions, cts.Token);
                    }
                    catch (System.Text.Json.JsonException)
                    {
                        _logger.LogDebug("Create customer type returned no JSON body; using submitted payload");
                    }

                    await _cache.InvalidateAsync(CacheKeys.CustomerCenterAllTypes);
                    await _cache.InvalidateByPrefixAsync(CacheKeys.PrefixCustomerCenterCustomers);
                    _logger.LogInformation("✅ Created customer type: {Type}", type.Type);
                    return created ?? type;
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to create customer type. Status: {Status}, Content: {Content}", response.StatusCode, errorContent);
                throw new HttpRequestException($"Failed to create customer type: {response.StatusCode} - {errorContent}");
            }
            catch (Exception ex) when (!(ex is HttpRequestException))
            {
                _logger.LogError(ex, "Error creating customer type {Type}", type.Type);
                throw;
            }
        }

        public async Task<bool> UpdateCustomerTypeAsync(CustomerTypeDto type)
        {
            try
            {
                var url = GetFullUrl($"/api/CustomerType/{type.ListId}");
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

                var response = await _httpClient.PutAsJsonAsync(url, type, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    await _cache.InvalidateAsync(CacheKeys.CustomerCenterAllTypes);
                    await _cache.InvalidateByPrefixAsync(CacheKeys.PrefixCustomerCenterCustomers);
                    _logger.LogInformation("✅ Updated customer type: {Type} ({Id})", type.Type, type.ListId);
                    return true;
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to update customer type {Id}. Status: {Status}, Content: {Content}", type.ListId, response.StatusCode, errorContent);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating customer type {Id}", type.ListId);
                return false;
            }
        }

        public async Task<bool> DeleteCustomerTypeAsync(int listId)
        {
            try
            {
                var url = GetFullUrl($"/api/CustomerType/{listId}");
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

                var response = await _httpClient.DeleteAsync(url, cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    await _cache.InvalidateAsync(CacheKeys.CustomerCenterAllTypes);
                    await _cache.InvalidateByPrefixAsync(CacheKeys.PrefixCustomerCenterCustomers);
                    _logger.LogInformation("✅ Deleted customer type {Id}", listId);
                    return true;
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Failed to delete customer type {Id}. Status: {Status}, Content: {Content}", listId, response.StatusCode, errorContent);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting customer type {Id}", listId);
                return false;
            }
        }

        #endregion

        #region Cache Management

        public async Task ClearCacheAsync()
        {
            await _cache.InvalidateByPrefixAsync(CacheKeys.PrefixCustomerCenterCustomers);
            _logger.LogInformation("Customer cache cleared");
        }

        public async Task ClearAllCachesAsync()
        {
            await _cache.InvalidateByPrefixAsync(CacheKeys.PrefixCustomerCenter);
            _logger.LogInformation("All caches cleared (customers + customer types)");
        }

        #endregion

        #region DTOs and Models

        public class PagedResponse<T>
        {
            public int PageNumber { get; set; }
            public int PageSize { get; set; }
            public int TotalPages { get; set; }
            public int TotalRecords { get; set; }
            public IEnumerable<T> Data { get; set; }

            public bool HasPrevious => PageNumber > 1;
            public bool HasNext => PageNumber < TotalPages;

            public PagedResponse()
            {
                Data = new List<T>();
            }

            public PagedResponse(IEnumerable<T> data, int pageNumber, int pageSize, int totalRecords)
            {
                Data = data ?? new List<T>();
                PageNumber = pageNumber;
                PageSize = pageSize;
                TotalRecords = totalRecords;
                TotalPages = totalRecords > 0 ? (int)Math.Ceiling(totalRecords / (double)pageSize) : 0;
            }
        }

        public class CustomerTypeDto
        {
            [JsonPropertyName("listId")]
            public int ListId { get; set; }

            [JsonPropertyName("parentListId")]
            public int? ParentListId { get; set; }

            [JsonPropertyName("createdBy")]
            public string CreatedBy { get; set; }

            [JsonPropertyName("createdAt")]
            public DateTime? CreatedAt { get; set; }

            [JsonPropertyName("modifiedBy")]
            public string ModifiedBy { get; set; }

            [JsonPropertyName("modifiedAt")]
            public DateTime? ModifiedAt { get; set; }

            [JsonPropertyName("type")]
            public string Type { get; set; }

            [JsonPropertyName("description")]
            public string Description { get; set; }

            [JsonPropertyName("isActive")]
            public bool IsActive { get; set; }
        }

        // ➕ NEW — response shape from PUT /api/Customer/bulk-assign-type
        private class BulkAssignResultDto
        {
            [JsonPropertyName("requestedCount")]
            public int RequestedCount { get; set; }

            [JsonPropertyName("updatedCount")]
            public int UpdatedCount { get; set; }
        }

        #endregion
    }
}