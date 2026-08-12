using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.ViewModel
{
    public class UploadProfilePictureViewModel
    {
        [Required]
        public IFormFile ProfilePicture { get; set; }
    }
}
