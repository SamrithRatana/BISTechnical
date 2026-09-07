using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace UserManagementAPI.Models
{
    /// <summary>
    /// Stores individual user theme and appearance preferences (Mode, AccentColor, SurfaceStyle, Density, Radius, FontScale, etc.)
    /// </summary>
    [Table("UserPreferences", Schema = "security")]
    public class UserPreference
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(450)]
        public string UserId { get; set; } = null!;

        [Column(TypeName = "nvarchar(max)")]
        public string? ThemePreferencesJson { get; set; }

        /// <summary>
        /// RESERVED — not read or written by any endpoint today. The shipped
        /// report template is GLOBAL (AppSettings.ReportTemplateJson); this
        /// column stays mapped so the EF snapshot matches the database, and is
        /// available if per-user template overrides are ever wanted.
        /// </summary>
        [Column(TypeName = "nvarchar(max)")]
        public string? ReportTemplateJson { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public virtual ApplicationUser? User { get; set; }
    }
}
