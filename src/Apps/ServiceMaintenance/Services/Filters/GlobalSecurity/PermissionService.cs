using Microsoft.AspNetCore.Components.Authorization;
using System.Security.Claims;

namespace ServiceMaintenance.Services.Filters.GlobalSecurity
{
    /// <summary>
    /// Service for checking user permissions from JWT claims
    /// </summary>
    public class PermissionService
    {
        private readonly AuthenticationStateProvider _authenticationStateProvider;
        private readonly ILogger<PermissionService> _logger;

        public PermissionService(
            AuthenticationStateProvider authenticationStateProvider,
            ILogger<PermissionService> logger)
        {
            _authenticationStateProvider = authenticationStateProvider;
            _logger = logger;
        }

        /// <summary>
        /// Check if user has access to a specific module
        /// </summary>
        public async Task<bool> CheckModuleAccessAsync(string moduleName)
        {
            try
            {
                var authState = await _authenticationStateProvider.GetAuthenticationStateAsync();
                var user = authState.User;

                if (user?.Identity?.IsAuthenticated != true)
                {
                    _logger.LogWarning("User is not authenticated");
                    return false;
                }

                // SuperAdmin and Admin roles have full module access by default
                if (user.IsInRole("SuperAdmin") || user.IsInRole("Admin"))
                {
                    _logger.LogDebug("User is Admin/SuperAdmin - full access granted for module: {ModuleName}", moduleName);
                    return true;
                }

                // Check for Access permission
                var requiredPermission = $"Permissions.{moduleName}.Access";

                // ✅ CHANGED: LogInformation -> LogDebug. This fires once per
                // component per page load (App, Footer, LanguageSelector,
                // every page module...), so at Information level it was
                // flooding the log on every single render. Debug is filtered
                // out by default in appsettings.json.
                _logger.LogDebug("Checking permission: {RequiredPermission}", requiredPermission);

                // ⭐ Get ALL claims with type "Permission"
                var permissionClaims = user.FindAll("Permission").ToList();

                // ✅ CHANGED: LogInformation -> LogDebug, and the per-claim
                // dump loop is now GUARDED behind IsEnabled(Debug). Without
                // the guard, .Count, string formatting, and the foreach below
                // would still all execute on every call even when Debug
                // logging is off and nothing gets written — this was the
                // real CPU cost, not just noisy output. This was the single
                // biggest source of duplicate log lines: every module on the
                // page dumping the user's full permission claim list (98
                // entries) just to check ONE permission.
                if (_logger.IsEnabled(LogLevel.Debug))
                {
                    _logger.LogDebug("Found {Count} permission claims", permissionClaims.Count);
                    foreach (var claim in permissionClaims)
                    {
                        _logger.LogDebug("  - {ClaimValue}", claim.Value);
                    }
                }

                foreach (var claim in permissionClaims)
                {
                    // Check if this claim value contains our required permission
                    if (claim.Value.Contains(requiredPermission))
                    {
                        _logger.LogDebug("Permission found: {RequiredPermission}", requiredPermission);
                        return true;
                    }
                }

                // Kept at Warning — this is the actually useful signal
                // (access denied), so it stays visible even with Debug
                // filtered out.
                _logger.LogWarning("Permission NOT found: {RequiredPermission}", requiredPermission);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking module access for {ModuleName}", moduleName);
                return false;
            }
        }

        /// <summary>
        /// Check multiple permissions for a module and return dictionary
        /// </summary>
        public async Task<Dictionary<string, bool>> CheckModulePermissionsAsync(string moduleName)
        {
            var permissions = new Dictionary<string, bool>();
            var permissionTypes = new[] { "View", "Create", "Edit", "Delete", "Print", "Export" };

            try
            {
                var authState = await _authenticationStateProvider.GetAuthenticationStateAsync();
                var user = authState.User;

                if (user?.Identity?.IsAuthenticated != true)
                {
                    _logger.LogWarning("User is not authenticated");
                    foreach (var type in permissionTypes)
                    {
                        permissions[type] = false;
                    }
                    return permissions;
                }

                // ⭐ Get ALL permission claims once
                var permissionClaims = user.FindAll("Permission")
                    .SelectMany(c => c.Value.Split(','))
                    .Select(p => p.Trim())
                    .ToHashSet();

                // ✅ CHANGED: LogInformation -> LogDebug, same reasoning as
                // above — this ran once per module per page load.
                if (_logger.IsEnabled(LogLevel.Debug))
                {
                    _logger.LogDebug("Checking permissions for module: {ModuleName}", moduleName);
                    _logger.LogDebug("Total permission values found: {Count}", permissionClaims.Count);
                }

                // Check each permission type
                foreach (var type in permissionTypes)
                {
                    var requiredPermission = $"Permissions.{moduleName}.{type}";
                    var hasPermission = permissionClaims.Contains(requiredPermission);

                    permissions[type] = hasPermission;

                    if (_logger.IsEnabled(LogLevel.Debug))
                    {
                        _logger.LogDebug("  {Type}: {Result} ({RequiredPermission})",
                            type, hasPermission ? "✅" : "❌", requiredPermission);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking permissions for module {ModuleName}", moduleName);
                foreach (var type in permissionTypes)
                {
                    permissions[type] = false;
                }
            }

            return permissions;
        }

        /// <summary>
        /// Check if user has a specific permission
        /// </summary>
        public async Task<bool> HasPermissionAsync(string permission)
        {
            try
            {
                var authState = await _authenticationStateProvider.GetAuthenticationStateAsync();
                var user = authState.User;

                if (user?.Identity?.IsAuthenticated != true)
                {
                    return false;
                }

                // ⭐ Check all Permission claims
                var permissionClaims = user.FindAll("Permission")
                    .SelectMany(c => c.Value.Split(','))
                    .Select(p => p.Trim())
                    .ToHashSet();

                return permissionClaims.Contains(permission);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking permission: {Permission}", permission);
                return false;
            }
        }

        /// <summary>
        /// Get all permissions for the current user
        /// </summary>
        public async Task<List<string>> GetUserPermissionsAsync()
        {
            try
            {
                var authState = await _authenticationStateProvider.GetAuthenticationStateAsync();
                var user = authState.User;

                if (user?.Identity?.IsAuthenticated != true)
                {
                    return new List<string>();
                }

                // ⭐ Parse all Permission claims
                var permissions = user.FindAll("Permission")
                    .SelectMany(c => c.Value.Split(','))
                    .Select(p => p.Trim())
                    .Distinct()
                    .ToList();

                // ✅ CHANGED: LogInformation -> LogDebug. This is called by
                // HasAnyPermissionAsync/HasAllPermissionsAsync too, so it
                // can fire multiple times per page load.
                _logger.LogDebug("User has {Count} total permissions", permissions.Count);

                return permissions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user permissions");
                return new List<string>();
            }
        }

        /// <summary>
        /// Check if user has any of the specified permissions
        /// </summary>
        public async Task<bool> HasAnyPermissionAsync(params string[] permissions)
        {
            var userPermissions = await GetUserPermissionsAsync();
            return permissions.Any(p => userPermissions.Contains(p));
        }

        /// <summary>
        /// Check if user has all of the specified permissions
        /// </summary>
        public async Task<bool> HasAllPermissionsAsync(params string[] permissions)
        {
            var userPermissions = await GetUserPermissionsAsync();
            return permissions.All(p => userPermissions.Contains(p));
        }
    }
}