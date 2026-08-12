namespace ServiceMaintenance.Services.R2CloudStorage
{
    public static class R2StorageConfig
    {
        public const string AccountId = "57672dc64a9d68fea854c7fae5c824f4";
        public const string AccessKey = "924edff78284ac069f992b0a05601b77";
        public const string SecretKey = "59ee20266e96641c7e476a1b050c22b3d464ec95da42f9ac4d1f0bc8c0abedd3";
        public const string BucketName = "cam-storage";
        public const string PublicBaseUrl = "https://pub-c837739939744d62afcc56caa2bda22b.r2.dev"; // or your custom domain
        public static string ServiceUrl => $"https://{AccountId}.r2.cloudflarestorage.com";
        public const int MaxFileSizeBytes = 10 * 1024 * 1024;
    }
}