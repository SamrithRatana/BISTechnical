using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using UserManagementAPI.Data;
using UserManagementAPI.Models;
using UserManagementAPI.ViewModel;

namespace UserManagementAPI.Controllers
{
    /// <summary>
    /// System-wide settings every signed-in user shares — currently just the
    /// sidebar logo (Settings → Theme &amp; Branding's per-user preferences,
    /// by contrast, live in the browser's own localStorage; this is the one
    /// setting that genuinely needs a server-side home because every user's
    /// browser has to see the same value).
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class AppSettingsController : ControllerBase
    {
        private readonly UserManagementContext _context;
        private readonly ILogger<AppSettingsController> _logger;

        public AppSettingsController(UserManagementContext context, ILogger<AppSettingsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/AppSettings/branding
        // Publicly accessible so that Login page and all users immediately see Global Brand Logo & Theme
        [HttpGet("branding")]
        [AllowAnonymous]
        public async Task<IActionResult> GetBranding()
        {
            var setting = await _context.AppSettings.AsNoTracking().FirstOrDefaultAsync();
            return Ok(new
            {
                logoUrl = setting?.LogoUrl,
                accentColor = setting?.AccentColor,
                logoScale = setting?.LogoScale ?? 130,
                surfaceStyle = setting?.SurfaceStyle ?? "cushion"
            });
        }

        // PUT: api/AppSettings/branding
        // Admin or SuperAdmin only: Sets global company branding across all users & devices
        [HttpPut("branding")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<IActionResult> UpdateBranding([FromBody] UpdateAppBrandingViewModel model)
        {
            var setting = await _context.AppSettings.FirstOrDefaultAsync();
            if (setting == null)
            {
                setting = new AppSetting { Id = 1 };
                _context.AppSettings.Add(setting);
            }

            if (model.LogoUrl != null)
            {
                setting.LogoUrl = string.IsNullOrWhiteSpace(model.LogoUrl) ? null : model.LogoUrl;
            }
            if (model.AccentColor != null)
            {
                setting.AccentColor = string.IsNullOrWhiteSpace(model.AccentColor) ? null : model.AccentColor;
            }
            if (model.LogoScale.HasValue)
            {
                setting.LogoScale = model.LogoScale.Value;
            }
            if (model.SurfaceStyle != null)
            {
                setting.SurfaceStyle = string.IsNullOrWhiteSpace(model.SurfaceStyle) ? "cushion" : model.SurfaceStyle;
            }

            setting.UpdatedAt = DateTime.UtcNow;
            setting.UpdatedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            await _context.SaveChangesAsync();
            _logger.LogInformation("Global App Branding updated by {UserId}: Logo={Logo}, Color={Color}, Scale={Scale}",
                setting.UpdatedByUserId, setting.LogoUrl, setting.AccentColor, setting.LogoScale);

            return Ok(new
            {
                logoUrl = setting.LogoUrl,
                accentColor = setting.AccentColor,
                logoScale = setting.LogoScale,
                surfaceStyle = setting.SurfaceStyle
            });
        }

        // GET: api/AppSettings/logo
        [HttpGet("logo")]
        [AllowAnonymous]
        public async Task<IActionResult> GetLogo()
        {
            var setting = await _context.AppSettings.AsNoTracking().FirstOrDefaultAsync();
            return Ok(new { logoUrl = setting?.LogoUrl });
        }

        // PUT: api/AppSettings/logo
        [HttpPut("logo")]
        [Authorize(Roles = "Admin,SuperAdmin")]
        public async Task<IActionResult> UpdateLogo([FromBody] UpdateAppLogoViewModel model)
        {
            var setting = await _context.AppSettings.FirstOrDefaultAsync();
            if (setting == null)
            {
                setting = new AppSetting { Id = 1 };
                _context.AppSettings.Add(setting);
            }

            setting.LogoUrl = string.IsNullOrWhiteSpace(model.LogoUrl) ? null : model.LogoUrl;
            setting.UpdatedAt = DateTime.UtcNow;
            setting.UpdatedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            await _context.SaveChangesAsync();
            _logger.LogInformation("App logo updated by {UserId}", setting.UpdatedByUserId);

            return Ok(new { logoUrl = setting.LogoUrl });
        }

        // GET: api/AppSettings/user-theme
        // Returns the authenticated user's personal theme preferences
        [HttpGet("user-theme")]
        [Authorize]
        public async Task<IActionResult> GetUserTheme()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            try
            {
                var pref = await _context.UserPreferences.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId);
                return Ok(new
                {
                    userId = userId,
                    themePreferencesJson = pref?.ThemePreferencesJson,
                    updatedAt = pref?.UpdatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to retrieve user theme preferences for {UserId}", userId);
                return Ok(new { userId = userId, themePreferencesJson = (string?)null });
            }
        }

        // PUT: api/AppSettings/user-theme
        // Saves/updates the authenticated user's personal theme preferences
        [HttpPut("user-theme")]
        [Authorize]
        public async Task<IActionResult> UpdateUserTheme([FromBody] UpdateUserThemeViewModel model)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            try
            {
                var pref = await _context.UserPreferences.FirstOrDefaultAsync(p => p.UserId == userId);
                if (pref == null)
                {
                    pref = new UserPreference
                    {
                        UserId = userId,
                        ThemePreferencesJson = model.ThemePreferencesJson,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _context.UserPreferences.Add(pref);
                }
                else
                {
                    pref.ThemePreferencesJson = model.ThemePreferencesJson;
                    pref.UpdatedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                return Ok(new
                {
                    userId = userId,
                    themePreferencesJson = pref.ThemePreferencesJson,
                    updatedAt = pref.UpdatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save user theme preferences for {UserId}", userId);
                return StatusCode(500, new { error = "Failed to persist user theme" });
            }
        }

        // GET: api/AppSettings/report-template
        // The COMPANY-WIDE printed-report template. Every signed-in user reads
        // the same row — publishing changes the report design for everyone.
        [HttpGet("report-template")]
        [Authorize]
        public async Task<IActionResult> GetReportTemplate()
        {
            try
            {
                var settings = await _context.AppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1);
                return Ok(new
                {
                    reportTemplateJson = settings?.ReportTemplateJson,
                    updatedAt = settings?.UpdatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to retrieve the report template");
                return Ok(new { reportTemplateJson = (string?)null });
            }
        }

        // PUT: api/AppSettings/report-template
        // Admin-scoped like the logo: this changes what every user prints.
        // Null clears back to the shipped default layout. Managers run the
        // report workflow day to day, so they can publish too (unlike the
        // logo, which stays Admin-only).
        [HttpPut("report-template")]
        [Authorize(Roles = "Admin,SuperAdmin,Manager")]
        public async Task<IActionResult> UpdateReportTemplate([FromBody] UpdateReportTemplateViewModel model)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            try
            {
                var settings = await _context.AppSettings.FirstOrDefaultAsync(s => s.Id == 1);
                if (settings == null)
                {
                    return NotFound(new { error = "AppSettings row missing" });
                }

                settings.ReportTemplateJson = model.ReportTemplateJson;
                settings.UpdatedAt = DateTime.UtcNow;
                settings.UpdatedByUserId = userId;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Report template published for all users by {UserId}", userId);
                return Ok(new { reportTemplateJson = settings.ReportTemplateJson, updatedAt = settings.UpdatedAt });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save the report template");
                return StatusCode(500, new { error = "Failed to persist report template" });
            }
        }
    }

    public class UpdateReportTemplateViewModel
    {
        public string? ReportTemplateJson { get; set; }
    }

    public class UpdateUserThemeViewModel
    {
        public string? ThemePreferencesJson { get; set; }
    }
}
