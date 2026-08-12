namespace ServiceMaintenance.Services.KoompiCloudStorage.CloudModels
{
    public class KoompiStorageModels
    {
        public class KoompiTokenResponse
        {
            public bool Success { get; set; }
            public KoompiTokenData? Data { get; set; }
        }

        public class KoompiTokenData
        {
            public string UploadUrl { get; set; } = string.Empty;
            public string ObjectId { get; set; } = string.Empty;
            public string Key { get; set; } = string.Empty;
        }

        // ── Upload request payload ───────────────────────────────────────────────────

        public class KoompiUploadRequest
        {
            public string Filename { get; set; } = string.Empty;
            public string ContentType { get; set; } = string.Empty;
            public long Size { get; set; }
            public string Visibility { get; set; } = "public";
        }

        // ── Result returned to the caller ───────────────────────────────────────────

        public class KoompiUploadResult
        {
            public bool Success { get; set; }
            public string PublicUrl { get; set; } = string.Empty;
            public string? ErrorMessage { get; set; }

            // Convenience factory methods
            public static KoompiUploadResult Ok(string url)
                => new() { Success = true, PublicUrl = url };

            public static KoompiUploadResult Fail(string error)
                => new() { Success = false, ErrorMessage = error };
        }





    }
}
