using System;
using System.Threading.Tasks;
using Microsoft.JSInterop;

namespace ServiceMaintenance.Services
{
    public class ThemeConfig
    {
        public string Mode { get; set; } = "light";
        public string PrimaryColor { get; set; } = "#1FA9D3";
        public string SecondaryColor { get; set; } = "#007bff";
        public string AccentColor { get; set; } = "#20c997";
        public string SurfaceBg { get; set; } = "#f8f9fa";
        public string CardBg { get; set; } = "#ffffff";
        public string SidebarBg { get; set; } = "#ffffff";
        public string TopbarBg { get; set; } = "#ffffff";
        public string HeaderBg { get; set; } = "#1FA9D3";
        public string TextPrimary { get; set; } = "#212529";
        public string TextSecondary { get; set; } = "#6c757d";
        public string FontFamily { get; set; } = "'Khmer OS Siemreap', 'Helvetica Neue', Helvetica, Arial, sans-serif";
        public int BorderRadiusPx { get; set; } = 8;
        public int ButtonRadiusPx { get; set; } = 6;
        public int TablePaddingPx { get; set; } = 8;
        public int TableRadiusPx { get; set; } = 6;
        public int BaseFontSizePx { get; set; } = 14;
        public bool GlassmorphismEnabled { get; set; } = false;
        public bool EnableGlowEffects { get; set; } = false;
    }

    public class AppThemeService
    {
        private readonly IJSRuntime _jsRuntime;
        public ThemeConfig CurrentTheme { get; private set; } = new ThemeConfig();

        public event Action? OnThemeChanged;

        public AppThemeService(IJSRuntime jsRuntime)
        {
            _jsRuntime = jsRuntime;
        }

        public async Task InitializeThemeAsync()
        {
            try
            {
                var json = await _jsRuntime.InvokeAsync<string>("themeEngine.loadSavedTheme");
                if (!string.IsNullOrWhiteSpace(json))
                {
                    var saved = System.Text.Json.JsonSerializer.Deserialize<ThemeConfig>(json);
                    if (saved != null)
                    {
                        CurrentTheme = saved;
                    }
                }
                await ApplyCurrentThemeAsync();
            }
            catch
            {
                // Fallback to defaults
                await ApplyCurrentThemeAsync();
            }
        }

        public async Task SetThemeConfigAsync(ThemeConfig config)
        {
            CurrentTheme = config;
            await ApplyCurrentThemeAsync();
            await SaveThemeToStorageAsync();
            OnThemeChanged?.Invoke();
        }

        public async Task ResetToDefaultsAsync()
        {
            CurrentTheme = new ThemeConfig();
            await ApplyCurrentThemeAsync();
            await SaveThemeToStorageAsync();
            OnThemeChanged?.Invoke();
        }

        public async Task SetModeAsync(string mode)
        {
            CurrentTheme.Mode = mode;

            switch (mode.ToLowerInvariant())
            {
                case "midnight":
                    CurrentTheme.PrimaryColor = "#3b82f6";
                    CurrentTheme.SecondaryColor = "#1d4ed8";
                    CurrentTheme.AccentColor = "#60a5fa";
                    CurrentTheme.SurfaceBg = "#0b132b";
                    CurrentTheme.CardBg = "#1c2541";
                    CurrentTheme.SidebarBg = "#1c2541";
                    CurrentTheme.TopbarBg = "#0b132b";
                    CurrentTheme.HeaderBg = "#3b82f6";
                    CurrentTheme.TextPrimary = "#ffffff";
                    CurrentTheme.TextSecondary = "#94a3b8";
                    break;

                case "rose":
                    CurrentTheme.PrimaryColor = "#e11d48";
                    CurrentTheme.SecondaryColor = "#be123c";
                    CurrentTheme.AccentColor = "#fb7185";
                    CurrentTheme.SurfaceBg = "#180914";
                    CurrentTheme.CardBg = "#2d0d25";
                    CurrentTheme.SidebarBg = "#2d0d25";
                    CurrentTheme.TopbarBg = "#180914";
                    CurrentTheme.HeaderBg = "#e11d48";
                    CurrentTheme.TextPrimary = "#ffffff";
                    CurrentTheme.TextSecondary = "#fda4af";
                    break;

                case "light":
                    CurrentTheme.PrimaryColor = "#1FA9D3";
                    CurrentTheme.SurfaceBg = "#f8fafc";
                    CurrentTheme.CardBg = "#ffffff";
                    CurrentTheme.SidebarBg = "#ffffff";
                    CurrentTheme.TopbarBg = "#ffffff";
                    CurrentTheme.HeaderBg = "#1FA9D3";
                    CurrentTheme.TextPrimary = "#0f172a";
                    CurrentTheme.TextSecondary = "#475569";
                    break;

                case "cyberpunk":
                    CurrentTheme.PrimaryColor = "#00ffcc";
                    CurrentTheme.SecondaryColor = "#ff007f";
                    CurrentTheme.AccentColor = "#ffe600";
                    CurrentTheme.SurfaceBg = "#05050d";
                    CurrentTheme.CardBg = "rgba(15, 15, 30, 0.9)";
                    CurrentTheme.SidebarBg = "#0a0a16";
                    CurrentTheme.TopbarBg = "#05050d";
                    CurrentTheme.TextPrimary = "#ffffff";
                    CurrentTheme.TextSecondary = "#a0a0c0";
                    break;

                case "luxury":
                    CurrentTheme.PrimaryColor = "#d4af37"; // Gold
                    CurrentTheme.SecondaryColor = "#aa7c11";
                    CurrentTheme.AccentColor = "#e5c158";
                    CurrentTheme.SurfaceBg = "#111111";
                    CurrentTheme.CardBg = "rgba(26, 26, 26, 0.95)";
                    CurrentTheme.SidebarBg = "#181818";
                    CurrentTheme.TopbarBg = "#111111";
                    CurrentTheme.TextPrimary = "#f3f3f3";
                    CurrentTheme.TextSecondary = "#b3b3b3";
                    break;

                case "emerald":
                    CurrentTheme.PrimaryColor = "#10b981";
                    CurrentTheme.SecondaryColor = "#059669";
                    CurrentTheme.AccentColor = "#34d399";
                    CurrentTheme.SurfaceBg = "#064e3b";
                    CurrentTheme.CardBg = "rgba(6, 78, 59, 0.85)";
                    CurrentTheme.SidebarBg = "#022c22";
                    CurrentTheme.TopbarBg = "#064e3b";
                    CurrentTheme.TextPrimary = "#ecfdf5";
                    CurrentTheme.TextSecondary = "#a7f3d0";
                    break;

                case "ocean":
                    CurrentTheme.PrimaryColor = "#0284c7";
                    CurrentTheme.SecondaryColor = "#0369a1";
                    CurrentTheme.AccentColor = "#38bdf8";
                    CurrentTheme.SurfaceBg = "#0c4a6e";
                    CurrentTheme.CardBg = "rgba(12, 74, 110, 0.85)";
                    CurrentTheme.SidebarBg = "#082f49";
                    CurrentTheme.TopbarBg = "#0c4a6e";
                    CurrentTheme.TextPrimary = "#f0f9ff";
                    CurrentTheme.TextSecondary = "#bae6fd";
                    break;

                case "glass":
                    CurrentTheme.PrimaryColor = "#38bdf8";
                    CurrentTheme.SecondaryColor = "#0284c7";
                    CurrentTheme.AccentColor = "#7dd3fc";
                    CurrentTheme.SurfaceBg = "#0f172a";
                    CurrentTheme.CardBg = "rgba(255, 255, 255, 0.08)";
                    CurrentTheme.SidebarBg = "rgba(15, 23, 42, 0.85)";
                    CurrentTheme.TopbarBg = "rgba(15, 23, 42, 0.85)";
                    CurrentTheme.HeaderBg = "#0284c7";
                    CurrentTheme.TextPrimary = "#f8fafc";
                    CurrentTheme.TextSecondary = "#94a3b8";
                    CurrentTheme.GlassmorphismEnabled = true;
                    break;

                case "cyberglass":
                    CurrentTheme.PrimaryColor = "#a855f7";
                    CurrentTheme.SecondaryColor = "#7e22ce";
                    CurrentTheme.AccentColor = "#c084fc";
                    CurrentTheme.SurfaceBg = "#09090b";
                    CurrentTheme.CardBg = "rgba(255, 255, 255, 0.06)";
                    CurrentTheme.SidebarBg = "rgba(9, 9, 11, 0.9)";
                    CurrentTheme.TopbarBg = "rgba(9, 9, 11, 0.9)";
                    CurrentTheme.HeaderBg = "#7e22ce";
                    CurrentTheme.TextPrimary = "#fafafa";
                    CurrentTheme.TextSecondary = "#a1a1aa";
                    CurrentTheme.GlassmorphismEnabled = true;
                    break;

                case "material":
                    CurrentTheme.PrimaryColor = "#6750A4";
                    CurrentTheme.SecondaryColor = "#625B71";
                    CurrentTheme.AccentColor = "#7D5260";
                    CurrentTheme.SurfaceBg = "#FEF7FF";
                    CurrentTheme.CardBg = "#F7F2FA";
                    CurrentTheme.SidebarBg = "#F3EDF7";
                    CurrentTheme.TopbarBg = "#6750A4";
                    CurrentTheme.HeaderBg = "#6750A4";
                    CurrentTheme.TextPrimary = "#1D1B20";
                    CurrentTheme.TextSecondary = "#49454F";
                    CurrentTheme.ButtonRadiusPx = 20;
                    CurrentTheme.BorderRadiusPx = 16;
                    CurrentTheme.TableRadiusPx = 12;
                    CurrentTheme.GlassmorphismEnabled = false;
                    break;

                case "materialdark":
                    CurrentTheme.PrimaryColor = "#D0BCFF";
                    CurrentTheme.SecondaryColor = "#CCC2DC";
                    CurrentTheme.AccentColor = "#EFB8C8";
                    CurrentTheme.SurfaceBg = "#141218";
                    CurrentTheme.CardBg = "#2B2930";
                    CurrentTheme.SidebarBg = "#211F26";
                    CurrentTheme.TopbarBg = "#141218";
                    CurrentTheme.HeaderBg = "#381E72";
                    CurrentTheme.TextPrimary = "#E6E0E9";
                    CurrentTheme.TextSecondary = "#CAC4D0";
                    CurrentTheme.ButtonRadiusPx = 20;
                    CurrentTheme.BorderRadiusPx = 16;
                    CurrentTheme.TableRadiusPx = 12;
                    CurrentTheme.GlassmorphismEnabled = false;
                    break;

                default: // dark
                    CurrentTheme.SurfaceBg = "#0f172a";
                    CurrentTheme.CardBg = "rgba(30, 41, 59, 0.85)";
                    CurrentTheme.SidebarBg = "#1e293b";
                    CurrentTheme.TopbarBg = "#0f172a";
                    CurrentTheme.TextPrimary = "#f8fafc";
                    CurrentTheme.TextSecondary = "#94a3b8";
                    break;
            }

            await ApplyCurrentThemeAsync();
            await SaveThemeToStorageAsync();
            OnThemeChanged?.Invoke();
        }

        public async Task SetPrimaryColorAsync(string color)
        {
            CurrentTheme.PrimaryColor = color;
            await ApplyCurrentThemeAsync();
            await SaveThemeToStorageAsync();
            OnThemeChanged?.Invoke();
        }

        private async Task ApplyCurrentThemeAsync()
        {
            try
            {
                var json = System.Text.Json.JsonSerializer.Serialize(CurrentTheme);
                await _jsRuntime.InvokeVoidAsync("themeEngine.applyTheme", json);
            }
            catch
            {
                // Ignore JS disconnected circuit during initial render
            }
        }

        private async Task SaveThemeToStorageAsync()
        {
            try
            {
                var json = System.Text.Json.JsonSerializer.Serialize(CurrentTheme);
                await _jsRuntime.InvokeVoidAsync("themeEngine.saveTheme", json);
            }
            catch
            {
                // Ignore storage save errors
            }
        }
    }
}
