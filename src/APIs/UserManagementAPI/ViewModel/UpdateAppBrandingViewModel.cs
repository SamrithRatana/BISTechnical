using System.ComponentModel.DataAnnotations;

namespace UserManagementAPI.ViewModel
{
    public class UpdateAppBrandingViewModel
    {
        [MaxLength(2048)]
        public string? LogoUrl { get; set; }

        [MaxLength(50)]
        public string? AccentColor { get; set; }

        public int? LogoScale { get; set; }

        [MaxLength(50)]
        public string? SurfaceStyle { get; set; }
    }
}
