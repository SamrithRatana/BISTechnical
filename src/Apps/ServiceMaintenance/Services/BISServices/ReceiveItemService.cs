using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;
using Microsoft.Extensions.Logging;
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.BISServices
{
    public class ReceiveItemService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<ReceiveItemService> _logger;
        private const string ApiUrl = "/api/receiveitem";

        // ✅ Consistent request timeout across all methods (was only on Delete)
        private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(10);

        public ReceiveItemService(HttpClient httpClient, ILogger<ReceiveItemService> logger)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task CreateReceiveItemAsync(ReceiveItemRequest request)
        {
            // ✅ FIXED — fail fast with a clear message instead of a null-ref
            // deep inside PostAsJsonAsync's serializer.
            ArgumentNullException.ThrowIfNull(request, nameof(request));

            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiUrl);
            using var cts = new CancellationTokenSource(DefaultTimeout);

            try
            {
                var response = await _httpClient.PostAsJsonAsync(fullUrl, request, cts.Token);

                if (!response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError(
                        "Failed to create receive item. Status: {Status}, Response: {Response}",
                        response.StatusCode, responseContent);
                    throw new HttpRequestException(
                        $"Failed to create receive item. Status: {response.StatusCode}, Response: {responseContent}");
                }
            }
            catch (TaskCanceledException) when (!cts.IsCancellationRequested)
            {
                // ✅ Distinguishes an upstream/caller cancellation from our own timeout
                throw;
            }
            catch (TaskCanceledException)
            {
                _logger.LogWarning("Create receive item timed out after {Timeout}s", DefaultTimeout.TotalSeconds);
                throw new HttpRequestException($"Create receive item operation timed out after {DefaultTimeout.TotalSeconds} seconds");
            }
        }

        public async Task UpdateReceiveItemAsync(ReceiveItemRequest request)
        {
            ArgumentNullException.ThrowIfNull(request, nameof(request));

            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiUrl);
            using var cts = new CancellationTokenSource(DefaultTimeout);

            try
            {
                var response = await _httpClient.PutAsJsonAsync(fullUrl, request, cts.Token);

                if (!response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError(
                        "Failed to update receive item. Status: {Status}, Response: {Response}",
                        response.StatusCode, responseContent);
                    throw new HttpRequestException(
                        $"Failed to update receive item. Status: {response.StatusCode}, Response: {responseContent}");
                }
            }
            catch (TaskCanceledException) when (!cts.IsCancellationRequested)
            {
                throw;
            }
            catch (TaskCanceledException)
            {
                _logger.LogWarning("Update receive item timed out after {Timeout}s", DefaultTimeout.TotalSeconds);
                throw new HttpRequestException($"Update receive item operation timed out after {DefaultTimeout.TotalSeconds} seconds");
            }
        }

        public async Task DeleteReceiveItemAsync(Guid serviceId)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{ApiUrl}/{serviceId}?api-version=1.0");
            using var cts = new CancellationTokenSource(DefaultTimeout);

            try
            {
                var response = await _httpClient.DeleteAsync(fullUrl, cts.Token);

                if (!response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError(
                        "Failed to delete receive item {ServiceId}. Status: {Status}, Response: {Response}",
                        serviceId, response.StatusCode, responseContent);
                    throw new HttpRequestException(
                        $"Failed to delete receive item. Status: {response.StatusCode}, Response: {responseContent}");
                }
            }
            catch (TaskCanceledException) when (!cts.IsCancellationRequested)
            {
                throw;
            }
            catch (TaskCanceledException)
            {
                _logger.LogWarning("Delete operation timed out after {Timeout}s for {ServiceId}", DefaultTimeout.TotalSeconds, serviceId);
                throw new HttpRequestException($"Delete operation timed out after {DefaultTimeout.TotalSeconds} seconds");
            }
        }
    }
}