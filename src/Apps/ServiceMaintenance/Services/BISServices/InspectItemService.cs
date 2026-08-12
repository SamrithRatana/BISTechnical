using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using ServiceMaintenance.Models;
using ServiceMaintenance.Configuration;

namespace ServiceMaintenance.Services.BISServices
{
    public class InspectItemService
    {
        private readonly HttpClient _httpClient;
        private const string ApiUrl = "/api/inspectitem";
        private const string RepairServicesApiUrl = "/api/technicalservices";

        public InspectItemService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        // ─── Shared error extractor ──────────────────────────────────────────────
        /// <summary>
        /// Reads the response body and extracts the most useful error message.
        /// Handles plain text, JSON { "message": "..." }, JSON { "title": "..." },
        /// and raw SQL/trigger messages embedded anywhere in the body.
        /// </summary>
        private static async Task<string> ExtractErrorMessageAsync(HttpResponseMessage response)
        {
            var body = await response.Content.ReadAsStringAsync();

            if (string.IsNullOrWhiteSpace(body))
                return $"HTTP {(int)response.StatusCode} {response.StatusCode}";

            // ── Try to parse as JSON ─────────────────────────────────────────────
            try
            {
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;

                // ASP.NET Core problem-details / custom { message } shape
                foreach (var key in new[] { "message", "Message", "title", "Title", "detail", "Detail" })
                {
                    if (root.TryGetProperty(key, out var prop) &&
                        prop.ValueKind == JsonValueKind.String)
                    {
                        var text = prop.GetString();
                        if (!string.IsNullOrWhiteSpace(text))
                            return text;
                    }
                }

                // ASP.NET Core validation errors: { "errors": { "field": ["msg"] } }
                if (root.TryGetProperty("errors", out var errors) &&
                    errors.ValueKind == JsonValueKind.Object)
                {
                    foreach (var field in errors.EnumerateObject())
                    {
                        if (field.Value.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in field.Value.EnumerateArray())
                            {
                                var msg = item.GetString();
                                if (!string.IsNullOrWhiteSpace(msg))
                                    return msg;
                            }
                        }
                    }
                }
            }
            catch
            {
                // Not valid JSON — fall through to plain-text handling
            }

            // ── Plain-text / mixed body ──────────────────────────────────────────
            // SQL trigger messages like "Insufficient stock for: X. Available: 3, Required: 4"
            // may appear anywhere in a verbose .NET exception response body.
            var lines = body.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

            foreach (var line in lines)
            {
                var trimmed = line.Trim();

                // Prioritise the stock-validation message from the trigger
                if (trimmed.StartsWith("Insufficient stock", StringComparison.OrdinalIgnoreCase))
                    return trimmed;
            }

            // Return the first non-empty line as a fallback (avoids dumping the whole stack)
            foreach (var line in lines)
            {
                var trimmed = line.Trim();
                if (trimmed.Length > 0 && !trimmed.StartsWith("at "))   // skip stack frames
                    return trimmed;
            }

            return body; // absolute last resort
        }

        // ─── POST — Create new inspection ────────────────────────────────────────
        public async Task CreateInspectItemAsync(Guid serviceId, InspectItemRequest request)
        {
            foreach (var sparePart in request.SpareParts)
                sparePart.ServiceId = serviceId;

            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiUrl);
            var response = await _httpClient.PostAsJsonAsync(fullUrl, request);

            if (!response.IsSuccessStatusCode)
            {
                var message = await ExtractErrorMessageAsync(response);
                throw new HttpRequestException(message, null, response.StatusCode);
            }
        }

        // ─── PUT — Update existing inspection ────────────────────────────────────
        public async Task UpdateInspectItemAsync(Guid serviceId, InspectItemRequest request)
        {
            foreach (var sparePart in request.SpareParts)
                sparePart.ServiceId = serviceId;

            request.Id = serviceId;

            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(ApiUrl);
            var response = await _httpClient.PutAsJsonAsync(fullUrl, request);

            if (!response.IsSuccessStatusCode)
            {
                var message = await ExtractErrorMessageAsync(response);
                throw new HttpRequestException(message, null, response.StatusCode);
            }
        }

        // ─── DELETE — Remove spare part item from inspection ─────────────────────
        public async Task<bool> DeleteSparepartItemAsync(Guid serviceId, Guid sparepartItemId)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl(
                $"{ApiUrl}/{serviceId}/spareparts/{sparepartItemId}");

            var response = await _httpClient.DeleteAsync(fullUrl);

            if (!response.IsSuccessStatusCode)
            {
                var message = await ExtractErrorMessageAsync(response);
                throw new HttpRequestException(message, null, response.StatusCode);
            }

            return true;
        }

        // ─── GET — Repair service by ID ──────────────────────────────────────────
        public async Task<RepairServices> GetRepairServiceByIdAsync(Guid id)
        {
            var fullUrl = ApiConfiguration.BuildTechnicalServicesUrl($"{RepairServicesApiUrl}/{id}");
            var response = await _httpClient.GetAsync(fullUrl);

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                return null;

            if (!response.IsSuccessStatusCode)
            {
                var message = await ExtractErrorMessageAsync(response);
                throw new HttpRequestException(message, null, response.StatusCode);
            }

            return await response.Content.ReadFromJsonAsync<RepairServices>();
        }
    }
}