using ServiceMaintenance.Services.KoompiCloudStorage.CloudModels;
using ServiceMaintenance.Services.KoompiCloudStorage.Helpers;
using System.Net.Http.Headers;
using System.Text.Json;
using static ServiceMaintenance.Services.KoompiCloudStorage.CloudModels.KoompiStorageModels;

namespace ServiceMaintenance.Services.KoompiCloudStorage
{
    public class KoompiStorageService
    {
        private static readonly JsonSerializerOptions _jsonOpts = new()
        {
            PropertyNameCaseInsensitive = true
        };

        // ── Public entry point ───────────────────────────────────────────────────

        public async Task<KoompiUploadResult> UploadAsync(
            byte[] fileBytes,
            string fileName,
            string contentType,
            Func<UploadStatusInfo, Task>? onProgress = null)
        {
            try
            {
                // Step A
                await Notify(onProgress, UploadStatusInfo.GettingToken());
                var token = await GetUploadTokenAsync(fileName, contentType, fileBytes.Length);

                // Step B
                await Notify(onProgress, UploadStatusInfo.Uploading());
                await PutBytesToR2Async(token.UploadUrl, fileBytes, contentType);

                // Step C
                await Notify(onProgress, UploadStatusInfo.Confirming());
                await ConfirmUploadAsync(token.ObjectId);

                var publicUrl = $"{KoompiStorageConfig.CdnBase}/{token.Key}";

                await Notify(onProgress, UploadStatusInfo.Done());
                return KoompiUploadResult.Ok(publicUrl);
            }
            catch (Exception ex)
            {
                await Notify(onProgress, UploadStatusInfo.Error(ex.Message));
                return KoompiUploadResult.Fail(ex.Message);
            }
        }

        // ── Step A ───────────────────────────────────────────────────────────────

        private async Task<KoompiTokenData> GetUploadTokenAsync(
            string fileName, string contentType, long fileSize)
        {
            using var client = ApiClient();

            var payload = new KoompiUploadRequest
            {
                Filename = fileName,
                ContentType = contentType,
                Size = fileSize,
                Visibility = "public"
            };

            var res = await client.PostAsJsonAsync(
                $"{KoompiStorageConfig.ApiBase}/api/storage/upload-token", payload);

            var raw = await res.Content.ReadAsStringAsync();

            if (!res.IsSuccessStatusCode)
                throw new Exception($"Token API {res.StatusCode}: {raw}");

            var result = JsonSerializer.Deserialize<KoompiTokenResponse>(raw, _jsonOpts);

            if (result?.Success != true || result.Data == null)
                throw new Exception($"Token response invalid: {raw}");

            return result.Data;
        }

        // ── Step B ───────────────────────────────────────────────────────────────

        private static async Task PutBytesToR2Async(
            string uploadUrl, byte[] bytes, string contentType)
        {
            using var client = new HttpClient();
            using var content = new ByteArrayContent(bytes);

            content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            content.Headers.TryAddWithoutValidation("Cache-Control", "public, max-age=31536000");

            var res = await client.PutAsync(uploadUrl, content);
            var raw = await res.Content.ReadAsStringAsync();

            if (!res.IsSuccessStatusCode)
                throw new Exception($"R2 PUT {res.StatusCode}: {raw}");
        }

        // ── Step C ───────────────────────────────────────────────────────────────

        private async Task ConfirmUploadAsync(string objectId)
        {
            using var client = ApiClient();

            var res = await client.PostAsJsonAsync(
                $"{KoompiStorageConfig.ApiBase}/api/storage/complete",
                new { objectId });

            var raw = await res.Content.ReadAsStringAsync();

            if (!res.IsSuccessStatusCode)
                throw new Exception($"Complete API {res.StatusCode}: {raw}");
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private static HttpClient ApiClient()
        {
            var c = new HttpClient();
            c.DefaultRequestHeaders.Add("x-api-key", KoompiStorageConfig.ApiKey);
            return c;
        }

        private static async Task Notify(
            Func<UploadStatusInfo, Task>? callback, UploadStatusInfo info)
        {
            if (callback is not null)
                await callback(info);
        }
    }
}
