using Microsoft.AspNetCore.Components.Forms;

namespace ServiceMaintenance.Services.KoompiCloudStorage.Helpers
{

    /// <summary>
    /// Converts a Blazor <see cref="IBrowserFile"/> or a base64 data URL
    /// into a byte array ready for <see cref="KoompiStorageService.UploadAsync"/>.
    /// </summary>
    public static class ImageUploadHelper
    {
        // ── From Blazor InputFile ────────────────────────────────────────────────

        /// <summary>
        /// Reads a Blazor browser file into bytes.
        /// Throws if the file exceeds <see cref="KoompiStorageConfig.MaxFileSizeBytes"/>.
        /// </summary>
        public static async Task<(byte[] Bytes, string ContentType, string FileName)>
            ReadBrowserFileAsync(IBrowserFile file)
        {
            await using var stream = file.OpenReadStream(KoompiStorageConfig.MaxFileSizeBytes);
            using var memStream = new MemoryStream();

            await stream.CopyToAsync(memStream);

            return (memStream.ToArray(),
                    string.IsNullOrWhiteSpace(file.ContentType) ? "image/jpeg" : file.ContentType,
                    file.Name);
        }

        // ── From base64 data URL (cropped / filtered preview) ───────────────────

        /// <summary>
        /// Extracts bytes from a "data:image/jpeg;base64,..." data URL string.
        /// Returns JPEG bytes with content-type "image/jpeg" and a generated filename.
        /// </summary>
        public static (byte[] Bytes, string ContentType, string FileName)
            ReadDataUrl(string dataUrl)
        {
            if (string.IsNullOrEmpty(dataUrl))
                throw new ArgumentException("Data URL is empty.", nameof(dataUrl));

            var comma = dataUrl.IndexOf(',');
            if (comma < 0)
                throw new FormatException("Invalid data URL format (no comma separator).");

            var bytes = Convert.FromBase64String(dataUrl[(comma + 1)..]);
            var contentType = "image/jpeg";
            var fileName = $"upload_{Guid.NewGuid():N}.jpg";

            return (bytes, contentType, fileName);
        }

        // ── Validation helpers ───────────────────────────────────────────────────

        public static bool IsValidImageType(IBrowserFile file)
        {
            var allowedMime = new[] { "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp" };
            var allowedExt = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var ext = Path.GetExtension(file.Name).ToLowerInvariant();

            return allowedMime.Contains(file.ContentType.ToLowerInvariant())
                || allowedExt.Contains(ext);
        }

        public static bool IsWithinSizeLimit(IBrowserFile file)
            => file.Size <= KoompiStorageConfig.MaxFileSizeBytes;
    }





}
