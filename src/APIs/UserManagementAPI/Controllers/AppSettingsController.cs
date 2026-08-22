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
    }
}
