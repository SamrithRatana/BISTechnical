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

            // Additional check: verify file signature (magic numbers)
            try
            {
                using var reader = new BinaryReader(file.OpenReadStream());
                var signatures = new Dictionary<string, List<byte[]>>
                {
                    { ".jpg", new List<byte[]> { new byte[] { 0xFF, 0xD8, 0xFF } } },
                    { ".jpeg", new List<byte[]> { new byte[] { 0xFF, 0xD8, 0xFF } } },
                    { ".png", new List<byte[]> { new byte[] { 0x89, 0x50, 0x4E, 0x47 } } },
                    { ".webp", new List<byte[]> { new byte[] { 0x52, 0x49, 0x46, 0x46 } } }
                };

                var headerBytes = reader.ReadBytes(8);
                file.OpenReadStream().Position = 0; // Reset stream

                return signatures[extension].Any(signature =>
                    headerBytes.Take(signature.Length).SequenceEqual(signature));
            }
            catch
            {
                return false;
            }
        }

        public async Task<string> SaveProfilePictureAsync(IFormFile file, string userId)
        {
            try
            {
                _logger.LogInformation($"=== SAVE PROFILE PICTURE START ===");

                // ✅ FIX: Handle null WebRootPath in Docker
                var webRootPath = _environment.WebRootPath;

                if (string.IsNullOrEmpty(webRootPath))
                {
                    // In Docker, WebRootPath might be null, so we build it manually
                    webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
                    _logger.LogWarning($"WebRootPath was null, using ContentRootPath: {webRootPath}");
                }

                _logger.LogInformation($"WebRootPath: {webRootPath}");
                _logger.LogInformation($"ContentRootPath: {_environment.ContentRootPath}");

                // Uploads folder path
                var uploadsFolder = Path.Combine(webRootPath, "uploads", "profile-pictures");
                _logger.LogInformation($"Target folder: {uploadsFolder}");

                // ✅ Create uploads directory if it doesn't exist
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                    _logger.LogInformation($"Created directory: {uploadsFolder}");
                }

                // Generate unique filename
                var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                var fileName = $"{userId}_{DateTime.UtcNow.Ticks}{extension}";
                var filePath = Path.Combine(uploadsFolder, fileName);

                _logger.LogInformation($"Saving file to: {filePath}");

                // ✅ Save file with proper error handling
                using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await file.CopyToAsync(stream);
                    await stream.FlushAsync();
                }

                // ✅ Verify file was saved
                if (!File.Exists(filePath))
                {
                    throw new Exception($"File was not saved successfully: {filePath}");
                }

                var fileInfo = new FileInfo(filePath);
                _logger.LogInformation($"✅ File saved successfully: {filePath} ({fileInfo.Length} bytes)");

                // ✅ Return relative URL
                var relativePath = $"/uploads/profile-pictures/{fileName}";
                _logger.LogInformation($"✅ Returning relative path: {relativePath}");

                return relativePath;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error saving profile picture for user {UserId}", userId);
                throw;
            }
        }
        public async Task<bool> DeleteProfilePictureAsync(string fileUrl)
        {
            try
            {
                _logger.LogInformation($"=== DELETE PROFILE PICTURE START ===");
                _logger.LogInformation($"File URL to delete: {fileUrl}");

                if (string.IsNullOrEmpty(fileUrl))
                {
                    _logger.LogWarning("File URL is null or empty");
                    return false;
                }

                // Handle both relative and full URLs
                var relativePath = fileUrl;
                if (fileUrl.StartsWith("http://") || fileUrl.StartsWith("https://"))
                {
                    var uri = new Uri(fileUrl);
                    relativePath = uri.AbsolutePath;
                    _logger.LogInformation($"Extracted relative path from URL: {relativePath}");
                }

                var filePath = Path.Combine(
                    _environment.WebRootPath,
                    relativePath.TrimStart('/').Replace("/", Path.DirectorySeparatorChar.ToString())
                );

                _logger.LogInformation($"Full file path: {filePath}");

                if (File.Exists(filePath))
                {
                    await Task.Run(() => File.Delete(filePath));
                    _logger.LogInformation($"✅ File deleted successfully: {filePath}");
                    return true;
                }

                _logger.LogWarning($"File not found: {filePath}");
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error deleting profile picture: {FileUrl}", fileUrl);
                return false;
            }
        }
    }
}