using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using UserManagementAPI.Data;
using UserManagementAPI.Models;
using UserManagementAPI.ViewModel;

namespace UserManagementAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // Require authentication for all endpoints
    public class PermissionManagementController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly ILogger<PermissionManagementController> _logger;
        private readonly UserManagementContext _context;

        public PermissionManagementController(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager,
            ILogger<PermissionManagementController> logger,
            UserManagementContext context)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _logger = logger;
            _context = context;
        }

        /// <summary>
        /// Every "Permission"-type claim across ALL of `roleNames`, in one
        /// query — the shared fix for the FindByNameAsync + GetClaimsAsync
        /// round trip PER ROLE that <see cref="GetUserPermissions"/>,
        /// <see cref="CheckPermission"/> and <see cref="GetMyPermissions"/>
        /// each ran independently.
        /// </summary>
        private async Task<HashSet<string>> GetPermissionsForRolesAsync(IList<string> roleNames)
        {
            var values = await _context.Roles
                .Where(r => roleNames.Contains(r.Name))
                .Join(_context.RoleClaims.Where(rc => rc.ClaimType == "Permission"),
                    r => r.Id, rc => rc.RoleId, (r, rc) => rc.ClaimValue)
                .ToListAsync();
            return new HashSet<string>(values);
        }

        // GET: api/PermissionManagement/roles/{roleId}/permissions
        [HttpGet("roles/{roleId}/permissions")]
        public async Task<IActionResult> GetRolePermissions(string roleId)
        {
            try
            {
                _logger.LogDebug("GetRolePermissions called for roleId: {RoleId}", roleId);
                _logger.LogDebug("User: {User}, Authenticated: {Auth}",
                    User.Identity?.Name ?? "Anonymous",
                    User.Identity?.IsAuthenticated);

                var role = await _roleManager.FindByIdAsync(roleId);
                if (role == null)
                {
                    _logger.LogWarning("Role not found: {RoleId}", roleId);
                    return NotFound(new { Status = "Error", Message = "Role not found" });
                }

                // Get all claims for this role
                var roleClaims = await _roleManager.GetClaimsAsync(role);
                var allPermissions = UserManagementAPI.Contants.Permissions.GenerateAllPermissions();

                _logger.LogDebug("Role {RoleName} has {ClaimCount} claims", role.Name, roleClaims.Count);
                _logger.LogDebug("Total available permissions: {PermCount}", allPermissions.Count);

                var permissionDtos = allPermissions.Select(permission => new PermissionDto
                {
                    Module = ExtractModule(permission),
                    Permission = permission,
                    DisplayName = FormatPermissionName(permission),
                    Icon = UserManagementAPI.Contants.PermissionIcons.GetIcon(permission),
                    IsAssigned = roleClaims.Any(c => c.Type == "Permission" && c.Value == permission)
                }).ToList();

                var assignedCount = permissionDtos.Count(p => p.IsAssigned);
                _logger.LogDebug("Assigned permissions: {AssignedCount}/{TotalCount}", assignedCount, permissionDtos.Count);

                var response = new RolePermissionsDto
                {
                    RoleId = role.Id,
                    RoleName = role.Name,
                    Permissions = permissionDtos
                };

                return Ok(new { Status = "Success", Data = response });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetRolePermissions for roleId: {RoleId}", roleId);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred." });
            }
        }

        // PUT: api/PermissionManagement/roles/{roleId}/permissions
        //
        // Admin-only: this writes the claims that the whole permission system
        // is evaluated against, so leaving it at plain [Authorize] let any
        // signed-in user grant themselves anything.
        [Authorize(Roles = "Admin")]
        [HttpPut("roles/{roleId}/permissions")]
        public async Task<IActionResult> UpdateRolePermissions(string roleId, [FromBody] UpdateRolePermissionsRequest request)
        {
            try
            {
                _logger.LogDebug("UpdateRolePermissions called for roleId: {RoleId}", roleId);

                if (roleId != request.RoleId)
                {
                    _logger.LogWarning("Role ID mismatch: URL={UrlId}, Body={BodyId}", roleId, request.RoleId);
                    return BadRequest(new { Status = "Error", Message = "Role ID mismatch" });
                }

                var role = await _roleManager.FindByIdAsync(roleId);
                if (role == null)
                {
                    _logger.LogWarning("Role not found: {RoleId}", roleId);
                    return NotFound(new { Status = "Error", Message = "Role not found" });
                }

                // Get existing claims
                var existingClaims = await _roleManager.GetClaimsAsync(role);
                var existingPermissions = existingClaims
                    .Where(c => c.Type == "Permission")
                    .Select(c => c.Value)
                    .ToList();

                _logger.LogDebug("Existing permissions: {Count}", existingPermissions.Count);
                _logger.LogDebug("New permissions: {Count}", request.Permissions.Count);

                // Diff-based (only touches what actually changed), but as ONE
                // save instead of one RemoveClaimAsync/AddClaimAsync round trip
                // PER CHANGED PERMISSION — each of those calls its own
                // SaveChangesAsync internally.
                var permissionsToRemove = existingPermissions.Except(request.Permissions).ToList();
                var permissionsToAdd = request.Permissions.Except(existingPermissions).ToList();

                if (permissionsToRemove.Count > 0)
                {
                    var claimsToRemove = await _context.RoleClaims
                        .Where(rc => rc.RoleId == role.Id && rc.ClaimType == "Permission"
                            && permissionsToRemove.Contains(rc.ClaimValue))
                        .ToListAsync();
                    _context.RoleClaims.RemoveRange(claimsToRemove);
                }

                if (permissionsToAdd.Count > 0)
                {
                    _context.RoleClaims.AddRange(permissionsToAdd.Select(permission =>
                        new IdentityRoleClaim<string>
                        {
                            RoleId = role.Id,
                            ClaimType = "Permission",
                            ClaimValue = permission
                        }));
                }

                await _context.SaveChangesAsync();
                _logger.LogDebug("Removed {Removed} permission(s), added {Added} permission(s)",
                    permissionsToRemove.Count, permissionsToAdd.Count);

                _logger.LogInformation("Permissions updated for role '{RoleName}': Added={Added}, Removed={Removed}",
                    role.Name, permissionsToAdd.Count, permissionsToRemove.Count);

                return Ok(new
                {
                    Status = "Success",
                    Message = $"Permissions updated for role '{role.Name}'",
                    Data = new
                    {
                        RoleId = role.Id,
                        RoleName = role.Name,
                        PermissionsAdded = permissionsToAdd.Count,
                        PermissionsRemoved = permissionsToRemove.Count
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UpdateRolePermissions for roleId: {RoleId}", roleId);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred." });
            }
        }

        // GET: api/PermissionManagement/users/{userId}/permissions
        [HttpGet("users/{userId}/permissions")]
        public async Task<IActionResult> GetUserPermissions(string userId)
        {
            try
            {
                _logger.LogDebug("GetUserPermissions called for userId: {UserId}", userId);

                // Allow users to view their own permissions, or admins to view any user.
                // Checks SuperAdmin too — a SuperAdmin who does not ALSO hold
                // the separate "Admin" role was previously denied here, and at
                // least one real seeded account holds SuperAdmin only.
                var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (currentUserId != userId && !User.IsInRole("Admin") && !User.IsInRole("SuperAdmin"))
                {
                    _logger.LogWarning("Access denied: User {CurrentUser} tried to view permissions of {UserId}",
                        currentUserId, userId);
                    return Forbid();
                }

                var user = await _userManager.FindByIdAsync(userId);
                if (user == null)
                {
                    _logger.LogWarning("User not found: {UserId}", userId);
                    return NotFound(new { Status = "Error", Message = "User not found" });
                }

                var userRoles = await _userManager.GetRolesAsync(user);
                var permissions = await GetPermissionsForRolesAsync(userRoles);

                _logger.LogInformation("User {UserName} has {PermCount} permissions from {RoleCount} roles",
                    user.UserName, permissions.Count, userRoles.Count);

                var permissionDtos = permissions.Select(permission => new PermissionDto
                {
                    Module = ExtractModule(permission),
                    Permission = permission,
                    DisplayName = FormatPermissionName(permission),
                    Icon = UserManagementAPI.Contants.PermissionIcons.GetIcon(permission),
                    IsAssigned = true
                }).ToList();

                var response = new UserPermissionsData
                {
                    UserId = user.Id,
                    UserName = user.UserName,
                    Roles = userRoles.ToList(),
                    Permissions = permissionDtos
                };

                return Ok(new { Status = "Success", Data = response });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetUserPermissions for userId: {UserId}", userId);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred." });
            }
        }

        // POST: api/PermissionManagement/check
        [HttpPost("check")]
        public async Task<IActionResult> CheckPermission([FromBody] PermissionCheckRequest request)
        {
            try
            {
                _logger.LogInformation("CheckPermission called: UserId={UserId}, Permission={Permission}",
                    request.UserId, request.Permission);

                // Allow users to check their own permissions, or admins to
                // check any user — see the same SuperAdmin note in GetUserPermissions above.
                var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (currentUserId != request.UserId && !User.IsInRole("Admin") && !User.IsInRole("SuperAdmin"))
                {
                    _logger.LogWarning("Access denied: User {CurrentUser} tried to check permissions of {UserId}",
                        currentUserId, request.UserId);
                    return Forbid();
                }

                var user = await _userManager.FindByIdAsync(request.UserId);
                if (user == null)
                {
                    _logger.LogWarning("User not found: {UserId}", request.UserId);
                    return NotFound(new { Status = "Error", Message = "User not found" });
                }

                var userRoles = await _userManager.GetRolesAsync(user);
                var permissions = await GetPermissionsForRolesAsync(userRoles);
                bool hasPermission = permissions.Contains(request.Permission);
                if (hasPermission)
                {
                    _logger.LogInformation("Permission {Permission} found for user {UserId}",
                        request.Permission, request.UserId);
                }

                var response = new PermissionCheckResponse
                {
                    HasPermission = hasPermission,
                    UserId = request.UserId,
                    Permission = request.Permission
                };

                return Ok(new { Status = "Success", Data = response });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in CheckPermission");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred." });
            }
        }

        // GET: api/PermissionManagement/modules
        [HttpGet("modules")]
        public IActionResult GetAllModulePermissions()
        {
            try
            {
                _logger.LogInformation("✅ GetAllModulePermissions called");
                _logger.LogDebug("User: {User}, Authenticated: {Auth}",
                    User.Identity?.Name ?? "Anonymous",
                    User.Identity?.IsAuthenticated);

                var allPermissions = UserManagementAPI.Contants.Permissions.GenerateAllPermissions();
                _logger.LogInformation("Generated {Count} total permissions", allPermissions.Count);

                var groupedPermissions = allPermissions
                    .GroupBy(p => ExtractModule(p))
                    .Select(g => new ModulePermissionGroup
                    {
                        Module = g.Key,
                        Permissions = g.Select(p => new PermissionDto
                        {
                            Module = g.Key,
                            Permission = p,
                            DisplayName = FormatPermissionName(p),
                            Icon = UserManagementAPI.Contants.PermissionIcons.GetIcon(p),
                            IsAssigned = false
                        }).ToList()
                    })
                    .ToList();

                _logger.LogInformation("✅ Grouped into {Count} modules", groupedPermissions.Count);

                return Ok(new { Status = "Success", Data = groupedPermissions });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error in GetAllModulePermissions");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred." });
            }
        }

        // GET: api/PermissionManagement/my-permissions
        [HttpGet("my-permissions")]
        public async Task<IActionResult> GetMyPermissions()
        {
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                _logger.LogInformation("GetMyPermissions called for userId: {UserId}", userId);

                if (string.IsNullOrEmpty(userId))
                {
                    _logger.LogWarning("User not authenticated");
                    return Unauthorized(new { Status = "Error", Message = "User not authenticated" });
                }

                var user = await _userManager.FindByIdAsync(userId);
                if (user == null)
                {
                    _logger.LogWarning("User not found: {UserId}", userId);
                    return NotFound(new { Status = "Error", Message = "User not found" });
                }

                var userRoles = await _userManager.GetRolesAsync(user);
                var permissions = await GetPermissionsForRolesAsync(userRoles);

                _logger.LogInformation("User {UserName} has {PermCount} permissions", user.UserName, permissions.Count);

                var permissionDtos = permissions.Select(permission => new PermissionDto
                {
                    Module = ExtractModule(permission),
                    Permission = permission,
                    DisplayName = FormatPermissionName(permission),
                    Icon = UserManagementAPI.Contants.PermissionIcons.GetIcon(permission),
                    IsAssigned = true
                }).ToList();

                var response = new UserPermissionsData
                {
                    UserId = user.Id,
                    UserName = user.UserName,
                    Roles = userRoles.ToList(),
                    Permissions = permissionDtos
                };

                return Ok(new { Status = "Success", Data = response });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetMyPermissions");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred." });
            }
        }

        // Helper methods
        private string ExtractModule(string permission)
        {
            var parts = permission.Split('.');
            return parts.Length >= 2 ? parts[1] : "Unknown";
        }

        private string FormatPermissionName(string permission)
        {
            var parts = permission.Split('.');
            return parts.Length >= 3 ? parts[2] : permission;
        }
    }
}