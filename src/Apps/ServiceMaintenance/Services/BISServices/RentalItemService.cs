#nullable enable
using Microsoft.Extensions.Caching.Memory;
using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;
using System.Collections.Concurrent;
using System.Text.Json;
using System.IO.Compression;

namespace ServiceMaintenance.Services.BISServices
{
    public class RentalItemService : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly IMemoryCache _cache;
        private readonly SemaphoreSlim _semaphore = new(1, 1);
        private readonly ILogger<RentalItemService> _logger;

        private const string ApiPath = "/api/rentalitem";
        private const string CACHE_KEY = "rental_items";
        private const string CACHE_KEY_SINGLE = "rental_item_{0}";
        private const string CACHE_KEY_METADATA = "rental_items_metadata";

        private readonly TimeSpan CACHE_DURATION = TimeSpan.FromMinutes(10);
        private readonly TimeSpan SINGLE_ITEM_CACHE_DURATION = TimeSpan.FromMinutes(5);
        private readonly TimeSpan METADATA_CACHE_DURATION = TimeSpan.FromMinutes(15);

        private readonly Timer _backgroundRefreshTimer;
        private volatile bool _isBackgroundRefreshing = false;
        private readonly CircuitBreaker _circuitBreaker = new();
        private readonly Dictionary<string, (int Count, TimeSpan TotalTime)> _performanceMetrics = new();

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        public RentalItemService(HttpClient httpClient, IMemoryCache cache, ILogger<RentalItemService> logger)
        {
            _httpClient = httpClient;
            _cache = cache;
            _logger = logger;

            ConfigureHttpClient();
            _backgroundRefreshTimer = new Timer(BackgroundRefresh, null, TimeSpan.FromMinutes(8), TimeSpan.FromMinutes(8));
        }

        private void ConfigureHttpClient()
        {
            _httpClient.Timeout = TimeSpan.FromSeconds(45);
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate, br");
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            _httpClient.DefaultRequestHeaders.Add("Connection", "keep-alive");
            _httpClient.DefaultRequestHeaders.Add("Cache-Control", "no-cache");
        }

        // ✅ MAIN FIX: GetRentalItemsAsync with proper response parsing
        public async Task<IEnumerable<RentalItem>> GetRentalItemsAsync(bool forceRefresh = false)
        {
            return await MeasurePerformance("GetRentalItems", async () =>
            {
                var cacheKey = CACHE_KEY;
                var metadataKey = CACHE_KEY_METADATA;

                if (_circuitBreaker.IsOpen)
                {
                    _logger.LogWarning("Circuit breaker is open, returning cached data");
                    var cached = _cache.Get<List<RentalItem>>(cacheKey) ?? new List<RentalItem>();
                    Console.WriteLine($"⚠️ Circuit breaker open, returning {cached.Count} cached items");
                    return cached;
                }

                var metadata = _cache.Get<CacheMetadata>(metadataKey);
                var cachedItems = _cache.Get<List<RentalItem>>(cacheKey);

                if (!forceRefresh && cachedItems != null && metadata != null)
                {
                    Console.WriteLine($"✅ Returning {cachedItems.Count} cached items");
                    _logger.LogDebug("Returning cached rental items. Count: {Count}", cachedItems.Count);

                    if (DateTime.UtcNow - metadata.CachedAt > TimeSpan.FromMinutes(7))
                    {
                        _ = Task.Run(() => BackgroundRefresh(null));
                    }

                    return cachedItems;
                }

                await _semaphore.WaitAsync();
                try
                {
                    cachedItems = _cache.Get<List<RentalItem>>(cacheKey);
                    if (!forceRefresh && cachedItems != null)
                    {
                        Console.WriteLine($"✅ Semaphore check: returning {cachedItems.Count} cached items");
                        return cachedItems;
                    }

                    Console.WriteLine($"🌐 Fetching from API. ForceRefresh: {forceRefresh}");
                    _logger.LogInformation("Fetching rental items from API. ForceRefresh: {ForceRefresh}", forceRefresh);

                    var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                    var items = await FetchItemsWithOptimization(metadata);
                    stopwatch.Stop();

                    if (items != null)
                    {
                        var itemsList = items.ToList();
                        await CacheItemsWithOptimization(itemsList);

                        _circuitBreaker.RecordSuccess();

                        Console.WriteLine($"✅ API returned {itemsList.Count} items in {stopwatch.ElapsedMilliseconds}ms");
                        _logger.LogInformation("Fetched and cached {Count} rental items in {ElapsedMs}ms",
                            itemsList.Count, stopwatch.ElapsedMilliseconds);

                        return itemsList;
                    }

                    Console.WriteLine("⚠️ API returned null, returning cached or empty");
                    return cachedItems ?? new List<RentalItem>();
                }
                catch (Exception ex)
                {
                    _circuitBreaker.RecordFailure();
                    Console.WriteLine($"❌ Exception in GetRentalItemsAsync: {ex.Message}");
                    _logger.LogError(ex, "Error fetching rental items");
                    return _cache.Get<List<RentalItem>>(cacheKey) ?? new List<RentalItem>();
                }
                finally
                {
                    _semaphore.Release();
                }
            });
        }

        // ✅ FIXED: Fetch with proper response handling
        private async Task<IEnumerable<RentalItem>?> FetchItemsWithOptimization(CacheMetadata? metadata)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiPath);
            Console.WriteLine($"🔗 Fetching from: {fullUrl}");

            using var request = new HttpRequestMessage(HttpMethod.Get, fullUrl);

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

            try
            {
                var response = await _httpClient.SendAsync(request);
                Console.WriteLine($"📥 Response status: {response.StatusCode}");

                if (response.StatusCode == System.Net.HttpStatusCode.NotModified)
                {
                    _logger.LogDebug("Data not modified, using cached version");
                    var existingItems = _cache.Get<List<RentalItem>>(CACHE_KEY);
                    if (existingItems != null)
                    {
                        _cache.Set(CACHE_KEY, existingItems, CACHE_DURATION);
                    }
                    return existingItems;
                }

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("API returned status code: {StatusCode}, Content: {Content}",
                        response.StatusCode, errorContent);
                    Console.WriteLine($"❌ API error: {response.StatusCode}");
                    return null;
                }

                // ✅ Parse response with wrapper handling
                var items = await ParseResponse(response);

                if (items == null || !items.Any())
                {
                    Console.WriteLine("⚠️ No items parsed from response");
                    return items;
                }

                Console.WriteLine($"✅ Successfully parsed {items.Count()} items");

                // Extract metadata
                var newMetadata = new CacheMetadata
                {
                    ETag = response.Headers.ETag?.Tag,
                    LastModified = response.Content.Headers.LastModified?.DateTime,
                    CachedAt = DateTime.UtcNow
                };

                _cache.Set(CACHE_KEY_METADATA, newMetadata, METADATA_CACHE_DURATION);

                return items;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Exception in FetchItemsWithOptimization: {ex.Message}");
                _logger.LogError(ex, "Failed to fetch items");
                return null;
            }
        }

        // ✅ CRITICAL FIX: Handle API response structure
        private async Task<IEnumerable<RentalItem>?> ParseResponse(HttpResponseMessage response)
        {
            if (!response.IsSuccessStatusCode) return null;

            try
            {
                var jsonString = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"📄 Raw response length: {jsonString.Length} chars");
                Console.WriteLine($"📄 Response preview: {jsonString.Substring(0, Math.Min(200, jsonString.Length))}...");

                if (string.IsNullOrWhiteSpace(jsonString))
                {
                    Console.WriteLine("⚠️ Empty response");
                    return null;
                }

                // ✅ Try to parse as wrapped response first (with "items" property)
                try
                {
                    var wrappedResponse = JsonSerializer.Deserialize<RentalItemResponse>(jsonString, JsonOptions);
                    if (wrappedResponse?.Items != null && wrappedResponse.Items.Any())
                    {
                        Console.WriteLine($"✅ Parsed as wrapped response: {wrappedResponse.Items.Count()} items");
                        return wrappedResponse.Items;
                    }
                }
                catch (JsonException)
                {
                    Console.WriteLine("ℹ️ Not a wrapped response, trying direct array...");
                }

                // ✅ Fallback: try direct array
                var directArray = JsonSerializer.Deserialize<IEnumerable<RentalItem>>(jsonString, JsonOptions);
                if (directArray != null && directArray.Any())
                {
                    Console.WriteLine($"✅ Parsed as direct array: {directArray.Count()} items");
                    return directArray;
                }

                Console.WriteLine("❌ Failed to parse in any format");
                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ ParseResponse exception: {ex.Message}");
                _logger.LogError(ex, "Failed to parse response");
                return null;
            }
        }

        // Response wrapper class to handle {"items": [...]} structure
        private class RentalItemResponse
        {
            public IEnumerable<RentalItem> Items { get; set; } = Enumerable.Empty<RentalItem>();
        }

        private Task CacheItemsWithOptimization(List<RentalItem> items)
        {
            var mainCacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = CACHE_DURATION,
                SlidingExpiration = TimeSpan.FromMinutes(3),
                Priority = CacheItemPriority.High,
                Size = items.Count
            };

            _cache.Set(CACHE_KEY, items, mainCacheOptions);
            Console.WriteLine($"💾 Cached {items.Count} items");

            var itemsToCache = items.Take(200);
            foreach (var item in itemsToCache)
            {
                var singleItemKey = string.Format(CACHE_KEY_SINGLE, item.Id);
                var singleCacheOptions = new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = SINGLE_ITEM_CACHE_DURATION,
                    Priority = CacheItemPriority.Normal,
                    Size = 1
                };

                _cache.Set(singleItemKey, item, singleCacheOptions);
            }

            return Task.CompletedTask;
        }

        public async Task<RentalItem?> GetRentalItemByIdAsync(Guid id)
        {
            return await MeasurePerformance("GetRentalItemById", async () =>
            {
                var singleItemKey = string.Format(CACHE_KEY_SINGLE, id);

                if (_cache.TryGetValue(singleItemKey, out RentalItem? cachedItem))
                {
                    _logger.LogDebug("Returning cached rental item: {Id}", id);
                    return cachedItem;
                }

                if (_cache.TryGetValue(CACHE_KEY, out List<RentalItem>? allItems))
                {
                    var itemFromCollection = allItems?.FirstOrDefault(x => x.Id == id);
                    if (itemFromCollection != null)
                    {
                        _cache.Set(singleItemKey, itemFromCollection, SINGLE_ITEM_CACHE_DURATION);
                        return itemFromCollection;
                    }
                }

                try
                {
                    var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}/{id}");
                    using var response = await _httpClient.GetAsync(fullUrl);

                    if (!response.IsSuccessStatusCode) return null;

                    var jsonString = await response.Content.ReadAsStringAsync();
                    var item = JsonSerializer.Deserialize<RentalItem>(jsonString, JsonOptions);

                    if (item != null)
                    {
                        _cache.Set(singleItemKey, item, SINGLE_ITEM_CACHE_DURATION);
                    }

                    return item;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to fetch rental item: {Id}", id);
                    return null;
                }
            });
        }

        public async Task<RentalItem> CreateRentalItemAsync(RentalItem item)
        {
            return await MeasurePerformance("CreateRentalItem", async () =>
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiPath);

                try
                {
                    var response = await _httpClient.PostAsJsonAsync(fullUrl, item, JsonOptions);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        throw new HttpRequestException($"API returned {response.StatusCode}: {errorContent}");
                    }

                    var responseContent = await response.Content.ReadAsStringAsync();

                    if (string.IsNullOrWhiteSpace(responseContent))
                    {
                        var createdItem = new RentalItem
                        {
                            Id = item.Id == Guid.Empty ? Guid.NewGuid() : item.Id,
                            CreatedBy = item.CreatedBy,
                            CustomerId = item.CustomerId,
                            CustomerName = item.CustomerName,
                            ItemName = item.ItemName,
                            SerialNumber = item.SerialNumber,
                            Condition = item.Condition,
                            Location = item.Location,
                            Duration = item.Duration
                        };

                        UpdateCacheAfterCreate(createdItem);
                        return createdItem;
                    }

                    var deserializedItem = JsonSerializer.Deserialize<RentalItem>(responseContent, JsonOptions);
                    if (deserializedItem != null)
                    {
                        UpdateCacheAfterCreate(deserializedItem);
                        return deserializedItem;
                    }

                    return item;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create rental item");
                    throw;
                }
            });
        }

        public async Task<RentalItem> UpdateRentalItemAsync(RentalItem item)
        {
            return await MeasurePerformance("UpdateRentalItem", async () =>
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}/{item.Id}");

                try
                {
                    var response = await _httpClient.PutAsJsonAsync(fullUrl, item, JsonOptions);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        throw new HttpRequestException($"API returned {response.StatusCode}: {errorContent}");
                    }

                    UpdateCacheAfterUpdate(item);
                    return item;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to update rental item");
                    throw;
                }
            });
        }

        public async Task<PagedResult<RentalItem>> GetRentalItemsPagedAsync(
            int page = 1,
            int pageSize = 10,
            string? filter = null,
            bool forceRefresh = false)
        {
            return await MeasurePerformance("GetRentalItemsPaged", async () =>
            {
                var cacheKey = $"{CACHE_KEY}_page_{page}_{pageSize}_{filter ?? "all"}";

                // Check cache first
                if (!forceRefresh && _cache.TryGetValue(cacheKey, out PagedResult<RentalItem>? cached))
                {
                    Console.WriteLine($"✅ Returning cached page {page}: {cached.Items.Count()} items");
                    return cached!;
                }

                try
                {
                    // Build URL with pagination parameters
                    var queryParams = $"&pageNumber={page}&pageSize={pageSize}";
                    if (!string.IsNullOrEmpty(filter))
                    {
                        queryParams += $"&filter={Uri.EscapeDataString(filter)}";
                    }

                    var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}{queryParams}");
                    Console.WriteLine($"🌐 Fetching page {page} from: {fullUrl}");

                    using var request = new HttpRequestMessage(HttpMethod.Get, fullUrl);
                    var response = await _httpClient.SendAsync(request);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError("Paged API request failed: {StatusCode}, Content: {Content}",
                            response.StatusCode, errorContent);

                        Console.WriteLine($"❌ API error: {response.StatusCode}");
                        return new PagedResult<RentalItem>();
                    }

                    var jsonString = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"📄 Paged response length: {jsonString.Length} chars");

                    // Parse the response
                    PagedResult<RentalItem>? result = null;

                    try
                    {
                        // Try to parse as wrapped paged response
                        var wrappedResponse = JsonSerializer.Deserialize<PagedResponseWrapper>(jsonString, JsonOptions);
                        if (wrappedResponse?.Items != null)
                        {
                            result = new PagedResult<RentalItem>
                            {
                                Items = wrappedResponse.Items,
                                TotalCount = wrappedResponse.TotalCount ?? wrappedResponse.Items.Count(),
                                Page = page,
                                PageSize = pageSize
                            };
                            Console.WriteLine($"✅ Parsed wrapped paged response: {result.Items.Count()} items, Total: {result.TotalCount}");
                        }
                    }
                    catch (JsonException)
                    {
                        Console.WriteLine("ℹ️ Not a wrapped paged response, trying direct array...");
                    }

                    // Fallback: if API doesn't support pagination, load all and paginate client-side
                    if (result == null)
                    {
                        var allItems = await ParseResponse(response);
                        if (allItems != null)
                        {
                            var itemsList = allItems.ToList();
                            var pagedItems = itemsList
                                .Skip((page - 1) * pageSize)
                                .Take(pageSize)
                                .ToList();

                            result = new PagedResult<RentalItem>
                            {
                                Items = pagedItems,
                                TotalCount = itemsList.Count,
                                Page = page,
                                PageSize = pageSize
                            };
                            Console.WriteLine($"✅ Client-side pagination: {pagedItems.Count} items from {itemsList.Count} total");
                        }
                    }

                    if (result == null)
                    {
                        Console.WriteLine("❌ Failed to parse paged response");
                        return new PagedResult<RentalItem>();
                    }

                    // Cache the result
                    var cacheOptions = new MemoryCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                        Priority = CacheItemPriority.Normal
                    };
                    _cache.Set(cacheKey, result, cacheOptions);

                    return result;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"❌ Exception in GetRentalItemsPagedAsync: {ex.Message}");
                    _logger.LogError(ex, "Failed to fetch paged rental items");
                    return new PagedResult<RentalItem>();
                }
            });
        }

        public async Task DeleteRentalItemAsync(Guid id)
        {
            await MeasurePerformance("DeleteRentalItem", async () =>
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiPath}/{id}");

                try
                {
                    var response = await _httpClient.DeleteAsync(fullUrl);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        throw new HttpRequestException($"API returned {response.StatusCode}: {errorContent}");
                    }

                    RemoveFromCache(id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to delete rental item");
                    throw;
                }

                return Task.CompletedTask;
            });
        }

        private void UpdateCacheAfterCreate(RentalItem newItem)
        {
            if (_cache.TryGetValue(CACHE_KEY, out List<RentalItem>? existingItems) && existingItems != null)
            {
                existingItems.Add(newItem);
                _cache.Set(CACHE_KEY, existingItems, CACHE_DURATION);
            }

            var singleItemKey = string.Format(CACHE_KEY_SINGLE, newItem.Id);
            _cache.Set(singleItemKey, newItem, SINGLE_ITEM_CACHE_DURATION);
        }

        private void UpdateCacheAfterUpdate(RentalItem updatedItem)
        {
            var singleItemKey = string.Format(CACHE_KEY_SINGLE, updatedItem.Id);
            _cache.Set(singleItemKey, updatedItem, SINGLE_ITEM_CACHE_DURATION);

            if (_cache.TryGetValue(CACHE_KEY, out List<RentalItem>? existingItems) && existingItems != null)
            {
                var index = existingItems.FindIndex(x => x.Id == updatedItem.Id);
                if (index >= 0)
                {
                    existingItems[index] = updatedItem;
                    _cache.Set(CACHE_KEY, existingItems, CACHE_DURATION);
                }
            }
        }

        private void RemoveFromCache(Guid id)
        {
            var singleItemKey = string.Format(CACHE_KEY_SINGLE, id);
            _cache.Remove(singleItemKey);

            if (_cache.TryGetValue(CACHE_KEY, out List<RentalItem>? existingItems) && existingItems != null)
            {
                existingItems.RemoveAll(x => x.Id == id);
                _cache.Set(CACHE_KEY, existingItems, CACHE_DURATION);
            }
        }

        private async void BackgroundRefresh(object? state)
        {
            if (_isBackgroundRefreshing) return;

            try
            {
                _isBackgroundRefreshing = true;
                var metadata = _cache.Get<CacheMetadata>(CACHE_KEY_METADATA);
                var items = await FetchItemsWithOptimization(metadata);

                if (items != null)
                {
                    await CacheItemsWithOptimization(items.ToList());
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Background refresh failed");
            }
            finally
            {
                _isBackgroundRefreshing = false;
            }
        }

        private async Task<T> MeasurePerformance<T>(string operation, Func<Task<T>> func)
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                var result = await func();
                stopwatch.Stop();
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

        public void Dispose()
        {
            _backgroundRefreshTimer?.Dispose();
            _semaphore?.Dispose();
            GC.SuppressFinalize(this);
        }

        private class CacheMetadata
        {
            public string? ETag { get; set; }
            public DateTime? LastModified { get; set; }
            public DateTime CachedAt { get; set; }
        }

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

        private class PagedResponseWrapper
        {
            public IEnumerable<RentalItem> Items { get; set; } = Enumerable.Empty<RentalItem>();
            public int? TotalCount { get; set; }
            public int? PageNumber { get; set; }
            public int? PageSize { get; set; }
            public int? TotalPages { get; set; }
        }

        public class PagedResult<T>
        {
            public IEnumerable<T> Items { get; set; } = Enumerable.Empty<T>();
            public int TotalCount { get; set; }
            public int Page { get; set; }
            public int PageSize { get; set; }
            public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
            public bool HasNextPage => Page < TotalPages;
            public bool HasPreviousPage => Page > 1;
        }
    }
}