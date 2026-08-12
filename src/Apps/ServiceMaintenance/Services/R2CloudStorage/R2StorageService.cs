using Amazon.S3;
using Amazon.S3.Model;
using ServiceMaintenance.Services.KoompiCloudStorage.CloudModels;
using ServiceMaintenance.Services.KoompiCloudStorage.Helpers;
using static ServiceMaintenance.Services.KoompiCloudStorage.CloudModels.KoompiStorageModels;

namespace ServiceMaintenance.Services.R2CloudStorage
{
    public class R2StorageService : IDisposable
    {
        private readonly AmazonS3Client _s3Client;
        private bool _disposed;

        public R2StorageService()
        {
            var config = new AmazonS3Config
            {
                ServiceURL = R2StorageConfig.ServiceUrl,
                ForcePathStyle = true
                // ✅ Removed RequestChecksumCalculation / ResponseChecksumValidation /
                // UseChunkEncoding — none of these exist on AmazonS3Config in
                // AWSSDK.S3 3.7.305.29 (added in later SDK versions).
                // Instead, DisablePayloadSigning is set per-request below.
            };
            _s3Client = new AmazonS3Client(R2StorageConfig.AccessKey, R2StorageConfig.SecretKey, config);
        }

        public async Task<KoompiUploadResult> UploadAsync(
            byte[] fileBytes,
            string fileName,
            string contentType,
            Func<UploadStatusInfo, Task>? onProgress = null)
        {
            try
            {
                await Notify(onProgress, UploadStatusInfo.Uploading());

                var key = $"{Guid.NewGuid():N}_{fileName}";

                using var stream = new MemoryStream(fileBytes);
                var putRequest = new PutObjectRequest
                {
                    BucketName = R2StorageConfig.BucketName,
                    Key = key,
                    InputStream = stream,
                    ContentType = contentType,
                    // ✅ Forces standard (non-streaming) SigV4 signing instead of
                    // STREAMING-AWS4-HMAC-SHA256-PAYLOAD, which R2 doesn't implement.
                    DisablePayloadSigning = true
                };
                putRequest.Headers.CacheControl = "public, max-age=31536000";

                await _s3Client.PutObjectAsync(putRequest);

                var publicUrl = $"{R2StorageConfig.PublicBaseUrl}/{key}";
                await Notify(onProgress, UploadStatusInfo.Done());

                return KoompiUploadResult.Ok(publicUrl);
            }
            catch (Exception ex)
            {
                await Notify(onProgress, UploadStatusInfo.Error(ex.Message));
                return KoompiUploadResult.Fail(ex.Message);
            }
        }

        private static async Task Notify(Func<UploadStatusInfo, Task>? callback, UploadStatusInfo info)
        {
            if (callback is not null)
                await callback(info);
        }

        public void Dispose()
        {
            if (_disposed) return;
            _s3Client?.Dispose();
            _disposed = true;
            GC.SuppressFinalize(this);
        }
    }
}