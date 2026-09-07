namespace UserManagementAPI.Models
{
    /// <summary>
    /// System-wide settings shared by every signed-in user — currently just the
    /// sidebar logo. Deliberately a single fixed row (Id = 1), not a key/value
    /// table: there is exactly one setting today, and a generic table would be
    /// designing for settings that don't exist yet.
    /// </summary>
    public class AppSetting
    {
        public int Id { get; set; }
        public string? LogoUrl { get; set; }
        public string? AccentColor { get; set; }
        public int? LogoScale { get; set; }
        public string? SurfaceStyle { get; set; }

        /// <summary>
        /// The company-wide printed-report template (services/reportTemplate.ts
        /// JSON). Global on purpose: publishing from Templates Settings changes
        /// the report design for EVERY user, like the logo above. Null = the
        /// shipped default layout. Presentation only — report data queries
        /// never read this.
        /// </summary>
        public string? ReportTemplateJson { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? UpdatedByUserId { get; set; }
    }
}
