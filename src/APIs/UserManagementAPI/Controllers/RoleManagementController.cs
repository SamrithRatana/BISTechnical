using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using UserManagementAPI.Models;

namespace UserManagementAPI.Controllers
{
    /// <summary>
    /// Role Management API - Handles role CRUD and permissions/claims
    /// Add this controller to your JWT API project
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class RoleManagementController : ControllerBase
    {
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<RoleManagementController> _logger;

        public RoleManagementController(
            RoleManager<IdentityRole> roleManager,
            UserManager<ApplicationUser> userManager,
            ILogger<RoleManagementController> logger)
        {
            _roleManager = roleManager;
            _userManager = userManager;
            _logger = logger;
        }

        // GET: api/RoleManagement
        [HttpGet]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetAllRoles()
        {
            try
            {
                var roles = await _roleManager.Roles
                    .OrderBy(r => r.Name)
                    .ToListAsync();

                var rolesList = roles.Select(r => new
                {
                    Id = r.Id,
                    Name = r.Name,
                    NormalizedName = r.NormalizedName
                }).ToList();

                return Ok(new
                {
                    Status = "Success",
                    Data = rolesList,
                    Count = rolesList.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving roles");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred while retrieving roles" });
            }
        }

        // GET: api/RoleManagement/{id}
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetRoleById(string id)
        {
            try
            {
                var role = await _roleManager.FindByIdAsync(id);
                if (role == null)
                {
                    return NotFound(new { Status = "Error", Message = "Role not found!" });
                }

                // Get users in this role
                var usersInRole = await _userManager.GetUsersInRoleAsync(role.Name);

                return Ok(new
                {
                    Status = "Success",
                    Data = new
                    {
                        Id = role.Id,
                        Name = role.Name,
                        NormalizedName = role.NormalizedName,
                        UserCount = usersInRole.Count
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving role {RoleId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // POST: api/RoleManagement
        [HttpPost]
        [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> CreateRole([FromBody] CreateRoleDto model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Invalid input",
                        Errors = ModelState.Values.SelectMany(v => v.Errors.Select(e => e.ErrorMessage))
                    });
                }

                // Check if role already exists
                if (await _roleManager.RoleExistsAsync(model.Name))
                {
                    return Conflict(new { Status = "Error", Message = "Role already exists!" });
                }

                var role = new IdentityRole
                {
                    Name = model.Name,
                    NormalizedName = model.Name.ToUpper()
                };

                var result = await _roleManager.CreateAsync(role);

                if (!result.Succeeded)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Role creation failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                _logger.LogInformation("Role created: {RoleName} by {Admin}", model.Name, User.Identity.Name);

                return CreatedAtAction(nameof(GetRoleById), new { id = role.Id }, new
                {
                    Status = "Success",
                    Message = "Role created successfully!",
                    Data = new
                    {
                        Id = role.Id,
                        Name = role.Name
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating role");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred while creating role" });
            }
        }

        // PUT: api/RoleManagement/{id}
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdateRole(string id, [FromBody] UpdateRoleDto model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { Status = "Error", Message = "Invalid input" });
                }

                var role = await _roleManager.FindByIdAsync(id);
                if (role == null)
                {
                    return NotFound(new { Status = "Error", Message = "Role not found!" });
                }

                // Check if new name already exists
                if (role.Name != model.Name && await _roleManager.RoleExistsAsync(model.Name))
                {
                    return Conflict(new { Status = "Error", Message = "Role name already exists!" });
                }

                role.Name = model.Name;
                role.NormalizedName = model.Name.ToUpper();

                var result = await _roleManager.UpdateAsync(role);

                if (!result.Succeeded)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Role update failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                _logger.LogInformation("Role updated: {RoleName}", model.Name);

                return Ok(new
                {
                    Status = "Success",
                    Message = "Role updated successfully!",
                    Data = new
                    {
                        Id = role.Id,
                        Name = role.Name
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating role {RoleId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // DELETE: api/RoleManagement/{id}
        [HttpDelete("{id}")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteRole(string id)
        {
            try
            {
                var role = await _roleManager.FindByIdAsync(id);
                if (role == null)
                {
                    return NotFound(new { Status = "Error", Message = "Role not found!" });
                }

                // Prevent deletion of Admin role
                if (role.Name.Equals("Admin", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { Status = "Error", Message = "Cannot delete Admin role!" });
                }

                // Check if role has users
                var usersInRole = await _userManager.GetUsersInRoleAsync(role.Name);
                if (usersInRole.Any())
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = $"Cannot delete role! {usersInRole.Count} user(s) are assigned to this role."
                    });
                }

                var result = await _roleManager.DeleteAsync(role);

                if (!result.Succeeded)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Role deletion failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                _logger.LogInformation("Role deleted: {RoleName} by {Admin}", role.Name, User.Identity.Name);

                return Ok(new
                {
                    Status = "Success",
                    Message = "Role deleted successfully!"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting role {RoleId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // GET: api/RoleManagement/{id}/claims
        [HttpGet("{id}/claims")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetRoleClaims(string id)
        {
            try
            {
                var role = await _roleManager.FindByIdAsync(id);
                if (role == null)
                {
                    return NotFound(new { Status = "Error", Message = "Role not found!" });
                }

                var claims = await _roleManager.GetClaimsAsync(role);

                var claimsList = claims.Select(c => new
                {
                    Type = c.Type,
                    Value = c.Value
                }).ToList();

                return Ok(new
                {
                    Status = "Success",
                    Data = claimsList,
                    RoleName = role.Name
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting claims for role {RoleId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // POST: api/RoleManagement/{id}/claims
        [HttpPost("{id}/claims")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> AddRoleClaim(string id, [FromBody] AddClaimDto model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { Status = "Error", Message = "Invalid input" });
                }

                var role = await _roleManager.FindByIdAsync(id);
                if (role == null)
                {
                    return NotFound(new { Status = "Error", Message = "Role not found!" });
                }

                var claim = new Claim(model.Type, model.Value);
                var result = await _roleManager.AddClaimAsync(role, claim);

                if (!result.Succeeded)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Failed to add claim!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                _logger.LogInformation("Claim added to role {RoleName}: {ClaimType}={ClaimValue}",
                    role.Name, model.Type, model.Value);

                return Ok(new
                {
                    Status = "Success",
                    Message = "Claim added successfully!"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding claim to role {RoleId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // DELETE: api/RoleManagement/{id}/claims
        [HttpDelete("{id}/claims")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> RemoveRoleClaim(string id, [FromBody] RemoveClaimDto model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { Status = "Error", Message = "Invalid input" });
                }

                var role = await _roleManager.FindByIdAsync(id);
                if (role == null)
                {
                    return NotFound(new { Status = "Error", Message = "Role not found!" });
                }

                var claim = new Claim(model.Type, model.Value);
                var result = await _roleManager.RemoveClaimAsync(role, claim);

                if (!result.Succeeded)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Failed to remove claim!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                _logger.LogInformation("Claim removed from role {RoleName}: {ClaimType}={ClaimValue}",
                    role.Name, model.Type, model.Value);

                return Ok(new
                {
                    Status = "Success",
                    Message = "Claim removed successfully!"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing claim from role {RoleId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // PUT: api/RoleManagement/{id}/permissions
        // Update all permissions for a role at once
        [HttpPut("{id}/permissions")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        public async Task<IActionResult> UpdateRolePermissions(string id, [FromBody] UpdatePermissionsDto model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { Status = "Error", Message = "Invalid input" });
                }

                var role = await _roleManager.FindByIdAsync(id);
                if (role == null)
                {
                    return NotFound(new { Status = "Error", Message = "Role not found!" });
                }

                // Remove all existing claims
                var existingClaims = await _roleManager.GetClaimsAsync(role);
                foreach (var claim in existingClaims)
                {
                    await _roleManager.RemoveClaimAsync(role, claim);
                }

                // Add new claims
                if (model.Permissions != null && model.Permissions.Any())
                {
                    foreach (var permission in model.Permissions)
                    {
                        var claim = new Claim("Permission", permission);
                        await _roleManager.AddClaimAsync(role, claim);
                    }
                }

                _logger.LogInformation("Permissions updated for role {RoleName}: {Count} permissions",
                    role.Name, model.Permissions?.Count ?? 0);

                return Ok(new
                {
                    Status = "Success",
                    Message = "Permissions updated successfully!",
                    Data = new
                    {
                        RoleId = role.Id,
                        RoleName = role.Name,
                        PermissionCount = model.Permissions?.Count ?? 0
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating permissions for role {RoleId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }
    }

    // ==================== DTOs ====================

    public class CreateRoleDto
    {
        [Required]
        [StringLength(100, MinimumLength = 2)]
        public string Name { get; set; }
    }

    public class UpdateRoleDto
    {
        [Required]
        [StringLength(100, MinimumLength = 2)]
        public string Name { get; set; }
    }

    public class AddClaimDto
    {
        [Required]
        public string Type { get; set; }

        [Required]
        public string Value { get; set; }
    }

    public class RemoveClaimDto
    {
        [Required]
        public string Type { get; set; }

        [Required]
        public string Value { get; set; }
    }

    public class UpdatePermissionsDto
    {
        public List<string> Permissions { get; set; } = new();
    }
}