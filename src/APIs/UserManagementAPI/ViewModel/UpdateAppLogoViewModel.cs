using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.ViewModel
{
    public class UpdateAppLogoViewModel
    {
        /// <summary>Empty string clears the logo back to the default sidebar mark.</summary>
        [MaxLength(2048)]
        public string? LogoUrl { get; set; }
    }
}
