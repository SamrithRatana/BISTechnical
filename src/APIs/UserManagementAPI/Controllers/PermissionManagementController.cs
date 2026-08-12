using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
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

        public PermissionManagementController(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager,
            ILogger<PermissionManagementController> logger)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _logger = logger;
        }

        // GET: api/PermissionManagement/roles/{roleId}/permissions
        [HttpGet("roles/{roleId}/permissions")]
        public async Task<IActionResult> GetRolePermissions(string roleId)
        {
            try
            {
                _logger.LogInformation("GetRolePermissions called for roleId: {RoleId}", roleId);
                _logger.LogInformation("User: {User}, Authenticated: {Auth}",
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

                _logger.LogInformation("Role {RoleName} has {ClaimCount} claims", role.Name, roleClaims.Count);
                _logger.LogInformation("Total available permissions: {PermCount}", allPermissions.Count);

                var permissionDtos = allPermissions.Select(permission => new PermissionDto
                {
                    Module = ExtractModule(permission),
                    Permission = permission,
                    DisplayName = FormatPermissionName(permission),
                    Icon = UserManagementAPI.Contants.PermissionIcons.GetIcon(permission),
                    IsAssigned = roleClaims.Any(c => c.Type == "Permission" && c.Value == permission)
                }).ToList();

                var assignedCount = permissionDtos.Count(p => p.IsAssigned);
                _logger.LogInformation("Assigned permissions: {AssignedCount}/{TotalCount}", assignedCount, permissionDtos.Count);

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
                return StatusCode(500, new { Status = "Error", Message = ex.Message });
            }
        }

        // PUT: api/PermissionManagement/roles/{roleId}/permissions
        [HttpPut("roles/{roleId}/permissions")]
        public async Task<IActionResult> UpdateRolePermissions(string roleId, [FromBody] UpdateRolePermissionsRequest request)
        {
            try
            {
                _logger.LogInformation("UpdateRolePermissions called for roleId: {RoleId}", roleId);

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

                _logger.LogInformation("Existing permissions: {Count}", existingPermissions.Count);
                _logger.LogInformation("New permissions: {Count}", request.Permissions.Count);

                // Remove permissions that are no longer selected
                var permissionsToRemove = existingPermissions.Except(request.Permissions).ToList();
                foreach (var permission in permissionsToRemove)
                {
                    var claim = existingClaims.First(c => c.Type == "Permission" && c.Value == permission);
                    var result = await _roleManager.RemoveClaimAsync(role, claim);
                    if (result.Succeeded)
                    {
                        _logger.LogInformation("Removed permission: {Permission}", permission);
                    }
                    else
                    {
                        _logger.LogWarning("Failed to remove permission: {Permission}", permission);
                    }
                }

                // Add new permissions
                var permissionsToAdd = request.Permissions.Except(existingPermissions).ToList();
                foreach (var permission in permissionsToAdd)
                {
                    var result = await _roleManager.AddClaimAsync(role, new Claim("Permission", permission));
                    if (result.Succeeded)
                    {
                        _logger.LogInformation("Added permission: {Permission}", permission);
                    }
                    else
                    {
                        _logger.LogWarning("Failed to add permission: {Permission}", permission);
                    }
                }

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
                return StatusCode(500, new { Status = "Error", Message = ex.Message });
            }
        }

        // GET: api/PermissionManagement/users/{userId}/permissions
        [HttpGet("users/{userId}/permissions")]
        public async Task<IActionResult> GetUserPermissions(string userId)
        {
            try
            {
                _logger.LogInformation("GetUserPermissions called for userId: {UserId}", userId);

                // Allow users to view their own permissions, or admins to view any user
                var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (currentUserId != userId && !User.IsInRole("Admin"))
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
                var permissions = new HashSet<string>();

                // Collect permissions from all user roles
                foreach (var roleName in userRoles)
                {
                    var role = await _roleManager.FindByNameAsync(roleName);
                    if (role != null)
                    {
                        var roleClaims = await _roleManager.GetClaimsAsync(role);
                        foreach (var claim in roleClaims.Where(c => c.Type == "Permission"))
                        {
                            permissions.Add(claim.Value);
                        }
                    }
                }

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
                return StatusCode(500, new { Status = "Error", Message = ex.Message });
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

                // Allow users to check their own permissions, or admins to check any user
                var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (currentUserId != request.UserId && !User.IsInRole("Admin"))
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
                bool hasPermission = false;

                // Check if user has the permission through any of their roles
                foreach (var roleName in userRoles)
                {
                    var role = await _roleManager.FindByNameAsync(roleName);
                    if (role != null)
                    {
                        var roleClaims = await _roleManager.GetClaimsAsync(role);
                        if (roleClaims.Any(c => c.Type == "Permission" && c.Value == request.Permission))
                        {
                            hasPermission = true;
                            _logger.LogInformation("Permission {Permission} found in role {Role}",
                                request.Permission, roleName);
                            break;
                        }
                    }
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
                return StatusCode(500, new { Status = "Error", Message = ex.Message });
            }
        }

        // GET: api/PermissionManagement/modules
        [HttpGet("modules")]
        public IActionResult GetAllModulePermissions()
        {
            try
            {
                _logger.LogInformation("✅ GetAllModulePermissions called");
                _logger.LogInformation("User: {User}, Authenticated: {Auth}",
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
                return StatusCode(500, new { Status = "Error", Message = ex.Message, Details = ex.StackTrace });
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
                var permissions = new HashSet<string>();

                foreach (var roleName in userRoles)
                {
                    var role = await _roleManager.FindByNameAsync(roleName);
                    if (role != null)
                    {
                        var roleClaims = await _roleManager.GetClaimsAsync(role);
                        foreach (var claim in roleClaims.Where(c => c.Type == "Permission"))
                        {
                            permissions.Add(claim.Value);
                        }
                    }
                }

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
                return StatusCode(500, new { Status = "Error", Message = ex.Message });
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