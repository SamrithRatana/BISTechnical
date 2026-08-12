#nullable enable
using System.Collections;
using System.Collections.Concurrent;
using System.IO.Compression;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;

namespace ServiceMaintenance.Services.BISServices
{
    public class RentalServicesService : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly SemaphoreSlim _semaphore = new(1, 1);
        private readonly ILogger<RentalServicesService> _logger;

        private const string ApiPath = "/api/rentalservice";
        private const string CACHE_KEY = "rental_services";
        private const string CACHE_KEY_SINGLE = "rental_service_{0}";
        private const string CACHE_KEY_BY_ITEM = "rental_services_by_item_{0}";
        private const string CACHE_KEY_METADATA = "rental_services_metadata";

        // Optimized cache durations
        private readonly TimeSpan CACHE_DURATION = TimeSpan.FromMinutes(10);
        private readonly TimeSpan SINGLE_SERVICE_CACHE_DURATION = TimeSpan.FromMinutes(5);
        private readonly TimeSpan METADATA_CACHE_DURATION = TimeSpan.FromMinutes(15);

        // Background refresh settings
        private readonly Timer _backgroundRefreshTimer;
        private volatile bool _isBackgroundRefreshing = false;

        // Circuit breaker for fault tolerance
        private readonly CircuitBreaker _circuitBreaker = new();

        // Performance monitoring
        private readonly Dictionary<string, (int Count, TimeSpan TotalTime)> _performanceMetrics = new();

        // Connection pooling and performance optimizations
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        public RentalServicesService(HttpClient httpClient, IMemoryCache cache, ILogger<RentalServicesService> logger)
        {
            _httpClient = httpClient;
            _cache = cache;
            _logger = logger;

            // Enhanced HTTP client configuration for performance
            ConfigureHttpClient();

            // Setup background refresh timer (every 8 minutes to keep cache warm)
            _backgroundRefreshTimer = new Timer(BackgroundRefresh, null, TimeSpan.FromMinutes(8), TimeSpan.FromMinutes(8));
        }

        private void ConfigureHttpClient()
        {
            _httpClient.Timeout = TimeSpan.FromSeconds(45);
            _httpClient.DefaultRequestHeaders.Clear();

            // Enhanced compression support
            _httpClient.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate, br");
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            _httpClient.DefaultRequestHeaders.Add("Connection", "keep-alive");
            _httpClient.DefaultRequestHeaders.Add("Cache-Control", "no-cache");

            // Performance hints for modern APIs
            _httpClient.DefaultRequestHeaders.Add("X-Requested-With", "XMLHttpRequest");
            _httpClient.DefaultRequestHeaders.Add("Prefer", "return=representation,respond-async");
        }

        #region CRUD Operations

        /// <summary>
        /// Creates a new rental service record
        /// </summary>
        /// <param name="service">The rental service to create</param>
        /// <returns>The created rental service</returns>
        public async Task<RentalServices> CreateRentalServiceAsync(RentalServices service)
        {
            return await MeasurePerformance("CreateRentalService", async () =>
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiPath);

                try
                {
                    _logger.LogInformation("Creating rental service for item {RentalItemId}. URL: {Url}",
                        service.RentalItemId, fullUrl);

                    var response = await _httpClient.PostAsJsonAsync(fullUrl, service, JsonOptions);

                    _logger.LogInformation("Create response status: {StatusCode}", response.StatusCode);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Create failed. Status: {StatusCode}, Content: {Content}",
                            response.StatusCode, errorContent);
                        throw new HttpRequestException($"API returned {response.StatusCode}: {errorContent}");
                    }

                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogDebug("Create response content: {Content}", responseContent);

                    if (string.IsNullOrWhiteSpace(responseContent))
                    {
                        _logger.LogWarning("Create response is empty, returning original service");
                        UpdateCacheAfterCreate(service);
                        _logger.LogInformation("Created rental service with empty response for item: {RentalItemId}",
                            service.RentalItemId);
                        return service;
                    }

                    var deserializedService = JsonSerializer.Deserialize<RentalServices>(responseContent, JsonOptions);
                    if (deserializedService != null)
                    {
                        UpdateCacheAfterCreate(deserializedService);
                        _logger.LogInformation("Created rental service for item: {RentalItemId}",
                            deserializedService.RentalItemId);
                        return deserializedService;
                    }
                    else
                    {
                        _logger.LogWarning("Failed to deserialize created service, returning original");
                        UpdateCacheAfterCreate(service);
                        return service;
                    }
                }
                catch (JsonException jsonEx)
                {
                    _logger.LogError(jsonEx, "JSON deserialization failed during create operation");
                    UpdateCacheAfterCreate(service);
                    return service;
                }
                catch (HttpRequestException httpEx)
                {
                    _logger.LogError(httpEx, "HTTP request failed during create operation");
                    throw new Exception($"Failed to create rental service: {httpEx.Message}", httpEx);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error during create operation");
                    throw new Exception($"Unexpected error creating rental service: {ex.Message}", ex);
                }
            });
        }

        /// <summary>
        /// Updates an existing rental service record
        /// </summary>
        /// <param name="service">The rental service to update</param>
        /// <returns>The updated rental service</returns>
        public async Task<RentalServices> UpdateRentalServiceAsync(RentalServices service)
        {
            return await MeasurePerformance("UpdateRentalService", async () =>
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}/{service.RentalItemId}");

                try
                {
                    _logger.LogInformation("Updating rental service {RentalItemId}. URL: {Url}",
                        service.RentalItemId, fullUrl);

                    var response = await _httpClient.PutAsJsonAsync(fullUrl, service, JsonOptions);

                    _logger.LogInformation("Update response status: {StatusCode}", response.StatusCode);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Update failed. Status: {StatusCode}, Content: {Content}",
                            response.StatusCode, errorContent);
                        throw new HttpRequestException($"API returned {response.StatusCode}: {errorContent}");
                    }

                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogDebug("Update response content: {Content}", responseContent);

                    if (string.IsNullOrWhiteSpace(responseContent))
                    {
                        _logger.LogWarning("Update response is empty, returning updated service");
                        UpdateCacheAfterUpdate(service);
                        _logger.LogInformation("Updated rental service with empty response: {RentalItemId}",
                            service.RentalItemId);
                        return service;
                    }

                    var deserializedService = JsonSerializer.Deserialize<RentalServices>(responseContent, JsonOptions);
                    if (deserializedService != null)
                    {
                        UpdateCacheAfterUpdate(deserializedService);
                        _logger.LogInformation("Updated rental service: {RentalItemId}",
                            deserializedService.RentalItemId);
                        return deserializedService;
                    }
                    else
                    {
                        _logger.LogWarning("Failed to deserialize updated service, returning original");
                        UpdateCacheAfterUpdate(service);
                        return service;
                    }
                }
                catch (JsonException jsonEx)
                {
                    _logger.LogError(jsonEx, "JSON deserialization failed during update operation");
                    UpdateCacheAfterUpdate(service);
                    return service;
                }
                catch (HttpRequestException httpEx)
                {
                    _logger.LogError(httpEx, "HTTP request failed during update operation");
                    throw new Exception($"Failed to update rental service: {httpEx.Message}", httpEx);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error during update operation");
                    throw new Exception($"Unexpected error updating rental service: {ex.Message}", ex);
                }
            });
        }

        /// <summary>
        /// Deletes a rental service record by rental item ID
        /// </summary>
        /// <param name="rentalItemId">The rental item ID</param>
        public async Task DeleteRentalServiceAsync(string rentalItemId)
        {
            await MeasurePerformance("DeleteRentalService", async () =>
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}/{rentalItemId}");

                try
                {
                    _logger.LogInformation("Deleting rental service {RentalItemId}. URL: {Url}", rentalItemId, fullUrl);

                    var response = await _httpClient.DeleteAsync(fullUrl);

                    _logger.LogInformation("Delete response status: {StatusCode}", response.StatusCode);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Delete failed. Status: {StatusCode}, Content: {Content}",
                            response.StatusCode, errorContent);
                        throw new HttpRequestException($"API returned {response.StatusCode}: {errorContent}");
                    }

                    RemoveFromCache(rentalItemId);
                    _logger.LogInformation("Deleted rental service: {RentalItemId}", rentalItemId);
                }
                catch (HttpRequestException httpEx)
                {
                    _logger.LogError(httpEx, "HTTP request failed during delete operation");
                    throw new Exception($"Failed to delete rental service: {httpEx.Message}", httpEx);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unexpected error during delete operation");
                    throw new Exception($"Unexpected error deleting rental service: {ex.Message}", ex);
                }

                return Task.CompletedTask;
            });
        }

        #endregion

        #region Get Operations

        /// <summary>
        /// Gets all rental services
        /// </summary>
        /// <param name="forceRefresh">Whether to force refresh from API</param>
        /// <returns>Collection of rental services</returns>
        public async Task<IEnumerable<RentalServices>> GetRentalServicesAsync(bool forceRefresh = false)
        {
            return await MeasurePerformance("GetRentalServices", async () =>
            {
                var cacheKey = CACHE_KEY;
                var metadataKey = CACHE_KEY_METADATA;

                // Check circuit breaker
                if (_circuitBreaker.IsOpen)
                {
                    _logger.LogWarning("Circuit breaker is open, returning cached data");
                    return _cache.Get<List<RentalServices>>(cacheKey) ?? Enumerable.Empty<RentalServices>();
                }

                // Check metadata cache first
                var metadata = _cache.Get<CacheMetadata>(metadataKey);
                var cachedServices = _cache.Get<List<RentalServices>>(cacheKey);

                // Return cached data if available and not forcing refresh
                if (!forceRefresh && cachedServices != null && metadata != null)
                {
                    _logger.LogDebug("Returning cached rental services. Count: {Count}", cachedServices.Count);

                    // Trigger background refresh if cache is getting old
                    if (DateTime.UtcNow - metadata.CachedAt > TimeSpan.FromMinutes(7))
                    {
                        _ = Task.Run(() => BackgroundRefresh(null));
                    }

                    return cachedServices;
                }

                // Use semaphore to prevent multiple simultaneous API calls
                await _semaphore.WaitAsync();
                try
                {
                    // Double-check pattern
                    cachedServices = _cache.Get<List<RentalServices>>(cacheKey);
                    if (!forceRefresh && cachedServices != null)
                    {
                        return cachedServices;
                    }

                    _logger.LogInformation("Fetching rental services from API. ForceRefresh: {ForceRefresh}", forceRefresh);

                    var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                    var services = await FetchServicesWithOptimization(metadata);
                    stopwatch.Stop();

                    if (services != null)
                    {
                        var servicesList = services.ToList();
                        await CacheServicesWithOptimization(servicesList);

                        _circuitBreaker.RecordSuccess();
                        _logger.LogInformation("Fetched and cached {Count} rental services in {ElapsedMs}ms",
                            servicesList.Count, stopwatch.ElapsedMilliseconds);

                        return servicesList;
                    }

                    // Return cached services if API fails
                    return cachedServices ?? Enumerable.Empty<RentalServices>();
                }
                catch (Exception ex)
                {
                    _circuitBreaker.RecordFailure();
                    _logger.LogError(ex, "Error fetching rental services");
                    return _cache.Get<List<RentalServices>>(cacheKey) ?? Enumerable.Empty<RentalServices>();
                }
                finally
                {
                    _semaphore.Release();
                }
            });
        }

        /// <summary>
        /// Gets rental service by rental item ID
        /// </summary>
        /// <param name="rentalItemId">The rental item ID</param>
        /// <returns>The rental service or null if not found</returns>
        public async Task<RentalServices?> GetRentalServiceByIdAsync(string rentalItemId)
        {
            return await MeasurePerformance("GetRentalServiceById", async () =>
            {
                var singleServiceKey = string.Format(CACHE_KEY_SINGLE, rentalItemId);

                // Check individual cache first
                if (_cache.TryGetValue(singleServiceKey, out RentalServices? cachedService))
                {
                    _logger.LogDebug("Returning cached rental service: {RentalItemId}", rentalItemId);
                    return cachedService;
                }

                // Check main collection cache
                if (_cache.TryGetValue(CACHE_KEY, out List<RentalServices>? allServices))
                {
                    var serviceFromCollection = allServices?.FirstOrDefault(x => x.RentalItemId == rentalItemId);
                    if (serviceFromCollection != null)
                    {
                        var singleCacheOptions = new MemoryCacheEntryOptions
                        {
                            AbsoluteExpirationRelativeToNow = SINGLE_SERVICE_CACHE_DURATION,
                            Priority = CacheItemPriority.Normal
                        };
                        _cache.Set(singleServiceKey, serviceFromCollection, singleCacheOptions);

                        _logger.LogDebug("Found rental service in collection cache: {RentalItemId}", rentalItemId);
                        return serviceFromCollection;
                    }
                }

                // Fetch single service from API
                try
                {
                    _logger.LogInformation("Fetching single rental service from API: {RentalItemId}", rentalItemId);

                    var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}/{rentalItemId}");
                    var service = await FetchWithRetryAsync<RentalServices>(fullUrl);

                    if (service != null)
                    {
                        var singleCacheOptions = new MemoryCacheEntryOptions
                        {
                            AbsoluteExpirationRelativeToNow = SINGLE_SERVICE_CACHE_DURATION,
                            Priority = CacheItemPriority.Normal
                        };
                        _cache.Set(singleServiceKey, service, singleCacheOptions);

                        return service;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to fetch rental service: {RentalItemId}", rentalItemId);
                }

                return null;
            });
        }

        /// <summary>
        /// Gets rental services by rental item ID (for cases where multiple services exist for one item)
        /// </summary>
        /// <param name="rentalItemId">The rental item ID</param>
        /// <param name="forceRefresh">Whether to force refresh from cache</param>
        /// <returns>Collection of rental services for the specified item</returns>
        public async Task<IEnumerable<RentalServices>> GetRentalServicesByItemIdAsync(string rentalItemId, bool forceRefresh = false)
        {
            return await MeasurePerformance("GetRentalServicesByItemId", async () =>
            {
                var cacheKey = string.Format(CACHE_KEY_BY_ITEM, rentalItemId);

                if (!forceRefresh && _cache.TryGetValue(cacheKey, out List<RentalServices>? cached))
                {
                    _logger.LogDebug("Returning cached services for item: {RentalItemId}, Count: {Count}",
                        rentalItemId, cached!.Count);
                    return cached!;
                }

                var allServices = await GetRentalServicesAsync(forceRefresh);
                var itemServices = allServices.Where(s => s.RentalItemId == rentalItemId).ToList();

                var cacheOptions = new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                    Priority = CacheItemPriority.Normal
                };
                _cache.Set(cacheKey, itemServices, cacheOptions);

                _logger.LogDebug("Found {Count} services for item: {RentalItemId}", itemServices.Count, rentalItemId);
                return itemServices;
            });
        }

        /// <summary>
        /// Gets rental services with pagination
        /// </summary>
        /// <param name="page">Page number (1-based)</param>
        /// <param name="pageSize">Items per page</param>
        /// <param name="filter">Optional filter string</param>
        /// <param name="forceRefresh">Whether to force refresh</param>
        /// <returns>Paged result of rental services</returns>
        public async Task<PagedResult<RentalServices>> GetRentalServicesPagedAsync(
            int page = 1,
            int pageSize = 50,
            string? filter = null,
            bool forceRefresh = false)
        {
            return await MeasurePerformance("GetRentalServicesPaged", async () =>
            {
                var cacheKey = $"{CACHE_KEY}_page_{page}_{pageSize}_{filter ?? "all"}";

                if (!forceRefresh && _cache.TryGetValue(cacheKey, out PagedResult<RentalServices>? cached))
                {
                    return cached!;
                }

                var queryParams = $"&page={page}&pageSize={pageSize}";
                if (!string.IsNullOrEmpty(filter))
                {
                    queryParams += $"&filter={Uri.EscapeDataString(filter)}";
                }

                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}{queryParams}");
                var result = await FetchWithRetryAsync<PagedResult<RentalServices>>(fullUrl);

                if (result != null)
                {
                    _cache.Set(cacheKey, result, TimeSpan.FromMinutes(5));
                }

                return result ?? new PagedResult<RentalServices>();
            });
        }

        #endregion

        #region Helper Methods

        // Enhanced response parsing with better error handling
        private async Task<T?> SafeDeserializeResponse<T>(HttpResponseMessage response) where T : class
        {
            try
            {
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("API error response: Status={StatusCode}, Content={Content}",
                        response.StatusCode, errorContent);
                    return null;
                }

                var content = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("API response content: {Content}", content);

                if (string.IsNullOrWhiteSpace(content))
                {
                    _logger.LogWarning("API returned empty response");
                    return null;
                }

                content = content.Trim();
                if (!content.StartsWith("{") && !content.StartsWith("["))
                {
                    _logger.LogError("Response does not appear to be JSON: {Content}", content);
                    return null;
                }

                return JsonSerializer.Deserialize<T>(content, JsonOptions);
            }
            catch (JsonException jsonEx)
            {
                _logger.LogError(jsonEx, "Failed to deserialize JSON response");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error deserializing response");
                return null;
            }
        }

        // Enhanced fetch method with better error handling
        private async Task<T?> FetchWithRetryAsync<T>(string url, int maxRetries = 3) where T : class
        {
            Exception lastException = null!;

            for (int retry = 0; retry <= maxRetries; retry++)
            {
                try
                {
                    _logger.LogDebug("Fetching from URL: {Url}, Attempt: {Retry}/{MaxRetries}",
                        url, retry + 1, maxRetries + 1);

                    using var request = new HttpRequestMessage(HttpMethod.Get, url);
                    var response = await _httpClient.SendAsync(request);

                    if (response.IsSuccessStatusCode)
                    {
                        var result = await SafeDeserializeResponse<T>(response);
                        if (result != null)
                        {
                            return result;
                        }

                        _logger.LogWarning("Deserialization failed for successful HTTP response");
                        return null;
                    }
                    else
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        lastException = new HttpRequestException(
                            $"API returned {response.StatusCode}: {errorContent}");

                        if (response.StatusCode == System.Net.HttpStatusCode.NotFound ||
                            response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
                            response.StatusCode == System.Net.HttpStatusCode.Forbidden)
                        {
                            break;
                        }
                    }
                }
                catch (HttpRequestException ex) when (retry < maxRetries)
                {
                    lastException = ex;
                    var delay = TimeSpan.FromMilliseconds(Math.Min(1000 * Math.Pow(2, retry), 5000));
                    _logger.LogWarning(ex, "HTTP request failed, retrying in {Delay}ms. Attempt {Retry}/{MaxRetries}",
                        delay.TotalMilliseconds, retry + 1, maxRetries + 1);
                    await Task.Delay(delay);
                }
                catch (TaskCanceledException ex) when (retry < maxRetries)
                {
                    lastException = ex;
                    var delay = TimeSpan.FromMilliseconds(500 * (retry + 1));
                    _logger.LogWarning(ex, "Request timeout, retrying in {Delay}ms. Attempt {Retry}/{MaxRetries}",
                        delay.TotalMilliseconds, retry + 1, maxRetries + 1);
                    await Task.Delay(delay);
                }
                catch (Exception ex)
                {
                    lastException = ex;
                    _logger.LogError(ex, "Unexpected error during fetch attempt {Retry}", retry + 1);

                    if (retry == maxRetries)
                    {
                        break;
                    }

                    await Task.Delay(TimeSpan.FromMilliseconds(1000));
                }
            }

            _logger.LogError(lastException, "Failed to fetch data after {MaxRetries} attempts from {Url}",
                maxRetries + 1, url);
            return null;
        }

        // Advanced fetch with compression and conditional requests
        private async Task<IEnumerable<RentalServices>?> FetchServicesWithOptimization(CacheMetadata? metadata)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiPath);

            using var request = new HttpRequestMessage(HttpMethod.Get, fullUrl);

            // Add conditional headers if we have metadata
            if (metadata != null)
            {
                if (!string.IsNullOrEmpty(metadata.ETag))
                {
                    request.Headers.Add("If-None-Match", metadata.ETag);
                }
                if (metadata.LastModified.HasValue)
                {
                    request.Headers.Add("If-Modified-Since", metadata.LastModified.Value.ToString("R"));
                }
            }

            request.Headers.Add("Cache-Control", "max-age=600, stale-while-revalidate=300");

            var response = await FetchWithRetryAsync(request);

            if (response == null) return null;

            // Handle 304 Not Modified
            if (response.StatusCode == System.Net.HttpStatusCode.NotModified)
            {
                _logger.LogDebug("Data not modified, using cached version");
                var existingServices = _cache.Get<List<RentalServices>>(CACHE_KEY);
                if (existingServices != null)
                {
                    _cache.Set(CACHE_KEY, existingServices, CACHE_DURATION);
                }
                return existingServices;
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("API returned status code: {StatusCode}", response.StatusCode);
                return null;
            }

            var services = await ParseResponse(response);

            var newMetadata = new CacheMetadata
            {
                ETag = response.Headers.ETag?.Tag,
                LastModified = response.Content.Headers.LastModified?.DateTime,
                CachedAt = DateTime.UtcNow
            };

            _cache.Set(CACHE_KEY_METADATA, newMetadata, METADATA_CACHE_DURATION);

            return services;
        }

        // Enhanced retry logic with circuit breaker
        private async Task<HttpResponseMessage?> FetchWithRetryAsync(HttpRequestMessage request, int maxRetries = 3)
        {
            Exception lastException = null!;

            for (int retry = 0; retry <= maxRetries; retry++)
            {
                try
                {
                    var response = await _httpClient.SendAsync(request);
                    return response;
                }
                catch (HttpRequestException ex) when (retry < maxRetries)
                {
                    lastException = ex;
                    var delay = TimeSpan.FromMilliseconds(Math.Min(1000 * Math.Pow(2, retry), 5000));
                    _logger.LogWarning(ex, "HTTP request failed, retrying in {Delay}ms. Attempt {Retry}/{MaxRetries}",
                        delay.TotalMilliseconds, retry + 1, maxRetries + 1);
                    await Task.Delay(delay);
                }
                catch (TaskCanceledException ex) when (retry < maxRetries)
                {
                    lastException = ex;
                    var delay = TimeSpan.FromMilliseconds(500 * (retry + 1));
                    _logger.LogWarning(ex, "Request timeout, retrying in {Delay}ms. Attempt {Retry}/{MaxRetries}",
                        delay.TotalMilliseconds, retry + 1, maxRetries + 1);
                    await Task.Delay(delay);
                }
            }

            _logger.LogError(lastException, "Failed to fetch data after {MaxRetries} attempts", maxRetries + 1);
            throw new Exception($"Failed to fetch data after {maxRetries + 1} attempts", lastException);
        }

        // Handle compressed responses
        private async Task<IEnumerable<RentalServices>?> ParseResponse(HttpResponseMessage response)
        {
            if (!response.IsSuccessStatusCode) return null;

            var contentEncoding = response.Content.Headers.ContentEncoding;
            Stream contentStream = await response.Content.ReadAsStreamAsync();

            if (contentEncoding.Contains("gzip"))
            {
                contentStream = new GZipStream(contentStream, CompressionMode.Decompress);
            }

            using var reader = new StreamReader(contentStream);
            var jsonString = await reader.ReadToEndAsync();

            if (!IsValidJson(jsonString))
            {
                _logger.LogError("Invalid JSON response: {Content}", jsonString);
                return null;
            }

            return JsonSerializer.Deserialize<IEnumerable<RentalServices>>(jsonString, JsonOptions);
        }

        private bool IsValidJson(string content)
        {
            if (string.IsNullOrWhiteSpace(content))
                return false;

            content = content.Trim();
            return (content.StartsWith("{") && content.EndsWith("}")) ||
                   (content.StartsWith("[") && content.EndsWith("]"));
        }

        #endregion

        #region Cache Management

        private void UpdateCacheAfterCreate(RentalServices newService)
        {
            if (_cache.TryGetValue(CACHE_KEY, out List<RentalServices>? existingServices) && existingServices != null)
            {
                existingServices.Add(newService);
                _cache.Set(CACHE_KEY, existingServices, CACHE_DURATION);
            }

            var singleServiceKey = string.Format(CACHE_KEY_SINGLE, newService.RentalItemId);
            _cache.Set(singleServiceKey, newService, SINGLE_SERVICE_CACHE_DURATION);

            // Invalidate related item-specific cache
            var itemCacheKey = string.Format(CACHE_KEY_BY_ITEM, newService.RentalItemId);
            _cache.Remove(itemCacheKey);
        }

        private void UpdateCacheAfterUpdate(RentalServices updatedService)
        {
            var singleServiceKey = string.Format(CACHE_KEY_SINGLE, updatedService.RentalItemId);
            _cache.Set(singleServiceKey, updatedService, SINGLE_SERVICE_CACHE_DURATION);

            if (_cache.TryGetValue(CACHE_KEY, out List<RentalServices>? existingServices) && existingServices != null)
            {
                var index = existingServices.FindIndex(x => x.RentalItemId == updatedService.RentalItemId);
                if (index >= 0)
                {
                    existingServices[index] = updatedService;
                    _cache.Set(CACHE_KEY, existingServices, CACHE_DURATION);
                }
            }

            // Invalidate related item-specific cache
            var itemCacheKey = string.Format(CACHE_KEY_BY_ITEM, updatedService.RentalItemId);
            _cache.Remove(itemCacheKey);
        }

        private void RemoveFromCache(string rentalItemId)
        {
            var singleServiceKey = string.Format(CACHE_KEY_SINGLE, rentalItemId);
            _cache.Remove(singleServiceKey);

            if (_cache.TryGetValue(CACHE_KEY, out List<RentalServices>? existingServices) && existingServices != null)
            {
                existingServices.RemoveAll(x => x.RentalItemId == rentalItemId);
                _cache.Set(CACHE_KEY, existingServices, CACHE_DURATION);
            }

            // Invalidate related item-specific cache
            var itemCacheKey = string.Format(CACHE_KEY_BY_ITEM, rentalItemId);
            _cache.Remove(itemCacheKey);
        }

        private void InvalidateCache()
        {
            _cache.Remove(CACHE_KEY);
            _cache.Remove(CACHE_KEY_METADATA);

            // Clear all individual service caches (this is expensive but thorough)
            var field = typeof(MemoryCache).GetField("_coherentState",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            if (field != null)
            {
                var coherentState = field.GetValue(_cache);
                var entriesCollection = coherentState?.GetType()
                    .GetProperty("EntriesCollection", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                if (entriesCollection != null)
                {
                    var entries = (IDictionary?)entriesCollection.GetValue(coherentState);
                    if (entries != null)
                    {
                        var keysToRemove = new List<object>();
                        foreach (DictionaryEntry entry in entries)
                        {
                            var key = entry.Key.ToString();
                            if (key != null && (key.StartsWith("rental_service_") || key.StartsWith("rental_services_by_item_")))
                            {
                                keysToRemove.Add(entry.Key);
                            }
                        }
                        foreach (var key in keysToRemove)
                        {
                            _cache.Remove(key);
                        }
                    }
                }
            }
        }

        // Optimized caching with batch operations
        private Task CacheServicesWithOptimization(List<RentalServices> services)
        {
            // Cache main collection
            var mainCacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = CACHE_DURATION,
                SlidingExpiration = TimeSpan.FromMinutes(3),
                Priority = CacheItemPriority.High,
                Size = services.Count
            };
            _cache.Set(CACHE_KEY, services, mainCacheOptions);

            // Batch cache individual services (limit to prevent memory overload)
            var servicesToCache = services.Take(200);
            foreach (var service in servicesToCache)
            {
                var singleServiceKey = string.Format(CACHE_KEY_SINGLE, service.RentalItemId);
                var singleCacheOptions = new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = SINGLE_SERVICE_CACHE_DURATION,
                    Priority = CacheItemPriority.Normal,
                    Size = 1
                };
                _cache.Set(singleServiceKey, service, singleCacheOptions);
            }

            // Cache services grouped by item ID for quick lookups
            var servicesByItem = services.GroupBy(s => s.RentalItemId).Take(100); // Limit to prevent memory issues
            foreach (var group in servicesByItem)
            {
                var itemCacheKey = string.Format(CACHE_KEY_BY_ITEM, group.Key);
                var itemServices = group.ToList();
                var itemCacheOptions = new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                    Priority = CacheItemPriority.Normal,
                    Size = itemServices.Count
                };
                _cache.Set(itemCacheKey, itemServices, itemCacheOptions);
            }

            return Task.CompletedTask;
        }

        // Background refresh to keep cache warm
        private async void BackgroundRefresh(object? state)
        {
            if (_isBackgroundRefreshing) return;

            try
            {
                _isBackgroundRefreshing = true;
                _logger.LogDebug("Starting background refresh for rental services");

                var metadata = _cache.Get<CacheMetadata>(CACHE_KEY_METADATA);
                var services = await FetchServicesWithOptimization(metadata);

                if (services != null)
                {
                    var servicesList = services.ToList();
                    await CacheServicesWithOptimization(servicesList);
                    _logger.LogDebug("Background refresh completed. Services: {Count}", servicesList.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Background refresh failed for rental services");
            }
            finally
            {
                _isBackgroundRefreshing = false;
            }
        }

        #endregion

        #region Bulk Operations

        /// <summary>
        /// Creates multiple rental services in a single batch operation
        /// </summary>
        /// <param name="services">Collection of rental services to create</param>
        /// <returns>Collection of created rental services</returns>
        public async Task<IEnumerable<RentalServices>> CreateMultipleRentalServicesAsync(IEnumerable<RentalServices> services)
        {
            return await MeasurePerformance("CreateMultipleRentalServices", async () =>
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}/bulk");

                try
                {
                    _logger.LogInformation("Creating multiple rental services. Count: {Count}, URL: {Url}",
                        services.Count(), fullUrl);

                    var response = await _httpClient.PostAsJsonAsync(fullUrl, services, JsonOptions);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Bulk create failed. Status: {StatusCode}, Content: {Content}",
                            response.StatusCode, errorContent);
                        throw new HttpRequestException($"API returned {response.StatusCode}: {errorContent}");
                    }

                    var createdServices = await SafeDeserializeResponse<IEnumerable<RentalServices>>(response);

                    InvalidateCache();
                    _logger.LogInformation("Created multiple rental services: {Count}", createdServices?.Count() ?? 0);

                    return createdServices ?? services;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create multiple rental services");
                    throw new Exception($"Failed to create multiple rental services: {ex.Message}", ex);
                }
            });
        }

        /// <summary>
        /// Updates multiple rental services in a single batch operation
        /// </summary>
        /// <param name="services">Collection of rental services to update</param>
        /// <returns>Collection of updated rental services</returns>
        public async Task<IEnumerable<RentalServices>> UpdateMultipleRentalServicesAsync(IEnumerable<RentalServices> services)
        {
            return await MeasurePerformance("UpdateMultipleRentalServices", async () =>
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}/bulk");

                try
                {
                    _logger.LogInformation("Updating multiple rental services. Count: {Count}, URL: {Url}",
                        services.Count(), fullUrl);

                    var response = await _httpClient.PutAsJsonAsync(fullUrl, services, JsonOptions);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Bulk update failed. Status: {StatusCode}, Content: {Content}",
                            response.StatusCode, errorContent);
                        throw new HttpRequestException($"API returned {response.StatusCode}: {errorContent}");
                    }

                    var updatedServices = await SafeDeserializeResponse<IEnumerable<RentalServices>>(response);

                    InvalidateCache();
                    _logger.LogInformation("Updated multiple rental services: {Count}", updatedServices?.Count() ?? 0);

                    return updatedServices ?? services;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to update multiple rental services");
                    throw new Exception($"Failed to update multiple rental services: {ex.Message}", ex);
                }
            });
        }

        /// <summary>
        /// Deletes multiple rental services in a single batch operation
        /// </summary>
        /// <param name="rentalItemIds">Collection of rental item IDs to delete</param>
        public async Task DeleteMultipleRentalServicesAsync(IEnumerable<string> rentalItemIds)
        {
            await MeasurePerformance("DeleteMultipleRentalServices", async () =>
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}/bulk");

                try
                {
                    _logger.LogInformation("Deleting multiple rental services. Count: {Count}, URL: {Url}",
                        rentalItemIds.Count(), fullUrl);

                    var request = new HttpRequestMessage(HttpMethod.Delete, fullUrl)
                    {
                        Content = JsonContent.Create(rentalItemIds, options: JsonOptions)
                    };

                    var response = await _httpClient.SendAsync(request);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Bulk delete failed. Status: {StatusCode}, Content: {Content}",
                            response.StatusCode, errorContent);
                        throw new HttpRequestException($"API returned {response.StatusCode}: {errorContent}");
                    }

                    // Remove from cache
                    foreach (var id in rentalItemIds)
                    {
                        RemoveFromCache(id);
                    }

                    _logger.LogInformation("Deleted multiple rental services: {Count}", rentalItemIds.Count());
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to delete multiple rental services");
                    throw new Exception($"Failed to delete multiple rental services: {ex.Message}", ex);
                }

                return Task.CompletedTask;
            });
        }

        #endregion

        #region Filtering and Search

        /// <summary>
        /// Gets filtered rental services based on predicate
        /// </summary>
        /// <param name="predicate">Filter predicate</param>
        /// <param name="forceRefresh">Whether to force refresh from API</param>
        /// <returns>Filtered collection of rental services</returns>
        public async Task<IEnumerable<RentalServices>> GetRentalServicesFilteredAsync(
            Func<RentalServices, bool> predicate,
            bool forceRefresh = false)
        {
            return await MeasurePerformance("GetRentalServicesFiltered", async () =>
            {
                var filterKey = predicate.Method.Name;
                var cacheKey = $"{CACHE_KEY}_filtered_{filterKey}";

                if (!forceRefresh && _cache.TryGetValue(cacheKey, out List<RentalServices>? cached))
                {
                    return cached!;
                }

                var allServices = await GetRentalServicesAsync(forceRefresh);
                var filtered = allServices.Where(predicate).ToList();

                _cache.Set(cacheKey, filtered, TimeSpan.FromMinutes(3));
                return filtered;
            });
        }

        /// <summary>
        /// Searches rental services by various criteria
        /// </summary>
        /// <param name="searchTerm">Search term</param>
        /// <param name="searchInAction">Whether to search in action field</param>
        /// <param name="searchInNote">Whether to search in note field</param>
        /// <param name="searchInUserId">Whether to search in user ID field</param>
        /// <param name="forceRefresh">Whether to force refresh from API</param>
        /// <returns>Matching rental services</returns>
        public async Task<IEnumerable<RentalServices>> SearchRentalServicesAsync(
            string searchTerm,
            bool searchInAction = true,
            bool searchInNote = true,
            bool searchInUserId = false,
            bool forceRefresh = false)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return Enumerable.Empty<RentalServices>();

            return await MeasurePerformance("SearchRentalServices", async () =>
            {
                var searchKey = $"search_{searchTerm}_{searchInAction}_{searchInNote}_{searchInUserId}";
                var cacheKey = $"{CACHE_KEY}_{searchKey}";

                if (!forceRefresh && _cache.TryGetValue(cacheKey, out List<RentalServices>? cached))
                {
                    return cached!;
                }

                var allServices = await GetRentalServicesAsync(forceRefresh);
                var searchTermLower = searchTerm.ToLower();

                var filtered = allServices.Where(service =>
                    service.RentalItemId.ToLower().Contains(searchTermLower) ||
                    (searchInAction && !string.IsNullOrEmpty(service.Action) && service.Action.ToLower().Contains(searchTermLower)) ||
                    (searchInNote && !string.IsNullOrEmpty(service.Note) && service.Note.ToLower().Contains(searchTermLower)) ||
                    (searchInUserId && !string.IsNullOrEmpty(service.UserId) && service.UserId.ToLower().Contains(searchTermLower)) ||
                    (service.SpareParts?.Any(sp =>
                        (!string.IsNullOrEmpty(sp.Description) && sp.Description.ToLower().Contains(searchTermLower)) ||
                        (sp.SparePartId.HasValue && sp.SparePartId.ToString()!.ToLower().Contains(searchTermLower))
                    ) == true)
                ).ToList();

                _cache.Set(cacheKey, filtered, TimeSpan.FromMinutes(2));
                return filtered;
            });
        }

        /// <summary>
        /// Searches rental services by various criteria (optimized version)
        /// </summary>
        /// <param name="searchTerm">Search term</param>
        /// <param name="searchInAction">Whether to search in action field</param>
        /// <param name="searchInNote">Whether to search in note field</param>
        /// <param name="searchInUserId">Whether to search in user ID field</param>
        /// <param name="forceRefresh">Whether to force refresh from API</param>
        /// <returns>Matching rental services</returns>
        public async Task<IEnumerable<RentalServices>> SearchRentalServicesOptimizedAsync(
            string searchTerm,
            bool searchInAction = true,
            bool searchInNote = true,
            bool searchInUserId = false,
            bool forceRefresh = false)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return Enumerable.Empty<RentalServices>();

            return await MeasurePerformance("SearchRentalServicesOptimized", async () =>
            {
                var searchKey = $"search_opt_{searchTerm}_{searchInAction}_{searchInNote}_{searchInUserId}";
                var cacheKey = $"{CACHE_KEY}_{searchKey}";

                if (!forceRefresh && _cache.TryGetValue(cacheKey, out List<RentalServices>? cached))
                {
                    return cached!;
                }

                var allServices = await GetRentalServicesAsync(forceRefresh);

                // Use StringComparison.OrdinalIgnoreCase for better performance
                var filtered = allServices.Where(service =>
                    service.RentalItemId.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ||
                    (searchInAction && !string.IsNullOrEmpty(service.Action) &&
                     service.Action.Contains(searchTerm, StringComparison.OrdinalIgnoreCase)) ||
                    (searchInNote && !string.IsNullOrEmpty(service.Note) &&
                     service.Note.Contains(searchTerm, StringComparison.OrdinalIgnoreCase)) ||
                    (searchInUserId && !string.IsNullOrEmpty(service.UserId) &&
                     service.UserId.Contains(searchTerm, StringComparison.OrdinalIgnoreCase)) ||
                    (service.SpareParts?.Any(sp =>
                        (!string.IsNullOrEmpty(sp.Description) &&
                         sp.Description.Contains(searchTerm, StringComparison.OrdinalIgnoreCase)) ||
                        (sp.SparePartId.HasValue &&
                         sp.SparePartId.ToString()!.Contains(searchTerm, StringComparison.OrdinalIgnoreCase))
                    ) == true)
                ).ToList();

                _cache.Set(cacheKey, filtered, TimeSpan.FromMinutes(2));
                return filtered;
            });
        }

        /// <summary>
        /// Gets rental services by date range
        /// </summary>
        /// <param name="startDate">Start date (inclusive)</param>
        /// <param name="endDate">End date (inclusive)</param>
        /// <param name="forceRefresh">Whether to force refresh from API</param>
        /// <returns>Services within the date range</returns>
        public async Task<IEnumerable<RentalServices>> GetRentalServicesByDateRangeAsync(
            DateTime startDate,
            DateTime endDate,
            bool forceRefresh = false)
        {
            return await MeasurePerformance("GetRentalServicesByDateRange", async () =>
            {
                var cacheKey = $"{CACHE_KEY}_daterange_{startDate:yyyyMMdd}_{endDate:yyyyMMdd}";

                if (!forceRefresh && _cache.TryGetValue(cacheKey, out List<RentalServices>? cached))
                {
                    return cached!;
                }

                var allServices = await GetRentalServicesAsync(forceRefresh);
                var filtered = allServices.Where(service =>
                    service.Date.Date >= startDate.Date &&
                    service.Date.Date <= endDate.Date).ToList();

                _cache.Set(cacheKey, filtered, TimeSpan.FromMinutes(5));
                return filtered;
            });
        }

        #endregion

        #region Performance Monitoring and Health Check

        // Performance monitoring
        private async Task<T> MeasurePerformance<T>(string operation, Func<Task<T>> func)
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                var result = await func();
                stopwatch.Stop();

                UpdateMetrics(operation, stopwatch.Elapsed);
                _logger.LogDebug("{Operation} completed in {ElapsedMs}ms", operation, stopwatch.ElapsedMilliseconds);

                return result;
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                _logger.LogError(ex, "{Operation} failed after {ElapsedMs}ms", operation, stopwatch.ElapsedMilliseconds);
                throw;
            }
        }

        private void UpdateMetrics(string operation, TimeSpan elapsed)
        {
            if (_performanceMetrics.ContainsKey(operation))
            {
                var (count, totalTime) = _performanceMetrics[operation];
                _performanceMetrics[operation] = (count + 1, totalTime + elapsed);
            }
            else
            {
                _performanceMetrics[operation] = (1, elapsed);
            }
        }

        /// <summary>
        /// Performs a health check on the rental services API
        /// </summary>
        /// <returns>True if the API is healthy</returns>
        public async Task<bool> HealthCheckAsync()
        {
            try
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl("/health");
                var response = await _httpClient.GetAsync(fullUrl);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Tests API connectivity specifically for rental services endpoint
        /// </summary>
        /// <returns>True if the rental services API is accessible</returns>
        public async Task<bool> TestApiConnectivityAsync()
        {
            try
            {
                var testUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiPath);
                using var request = new HttpRequestMessage(HttpMethod.Head, testUrl);
                using var response = await _httpClient.SendAsync(request);

                _logger.LogInformation("Rental services API connectivity test: {StatusCode}", response.StatusCode);
                return response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.MethodNotAllowed;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Rental services API connectivity test failed");
                return false;
            }
        }

        /// <summary>
        /// Gets performance statistics for all operations
        /// </summary>
        /// <returns>Dictionary of performance metrics</returns>
        public Dictionary<string, object> GetPerformanceStats()
        {
            return _performanceMetrics.ToDictionary(
                kvp => kvp.Key,
                kvp => (object)new
                {
                    CallCount = kvp.Value.Count,
                    TotalTime = kvp.Value.TotalTime.TotalMilliseconds,
                    AverageTime = kvp.Value.TotalTime.TotalMilliseconds / kvp.Value.Count
                }
            );
        }

        /// <summary>
        /// Gets cache statistics
        /// </summary>
        /// <returns>Cache statistics object</returns>
        public object GetCacheStats()
        {
            var mainCacheExists = _cache.TryGetValue(CACHE_KEY, out List<RentalServices>? mainCache);
            var metadataExists = _cache.TryGetValue(CACHE_KEY_METADATA, out CacheMetadata? metadata);

            return new
            {
                MainCacheExists = mainCacheExists,
                MainCacheItemCount = mainCache?.Count ?? 0,
                MetadataCacheExists = metadataExists,
                LastCacheRefresh = metadata?.CachedAt,
                IsBackgroundRefreshing = _isBackgroundRefreshing,
                CircuitBreakerState = new
                {
                    IsOpen = _circuitBreaker.IsOpen
                }
            };
        }

        #endregion

        #region IDisposable Implementation

        /// <summary>
        /// Disposes of resources used by the service
        /// </summary>
        public void Dispose()
        {
            _backgroundRefreshTimer?.Dispose();
            _semaphore?.Dispose();
            _httpClient?.Dispose();
            GC.SuppressFinalize(this);
        }

        #endregion

        #region Helper Classes

        /// <summary>
        /// Cache metadata for conditional requests
        /// </summary>
        private class CacheMetadata
        {
            public string? ETag { get; set; }
            public DateTime? LastModified { get; set; }
            public DateTime CachedAt { get; set; }
        }

        /// <summary>
        /// Circuit breaker for fault tolerance
        /// </summary>
        private class CircuitBreaker
        {
            private int _failureCount = 0;
            private DateTime _lastFailureTime = DateTime.MinValue;
            private readonly int _failureThreshold = 5;
            private readonly TimeSpan _timeout = TimeSpan.FromMinutes(2);

            public bool IsOpen => _failureCount >= _failureThreshold &&
                                 DateTime.UtcNow - _lastFailureTime < _timeout;

            public void RecordSuccess() => _failureCount = 0;

            public void RecordFailure()
            {
                _failureCount++;
                _lastFailureTime = DateTime.UtcNow;
            }
        }

        /// <summary>
        /// Paged result container
        /// </summary>
        public class PagedResult<T>
        {
            public IEnumerable<T> Items { get; set; } = Enumerable.Empty<T>();
            public int TotalCount { get; set; }
            public int Page { get; set; }
            public int PageSize { get; set; }
            public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
            public bool HasNextPage => Page < TotalPages;
            public bool HasPreviousPage => Page > 1;
        }

        #endregion
    }
}