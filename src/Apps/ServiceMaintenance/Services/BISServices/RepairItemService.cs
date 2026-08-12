using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.BISServices
{
    // ✅ DateTime converter — prevents UTC auto-conversion (+7 shift)
    public class UnspecifiedDateTimeConverter : System.Text.Json.Serialization.JsonConverter<DateTime>
    {
        public override DateTime Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var dateString = reader.GetString();
            var dt = DateTime.Parse(dateString, null, System.Globalization.DateTimeStyles.RoundtripKind);
            return DateTime.SpecifyKind(dt, DateTimeKind.Unspecified);
        }

        public override void Write(System.Text.Json.Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
            => writer.WriteStringValue(value.ToString("yyyy-MM-ddTHH:mm:ss"));
    }

    public class NullableUnspecifiedDateTimeConverter : System.Text.Json.Serialization.JsonConverter<DateTime?>
    {
        public override DateTime? Read(ref System.Text.Json.Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == System.Text.Json.JsonTokenType.Null) return null;
            var dateString = reader.GetString();
            if (string.IsNullOrEmpty(dateString)) return null;
            var dt = DateTime.Parse(dateString, null, System.Globalization.DateTimeStyles.RoundtripKind);
            return DateTime.SpecifyKind(dt, DateTimeKind.Unspecified);
        }

        public override void Write(System.Text.Json.Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
        {
            if (value.HasValue) writer.WriteStringValue(value.Value.ToString("yyyy-MM-ddTHH:mm:ss"));
            else writer.WriteNullValue();
        }
    }

    /// <summary>
    /// ✅ FIXED: All Console.WriteLine calls replaced with ILogger calls.
    /// Console.WriteLine bypasses appsettings.json's Logging:LogLevel config
    /// entirely — that's why "Searching services: ...", "No spare parts for...",
    /// etc. kept printing no matter what the config said. Routine/diagnostic
    /// flow (URLs being fetched, parse-path chosen, response previews) is now
    /// LogDebug. Real failures stay LogError/LogWarning.
    /// </summary>
    public class RepairItemService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<RepairItemService> _logger;

        // ✅ Shared options with no UTC conversion
        private static readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters =
            {
                new UnspecifiedDateTimeConverter(),
                new NullableUnspecifiedDateTimeConverter()
            }
        };

        public RepairItemService(HttpClient httpClient, ILogger<RepairItemService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<IEnumerable<ServiceType>> GetServiceTypesAsync()
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl("/api/technicalservices/servicetypes");
            return await _httpClient.GetFromJsonAsync<IEnumerable<ServiceType>>(fullUrl);
        }

        public async Task<IEnumerable<ServicePriority>> GetServicePrioritiesAsync()
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl("/api/technicalservices/servicepriorities");
            return await _httpClient.GetFromJsonAsync<IEnumerable<ServicePriority>>(fullUrl);
        }

        public async Task<IEnumerable<ServiceStatus>> GetServiceStatusesAsync()
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl("/api/technicalservices/servicestatuses");
            return await _httpClient.GetFromJsonAsync<IEnumerable<ServiceStatus>>(fullUrl);
        }

        public async Task<IEnumerable<Repairs>> GetRepairsAsync()
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl("/api/items");
            return await _httpClient.GetFromJsonAsync<IEnumerable<Repairs>>(fullUrl);
        }

        // ✅ Paginated method
        public async Task<PaginatedResult<RepairServices>> GetRepairServicesPagedAsync(int pageNumber = 1, int pageSize = 10)
        {
            try
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/technicalservices?pageNumber={pageNumber}&pageSize={pageSize}");
                _logger.LogDebug("Fetching: {Url}", fullUrl);

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("Response preview: {Preview}...",
                    responseContent.Substring(0, Math.Min(200, responseContent.Length)));

                PaginatedApiResponse repairServices = null;
                List<RepairServices> items = null;
                int totalCount = 0;

                try
                {
                    if (responseContent.Contains("\"items\"") && responseContent.Contains("\"totalCount\""))
                    {
                        repairServices = JsonSerializer.Deserialize<PaginatedApiResponse>(responseContent, _jsonOptions);
                        items = repairServices?.Items;
                        totalCount = repairServices?.TotalCount ?? 0;
                        _logger.LogDebug("Parsed as PaginatedApiResponse. Items: {ItemCount}, Total: {TotalCount}", items?.Count, totalCount);
                    }
                    else
                    {
                        items = JsonSerializer.Deserialize<List<RepairServices>>(responseContent, _jsonOptions);
                        totalCount = items?.Count ?? 0;
                        _logger.LogDebug("Parsed as List<RepairServices>. Items: {ItemCount}", items?.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Deserialization error");
                    throw;
                }

                // ✅ inspectDate only — stored as UTC in DB, needs +7 adjustment
                if (items != null)
                {
                    foreach (var service in items)
                        AdjustServiceDates(service);
                }

                return new PaginatedResult<RepairServices>
                {
                    Items = items ?? new List<RepairServices>(),
                    TotalCount = totalCount,
                    PageNumber = pageNumber,
                    PageSize = pageSize,
                    TotalPages = totalCount > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 0
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetRepairServicesPagedAsync");
                throw;
            }
        }

        public async Task MoveBackToInspectingAsync(Guid serviceId)
        {
            var url = ApiConfiguration.BuildTechnicalServicesUrl(
                $"/api/technicalservices/{serviceId}/status");

            var response = await _httpClient.PutAsJsonAsync(url, new { statusId = 10 });

            if (!response.IsSuccessStatusCode)
            {
                var msg = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException(msg);
            }
        }

        // ══════════════════════════════════════════════════════════════
        // This is the fast SQL-side aggregation call: one row per
        // company, grouped/counted in the database — used for the top
        // summary grid instead of loading raw rows.
        // ══════════════════════════════════════════════════════════════
        public async Task<List<CompanyStatusSummaryDto>> GetMonthlyReportSummaryAsync(
            DateTime fromDate, DateTime toDate, string serviceLocation)
        {
            try
            {
                var queryParams = new List<string>
                {
                    $"fromDate={fromDate:yyyy-MM-dd}",
                    $"toDate={toDate:yyyy-MM-dd}"
                };

                if (!string.IsNullOrWhiteSpace(serviceLocation) && serviceLocation != "All")
                    queryParams.Add($"serviceLocation={Uri.EscapeDataString(serviceLocation)}");

                var queryString = $"?{string.Join("&", queryParams)}";
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(
                    $"/api/technicalservices/monthly-report-summary{queryString}");

                _logger.LogDebug("Fetching monthly report summary: {Url}", fullUrl);

                var response = await _httpClient.GetAsync(fullUrl);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<List<CompanyStatusSummaryDto>>(json, _jsonOptions)
                              ?? new List<CompanyStatusSummaryDto>();

                _logger.LogDebug("Monthly report summary: {Count} company rows", result.Count);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetMonthlyReportSummaryAsync");
                throw;
            }
        }

        public async Task<PaginatedResult<RepairServices>> SearchRepairServicesAsync(
     int pageNumber = 1,
     int pageSize = 10,
     string searchTerm = null,
     string serialNumber = null,
     string status = null,
     string serviceType = null,
     string serviceLocation = null,
     DateTime? fromDate = null,
     DateTime? toDate = null,
     bool? hasContract = null,
     string dateFilter = null,
     string statusFilter = null,
     string sortBy = null,
     bool sortDescending = true,
     bool useProcessDateFiltering = false,
     string[] statusesForProcessFiltering = null,
     string[] excludedStatuses = null,
     Guid[] userIds = null,
     string[] userFilterStatuses = null,
     bool forceServiceDateOnly = false,
     string[] companyNames = null,
     string companyName = null) // ✅ NEW — single-value Company Name search,
                                // maps to ServiceSearchQuery.CompanyName on
                                // the API (partial/contains match), separate
                                // from companyNames[] (exact-match array used
                                // by the monthly report detail grid)
        {
            try
            {
                var queryParams = new List<string>
        {
            $"pageNumber={pageNumber}",
            $"pageSize={pageSize}",
            "api-version=1.0"
        };

                if (!string.IsNullOrEmpty(searchTerm))
                    queryParams.Add($"searchTerm={Uri.EscapeDataString(searchTerm)}");

                if (!string.IsNullOrEmpty(serialNumber))
                    queryParams.Add($"serialNumber={Uri.EscapeDataString(serialNumber)}");

                if (!string.IsNullOrEmpty(status))
                    queryParams.Add($"status={Uri.EscapeDataString(status)}");

                if (!string.IsNullOrEmpty(serviceType))
                    queryParams.Add($"serviceType={Uri.EscapeDataString(serviceType)}");

                if (!string.IsNullOrEmpty(serviceLocation))
                    queryParams.Add($"serviceLocation={Uri.EscapeDataString(serviceLocation)}");

                if (fromDate.HasValue)
                    queryParams.Add($"fromDate={fromDate.Value:yyyy-MM-dd}");

                if (toDate.HasValue)
                    queryParams.Add($"toDate={toDate.Value:yyyy-MM-dd}");

                if (hasContract.HasValue)
                    queryParams.Add($"hasContract={hasContract.Value}");

                if (!string.IsNullOrEmpty(dateFilter))
                    queryParams.Add($"dateFilter={dateFilter}");

                if (!string.IsNullOrEmpty(statusFilter))
                    queryParams.Add($"statusFilter={statusFilter}");

                if (!string.IsNullOrEmpty(sortBy))
                    queryParams.Add($"sortBy={sortBy}");

                queryParams.Add($"sortDescending={sortDescending}");

                if (useProcessDateFiltering)
                {
                    queryParams.Add($"useProcessDateFiltering={useProcessDateFiltering}");

                    if (statusesForProcessFiltering != null && statusesForProcessFiltering.Any())
                    {
                        foreach (var statusItem in statusesForProcessFiltering)
                            queryParams.Add($"statusesForProcessFiltering={Uri.EscapeDataString(statusItem)}");
                    }
                }

                if (excludedStatuses != null && excludedStatuses.Any())
                {
                    foreach (var excludedStatus in excludedStatuses)
                        queryParams.Add($"excludedStatuses={Uri.EscapeDataString(excludedStatus)}");
                }

                if (userIds != null && userIds.Any())
                {
                    foreach (var userId in userIds)
                        queryParams.Add($"userIds={userId}");
                }

                if (userFilterStatuses != null && userFilterStatuses.Any())
                {
                    foreach (var userStatus in userFilterStatuses)
                        queryParams.Add($"userFilterStatuses={Uri.EscapeDataString(userStatus)}");
                }

                if (forceServiceDateOnly)
                    queryParams.Add($"forceServiceDateOnly=true");

                if (companyNames != null && companyNames.Any())
                {
                    foreach (var name in companyNames)
                        queryParams.Add($"companyNames={Uri.EscapeDataString(name)}");
                }

                // ✅ NEW
                if (!string.IsNullOrEmpty(companyName))
                    queryParams.Add($"companyName={Uri.EscapeDataString(companyName)}");

                var queryString = $"?{string.Join("&", queryParams)}";
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/technicalservices/search{queryString}");

                _logger.LogDebug("Searching services: {Url}", fullUrl);

                var response = await _httpClient.GetAsync(fullUrl, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();

                PaginatedApiResponse repairServices = null;

                try
                {
                    await using var stream = await response.Content.ReadAsStreamAsync();
                    repairServices = await JsonSerializer.DeserializeAsync<PaginatedApiResponse>(
                        stream, _jsonOptions);
                }
                catch (JsonException)
                {
                    var fallbackResponse = await _httpClient.GetAsync(fullUrl);
                    fallbackResponse.EnsureSuccessStatusCode();
                    var fallbackContent = await fallbackResponse.Content.ReadAsStringAsync();
                    var items = JsonSerializer.Deserialize<List<RepairServices>>(fallbackContent, _jsonOptions);
                    repairServices = new PaginatedApiResponse
                    {
                        Items = items,
                        TotalCount = items?.Count ?? 0
                    };
                }

                if (repairServices?.Items != null)
                {
                    foreach (var service in repairServices.Items)
                        AdjustServiceDates(service);
                }

                return new PaginatedResult<RepairServices>
                {
                    Items = repairServices?.Items ?? new List<RepairServices>(),
                    TotalCount = repairServices?.TotalCount ?? 0,
                    PageNumber = pageNumber,
                    PageSize = pageSize,
                    TotalPages = repairServices != null && repairServices.TotalCount > 0
                        ? (int)Math.Ceiling(repairServices.TotalCount / (double)pageSize)
                        : 0
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SearchRepairServicesAsync");
                throw;
            }
        }

        // ✅ ONLY inspectDate needs +7 — it is stored as pure UTC in DB.
        // All other dates are saved as DateTime.UtcNow.AddHours(7) server-side,
        // so they are already Cambodia time and need no adjustment.
        private void AdjustServiceDates(RepairServices service)
        {
            if (service.inspectDate.HasValue)
                service.inspectDate = service.inspectDate.Value.AddHours(7);
        }

        public async Task<RepairServices> GetRepairServiceByIdAsync(Guid id)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/technicalservices/{id}");
            var response = await _httpClient.GetAsync(fullUrl);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                return null;
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            var service = JsonSerializer.Deserialize<RepairServices>(content, _jsonOptions);
            if (service != null) AdjustServiceDates(service);
            return service;
        }

        public async Task CreateRepairServiceAsync(RepairServices repairService)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl("/api/technicalservices");
            var response = await _httpClient.PostAsJsonAsync(fullUrl, repairService);
            response.EnsureSuccessStatusCode();
        }

        public async Task UpdateInspectionSolutionAsync(Guid serviceId, string inspection, string solution)
        {
            try
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(
                    $"/api/technicalservices/{serviceId}/inspection-solution");

                _logger.LogDebug("Updating Inspection/Solution: {Url}", fullUrl);

                var payload = new
                {
                    Id = serviceId,
                    Inspection = inspection,
                    Solution = solution
                };

                var response = await _httpClient.PutAsJsonAsync(fullUrl, payload);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("UpdateInspectionSolutionAsync error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                    throw new Exception($"API returned {response.StatusCode}: {errorContent}");
                }

                _logger.LogDebug("Inspection/Solution update successful for {ServiceId}", serviceId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UpdateInspectionSolutionAsync");
                throw;
            }
        }
        public async Task UpdateRepairServiceAsync(RepairServices repairService)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl("/api/technicalservices");

            try
            {
                _logger.LogDebug("=== UPDATE API CALL === URL: {Url}", fullUrl);

                var options = new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    WriteIndented = true
                };

                var json = JsonSerializer.Serialize(repairService, options);
                _logger.LogDebug("Payload:\n{Payload}", json);

                var response = await _httpClient.PutAsJsonAsync(fullUrl, repairService, options);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("API Error Response: {StatusCode} - {Error}", response.StatusCode, errorContent);
                    throw new Exception($"API returned {response.StatusCode}: {errorContent}");
                }

                response.EnsureSuccessStatusCode();
                _logger.LogDebug("Update successful");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UpdateRepairServiceAsync");
                throw;
            }
        }

        public async Task DeleteRepairServiceAsync(Guid id)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"/api/technicalservices/{id}");
            var response = await _httpClient.DeleteAsync(fullUrl);
            response.EnsureSuccessStatusCode();
        }

        public async Task<string> GetLatestReportNoAsync()
        {
            try
            {
                var result = await SearchRepairServicesAsync(
                    pageNumber: 1,
                    pageSize: 1,
                    sortBy: "reportNo",
                    sortDescending: true
                );

                if (result.Items != null && result.Items.Any())
                {
                    var latestReportNo = result.Items.First().reportNo;
                    _logger.LogDebug("Latest report number: {ReportNo}", latestReportNo);
                    return latestReportNo;
                }

                _logger.LogDebug("No existing reports found");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetLatestReportNoAsync");
                throw;
            }
        }

        // ⚠️ DEPRECATED — kept only for backward compatibility with any
        // remaining callers. Writes only to Services.TelegramMessageId
        // (the single-column "latest message" field), which is what caused
        // the original bug: one topic's Send silently overwrote another
        // topic's stored id. New code should use SaveTelegramMessageAsync
        // below instead, which writes to the ServiceTelegramMessages child
        // table (one row per topic, never overwritten).
        public async Task UpdateTelegramMessageIdAsync(Guid serviceId, int telegramMessageId)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(
                $"/api/technicalservices/{serviceId}/telegram-message-id");

            var response = await _httpClient.PatchAsJsonAsync(fullUrl, new { TelegramMessageId = telegramMessageId });

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("UpdateTelegramMessageIdAsync error: {StatusCode} - {Error}", response.StatusCode, errorContent);
            }
        }

        // ══════════════════════════════════════════════════════════════
        // ✅ NEW — ServiceTelegramMessages child-table operations.
        // These back TelegramBackgroundWorker's per-topic Send/Delete flow
        // so each Telegram topic keeps its own message id independently,
        // instead of all topics fighting over one Services.TelegramMessageId
        // column.
        // ══════════════════════════════════════════════════════════════

        /// <summary>
        /// Resolves the currently-live (not yet deleted) Telegram MessageId
        /// for a given service + topic. Used by the worker's Delete fallback
        /// path when the caller didn't already know the exact MessageId.
        /// </summary>
        public async Task<int?> GetLiveTelegramMessageIdAsync(Guid serviceId, string topicKey)
        {
            try
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(
                    $"/api/technicalservices/{serviceId}/telegram-message?topicKey={Uri.EscapeDataString(topicKey)}");

                var response = await _httpClient.GetAsync(fullUrl);

                if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                    return null;

                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                if (string.IsNullOrWhiteSpace(content))
                    return null;

                var result = JsonSerializer.Deserialize<TelegramMessageIdResponse>(content, _jsonOptions);
                return result?.MessageId;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to resolve live Telegram message id (ServiceId={ServiceId}, Topic={Topic})",
                    serviceId, topicKey);
                return null;
            }
        }

        /// <summary>
        /// Records a newly-sent Telegram message as a new row in
        /// ServiceTelegramMessages — never overwrites a prior topic's row.
        /// Called by the worker after a successful Send.
        /// </summary>
        public async Task SaveTelegramMessageAsync(Guid serviceId, string topicKey, int telegramMessageId)
        {
            try
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(
                    $"/api/technicalservices/{serviceId}/telegram-message");

                var payload = new
                {
                    TopicKey = topicKey,
                    MessageId = telegramMessageId
                };

                var response = await _httpClient.PostAsJsonAsync(fullUrl, payload);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("SaveTelegramMessageAsync error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to save Telegram message (ServiceId={ServiceId}, Topic={Topic})",
                    serviceId, topicKey);
            }
        }

        /// <summary>
        /// Soft-deletes the ServiceTelegramMessages row matching the given
        /// Telegram MessageId, so the periodic cleanup job can later purge it
        /// and so it's excluded from future "live message" lookups.
        /// Called by the worker after a successful Telegram deleteMessage call.
        /// </summary>
        public async Task MarkTelegramMessageDeletedAsync(int messageId)
        {
            try
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(
                    $"/api/technicalservices/telegram-message/{messageId}/mark-deleted");

                var response = await _httpClient.PostAsync(fullUrl, null);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("MarkTelegramMessageDeletedAsync error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to mark Telegram message deleted (MessageId={MessageId})", messageId);
            }
        }

        /// <summary>
        /// Hard-deletes old, already-soft-deleted ServiceTelegramMessages rows
        /// older than the given cutoff. Called periodically by the worker's
        /// cleanup loop to keep the table (and its indexes) from growing
        /// forever — bounded DB/memory footprint regardless of how long the
        /// app has been running.
        /// </summary>
        public async Task<int> PurgeOldTelegramMessageRecordsAsync(DateTime cutoffUtc, CancellationToken ct = default)
        {
            try
            {
                var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(
                    $"/api/technicalservices/telegram-message/purge?cutoff={cutoffUtc:O}");

                var response = await _httpClient.DeleteAsync(fullUrl, ct);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync(ct);
                    _logger.LogWarning("PurgeOldTelegramMessageRecordsAsync error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                    return 0;
                }

                var content = await response.Content.ReadAsStringAsync(ct);
                var result = JsonSerializer.Deserialize<PurgeResultResponse>(content, _jsonOptions);
                return result?.RemovedCount ?? 0;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to purge old Telegram message records");
                return 0;
            }
        }

        private class TelegramMessageIdResponse
        {
            public int? MessageId { get; set; }
        }

        private class PurgeResultResponse
        {
            public int RemovedCount { get; set; }
        }
    }

    public class PaginatedResult<T>
    {
        public List<T> Items { get; set; }
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
        public int TotalUsedQuantity { get; set; }
        public int TotalServiceUsedQuantity { get; set; }
        public int TotalManualUsedQuantity { get; set; }
        public bool HasPreviousPage => PageNumber > 1;
        public bool HasNextPage => PageNumber < TotalPages;
    }

    public class CompanyStatusSummaryDto
    {
        public string CompanyName { get; set; } = "";
        public int FinishedCount { get; set; }
        public int CustomerRejectedCount { get; set; }
        public int UnrepairableCount { get; set; }
        public int TotalCount { get; set; }
    }

    public class PaginatedApiResponse
    {
        public List<RepairServices> Items { get; set; }
        public int TotalCount { get; set; }
    }
}