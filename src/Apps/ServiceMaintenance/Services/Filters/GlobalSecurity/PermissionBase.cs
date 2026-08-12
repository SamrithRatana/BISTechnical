using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using DevExpress.Blazor;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ServiceMaintenance.Services.Filters.GlobalSecurity
{
    /// <summary>
    /// Base class for pages with permission-based access control
    /// Inherit from this class to automatically handle permissions
    /// Module name is automatically derived from the class name
    ///
    /// ✅ FIXED: All Console.WriteLine calls replaced with ILogger calls.
    /// Console.WriteLine bypasses appsettings.json's Logging:LogLevel config
    /// entirely, which is why the "🔐 Loading permissions...", "📄 Auto-detected
    /// module name...", etc. lines kept printing even after PermissionService
    /// itself was quieted down. Now everything routes through the same
    /// logging pipeline and respects the same config:
    ///   "ServiceMaintenance.Services.Filters.GlobalSecurity.PermissionBase": "Warning"
    /// Routine flow (module detected, permissions loaded) is LogDebug.
    /// Actual problems (exceptions, permission denied) stay at Warning/Error.
    /// </summary>
    public abstract class PermissionBase : ComponentBase
    {
        [Inject] protected PermissionService PermissionService { get; set; }
        [Inject] protected NavigationManager Navigation { get; set; }
        [Inject] protected AuthenticationStateProvider AuthenticationStateProvider { get; set; }
        [Inject] protected IToastNotificationService ToastNotificationService { get; set; }
        [Inject] protected ILogger<PermissionBase> Logger { get; set; }

        private bool _canAccess;
        private Dictionary<string, bool> _permissions = new Dictionary<string, bool>();
        private bool _permissionsLoaded = false;
        private bool _hasNavigated = false; // ✅ Prevent multiple redirects

        // ===== PUBLIC PERMISSION PROPERTIES =====
        /// <summary>
        /// User has access to this module/page
        /// </summary>
        protected bool CanAccess => _canAccess;

        /// <summary>
        /// User can view records
        /// </summary>
        protected bool CanView => _canAccess && _permissions.GetValueOrDefault("View", false);

        /// <summary>
        /// User can create new records
        /// </summary>
        protected bool CanCreate => _canAccess && _permissions.GetValueOrDefault("Create", false);

        /// <summary>
        /// User can edit existing records
        /// </summary>
        protected bool CanEdit => _canAccess && _permissions.GetValueOrDefault("Edit", false);

        /// <summary>
        /// User can delete records
        /// </summary>
        protected bool CanDelete => _canAccess && _permissions.GetValueOrDefault("Delete", false);

        /// <summary>
        /// User can print/generate reports
        /// </summary>
        protected bool CanPrint => _canAccess && _permissions.GetValueOrDefault("Print", false);

        /// <summary>
        /// User can export data (Excel/PDF)
        /// </summary>
        protected bool CanExport => _canAccess && _permissions.GetValueOrDefault("Export", false);

        /// <summary>
        /// Check if permissions have been loaded
        /// </summary>
        protected bool PermissionsLoaded => _permissionsLoaded;

        // ===== INITIALIZATION =====

        protected override async Task OnInitializedAsync()
        {
            await LoadPermissionsAsync();

            // Call child initialization only if access is granted
            await OnPermissionsLoadedAsync();

            await base.OnInitializedAsync();
        }

        /// <summary>
        /// Load permissions for the current module
        /// </summary>
        private async Task LoadPermissionsAsync()
        {
            try
            {
                var moduleName = GetModuleName();
                Logger.LogDebug("🔐 Loading permissions for module: {ModuleName}", moduleName);

                _canAccess = await PermissionService.CheckModuleAccessAsync(moduleName);

                if (_canAccess)
                {
                    _permissions = await PermissionService.CheckModulePermissionsAsync(moduleName);
                }

                _permissionsLoaded = true;

                Logger.LogDebug(
                    "✅ Permissions loaded - Access: {CanAccess}, Create: {CanCreate}, Edit: {CanEdit}, Delete: {CanDelete}",
                    _canAccess, CanCreate, CanEdit, CanDelete);
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "❌ Error loading permissions");
                _canAccess = false;
                _permissions = new Dictionary<string, bool>();
                _permissionsLoaded = true;
            }
        }

        // ===== ABSTRACT/VIRTUAL METHODS =====

        /// <summary>
        /// Gets the module name for permission checks
        /// AUTOMATICALLY extracts from the class name
        /// Examples: "ReceiveItemList" -> "ReceiveItemList"
        ///           "InspectItem" -> "InspectItem"
        ///           "RepairServiceModule" -> "RepairServiceModule"
        /// 
        /// Override this ONLY if you need custom module name mapping
        /// </summary>
        protected virtual string GetModuleName()
        {
            var typeName = GetType().Name;

            // ✅ Don't strip "Page" suffix for report pages
            if (typeName.Contains("Report") && typeName.EndsWith("Page"))
            {
                Logger.LogDebug("📄 Report page detected - keeping full name: {TypeName}", typeName);
                return typeName; // Keep the full name for report pages
            }

            // Remove common suffixes if present (for other pages)
            var suffixesToRemove = new[] { "Base", "Component" }; // Removed "Page" from here

            foreach (var suffix in suffixesToRemove)
            {
                if (typeName.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                {
                    typeName = typeName.Substring(0, typeName.Length - suffix.Length);
                    break;
                }
            }

            Logger.LogDebug("📄 Auto-detected module name: {TypeName} (from class: {ClassName})", typeName, GetType().Name);

            return typeName;
        }

        /// <summary>
        /// Called after permissions are loaded and access is granted
        /// Override this instead of OnInitializedAsync for permission-dependent initialization
        /// </summary>
        protected virtual Task OnPermissionsLoadedAsync()
        {
            return Task.CompletedTask;
        }

        // ===== HELPER METHODS =====

        /// <summary>
        /// Check if user has a specific permission and show toast if denied
        /// Usage: if (!RequirePermission(CanCreate, "create")) return;
        /// </summary>
        protected bool RequirePermission(bool hasPermission, string actionName)
        {
            if (!hasPermission)
            {
                ShowPermissionDenied(actionName);
                return false;
            }
            return true;
        }

        /// <summary>
        /// Check if user has any of the specified permissions
        /// </summary>
        protected bool HasAnyPermission(params bool[] permissions)
        {
            foreach (var permission in permissions)
            {
                if (permission) return true;
            }
            return false;
        }

        /// <summary>
        /// Check if user has all specified permissions
        /// </summary>
        protected bool HasAllPermissions(params bool[] permissions)
        {
            foreach (var permission in permissions)
            {
                if (!permission) return false;
            }
            return true;
        }

        /// <summary>
        /// Show permission denied toast notification
        /// </summary>
        protected void ShowPermissionDenied(string action)
        {
            if (ToastNotificationService != null)
            {
                ToastNotificationService.ShowToast(new ToastOptions
                {
                    ProviderName = "Error",
                    Title = "Permission Denied",
                    Text = $"You don't have permission to {action}",
                    ThemeMode = ToastThemeMode.Pastel,
                    RenderStyle = ToastRenderStyle.Danger
                });
            }
            else
            {
                Logger.LogWarning("⚠️ Permission denied: {Action}", action);
            }
        }

        /// <summary>
        /// Show warning toast notification
        /// </summary>
        protected void ShowWarning(string message)
        {
            if (ToastNotificationService != null)
            {
                ToastNotificationService.ShowToast(new ToastOptions
                {
                    ProviderName = "Error",
                    Title = "Warning",
                    Text = message,
                    ThemeMode = ToastThemeMode.Pastel,
                    RenderStyle = ToastRenderStyle.Warning
                });
            }
        }

        /// <summary>
        /// Show success toast notification
        /// </summary>
        protected void ShowSuccess(string message)
        {
            if (ToastNotificationService != null)
            {
                ToastNotificationService.ShowToast(new ToastOptions
                {
                    ProviderName = "Customization",
                    Title = "Success",
                    Text = message,
                    ThemeMode = ToastThemeMode.Pastel,
                    RenderStyle = ToastRenderStyle.Success
                });
            }
        }

        /// <summary>
        /// Show error toast notification
        /// </summary>
        protected void ShowError(string message)
        {
            if (ToastNotificationService != null)
            {
                ToastNotificationService.ShowToast(new ToastOptions
                {
                    ProviderName = "Error",
                    Title = "Error",
                    Text = message,
                    ThemeMode = ToastThemeMode.Pastel,
                    RenderStyle = ToastRenderStyle.Danger
                });
            }
        }
    }
}