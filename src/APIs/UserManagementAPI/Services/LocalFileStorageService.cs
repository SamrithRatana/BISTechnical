using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace UserManagementAPI.Services
{
    public class LocalFileStorageService : IFileStorageService
    {
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<LocalFileStorageService> _logger;
        private const long MaxFileSize = 5 * 1024 * 1024; // 5MB
        private readonly string[] _allowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };

        /// <summary>Folder, relative to the web root, that profile pictures live in.</summary>
        private static readonly string[] ProfilePictureFolder = { "uploads", "profile-pictures" };

        public LocalFileStorageService(
            IWebHostEnvironment environment,
            ILogger<LocalFileStorageService> logger)
        {
            _environment = environment;
            _logger = logger;
        }

        public bool IsValidImageFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return false;

            if (file.Length > MaxFileSize)
                return false;

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!_allowedExtensions.Contains(extension))
                return false;

            // Additional check: verify the file signature (magic numbers), so a
            // renamed executable cannot be uploaded as ".png".
            try
            {
                using var reader = new BinaryReader(file.OpenReadStream());

                // 12 bytes, not 8: a WebP file is "RIFF" + 4 size bytes +
                // "WEBP", so the format marker sits at offset 8. Checking only
                // "RIFF" accepted any RIFF container - a .wav or .avi passed as
                // an image.
                var headerBytes = reader.ReadBytes(12);

                return extension switch
                {
                    ".jpg" or ".jpeg" => StartsWith(headerBytes, 0xFF, 0xD8, 0xFF),
                    ".png" => StartsWith(headerBytes, 0x89, 0x50, 0x4E, 0x47),
                    ".webp" => StartsWith(headerBytes, 0x52, 0x49, 0x46, 0x46) &&
                               HasAt(headerBytes, 8, 0x57, 0x45, 0x42, 0x50),
                    _ => false,
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not read the signature of the uploaded file.");
                return false;
            }
        }

        private static bool StartsWith(byte[] buffer, params byte[] signature) =>
            HasAt(buffer, 0, signature);

        private static bool HasAt(byte[] buffer, int offset, params byte[] signature)
        {
            if (buffer.Length < offset + signature.Length)
            {
                return false;
            }

            for (var i = 0; i < signature.Length; i++)
            {
                if (buffer[offset + i] != signature[i])
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// `IWebHostEnvironment.WebRootPath` is null in some Docker setups.
        /// Shared by both save and delete — `DeleteProfilePictureAsync` used
        /// to read `_environment.WebRootPath` directly with no fallback,
        /// while this same null case was already handled here in
        /// `SaveProfilePictureAsync`. In that environment, a saved picture
        /// could never later be deleted: `Path.Combine(null, ...)` throws,
        /// the surrounding catch swallows it, and cleanup silently failed
        /// every time — orphaned files accumulating with no visible error.
        /// </summary>
        private string GetWebRootPath()
        {
            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrEmpty(webRootPath))
            {
                webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
                _logger.LogWarning("WebRootPath was null, using ContentRootPath: {WebRootPath}", webRootPath);
            }
            return webRootPath;
        }

        public async Task<string> SaveProfilePictureAsync(IFormFile file, string userId)
        {
            try
            {
                var uploadsFolder = Path.Combine(GetWebRootPath(), Path.Combine(ProfilePictureFolder));
                Directory.CreateDirectory(uploadsFolder);

                // The stored name is derived entirely from the user id and a
                // timestamp; the client's original file name is never used to
                // build a path, only to read the extension (already validated
                // against the allow-list above).
                var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                var fileName = $"{userId}_{DateTime.UtcNow.Ticks}{extension}";
                var filePath = Path.Combine(uploadsFolder, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await file.CopyToAsync(stream);
                    await stream.FlushAsync();
                }

                _logger.LogInformation(
                    "Saved profile picture for user {UserId} ({Length} bytes).", userId, file.Length);

                return $"/uploads/profile-pictures/{fileName}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving profile picture for user {UserId}", userId);
                throw;
            }
        }

        public Task<bool> DeleteProfilePictureAsync(string fileUrl)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(fileUrl))
                {
                    _logger.LogWarning("File URL is null or empty");
                    return Task.FromResult(false);
                }

                // Handle both relative and full URLs
                var relativePath = fileUrl;
                if (fileUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                    fileUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    if (!Uri.TryCreate(fileUrl, UriKind.Absolute, out var uri))
                    {
                        _logger.LogWarning("Profile picture URL could not be parsed.");
                        return Task.FromResult(false);
                    }

                    relativePath = Uri.UnescapeDataString(uri.AbsolutePath);
                }

                var webRootPath = GetWebRootPath();
                var profileFolder = Path.GetFullPath(
                    Path.Combine(webRootPath, Path.Combine(ProfilePictureFolder)));

                var candidate = Path.GetFullPath(Path.Combine(
                    webRootPath,
                    relativePath.TrimStart('/', '\\')
                                .Replace('/', Path.DirectorySeparatorChar)));

                // Containment check. Without it, a stored URL of
                // "/../../appsettings.json" resolved to a path outside the web
                // root and this method deleted it - and the profile picture URL
                // is caller-supplied (see UpdateProfilePictureUrl), so that
                // string is not necessarily one this service produced.
                if (!IsInside(profileFolder, candidate))
                {
                    _logger.LogWarning(
                        "Refusing to delete a profile picture outside the uploads folder.");
                    return Task.FromResult(false);
                }

                if (!File.Exists(candidate))
                {
                    _logger.LogWarning("Profile picture not found on disk.");
                    return Task.FromResult(false);
                }

                // File.Delete is a fast syscall; the previous Task.Run only
                // moved it to a thread-pool thread and back.
                File.Delete(candidate);
                _logger.LogInformation("Deleted profile picture.");
                return Task.FromResult(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting profile picture.");
                return Task.FromResult(false);
            }
        }

        /// <summary>True when <paramref name="candidate"/> sits under <paramref name="root"/>.</summary>
        private static bool IsInside(string root, string candidate)
        {
            var normalisedRoot = root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;

            return candidate.StartsWith(normalisedRoot, StringComparison.OrdinalIgnoreCase);
        }
    }
}
