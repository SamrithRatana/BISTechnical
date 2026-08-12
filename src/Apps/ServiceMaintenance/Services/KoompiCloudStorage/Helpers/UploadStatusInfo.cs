namespace ServiceMaintenance.Services.KoompiCloudStorage.Helpers
{
    public enum UploadStep
    {
        Idle,
        ReadingFile,
        GettingToken,
        UploadingToCloud,
        Confirming,
        Success,
        Failed
    }

    public class UploadStatusInfo
    {
        public UploadStep Status { get; set; } = UploadStep.Idle;
        public string Message { get; set; } = string.Empty;
        public string Color { get; set; } = "black";

        /// True while any async cloud step is in progress — use to disable Save/Cancel buttons
        public bool IsBusy => Status is UploadStep.ReadingFile
                                     or UploadStep.GettingToken
                                     or UploadStep.UploadingToCloud
                                     or UploadStep.Confirming;

        /// True whenever the status bar should be visible
        public bool IsVisible => Status != UploadStep.Idle;

        // ── Factory helpers (same wording as your test /upload page) ────────────
        public static UploadStatusInfo Idle()
            => new()
            {
                Status = UploadStep.Idle,
                Message = string.Empty,
                Color = "black"
            };

        public static UploadStatusInfo Reading()
            => new()
            {
                Status = UploadStep.ReadingFile,
                Message = "📁 Reading image file...",
                Color = "orange"
            };

        public static UploadStatusInfo GettingToken()
            => new()
            {
                Status = UploadStep.GettingToken,
                Message = "🔑 Getting upload token...",
                Color = "orange"
            };

        public static UploadStatusInfo Uploading()
            => new()
            {
                Status = UploadStep.UploadingToCloud,
                Message = "⬆️ Uploading image to cloud...",
                Color = "#007bff"
            };

        public static UploadStatusInfo Confirming()
            => new()
            {
                Status = UploadStep.Confirming,
                Message = "✅ Confirming upload...",
                Color = "orange"
            };

        public static UploadStatusInfo Done()
            => new()
            {
                Status = UploadStep.Success,
                Message = "🎉 Upload successful!",
                Color = "green"
            };

        public static UploadStatusInfo Error(string error)
            => new()
            {
                Status = UploadStep.Failed,
                Message = $"❌ Upload failed: {error}",
                Color = "red"
            };
    }
}
