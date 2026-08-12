using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.ViewModel
{
    public class UpdateProfilePictureUrlViewModel
    {
        [Required]
        [MaxLength(500)]
        [Url]
        public string ProfilePictureUrl { get; set; }
    }
}
