namespace UserManagementAPI.Services
{
    public interface IFileStorageService
    {
        Task<string> SaveProfilePictureAsync(IFormFile file, string userId);
        Task<bool> DeleteProfilePictureAsync(string filePath);
        bool IsValidImageFile(IFormFile file);
    }
}