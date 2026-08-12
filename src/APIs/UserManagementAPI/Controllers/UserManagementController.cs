using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using UserManagementAPI.Models;
using UserManagementAPI.ViewModel;

namespace UserManagementAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserManagementController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly ILogger<UserManagementController> _logger;
        private readonly IMemoryCache _cache;
        private readonly IConfiguration _configuration; // ✅ ADD THIS

        public UserManagementController(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager,
            ILogger<UserManagementController> logger,
            IMemoryCache cache,
            IConfiguration configuration)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _logger = logger;
            _cache = cache;
            _configuration = configuration;
        }

        [HttpGet]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> GetAllUsers(
    [FromQuery][Range(1, int.MaxValue)] int page = 1,
    [FromQuery][Range(1, 100)] int pageSize = 10)
        {
            try
            {
                var query = _userManager.Users;
                var total = await query.CountAsync();

                var users = await query
                    .OrderBy(u => u.UserName)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(u => new
                    {
                        u.Id,
                        u.UserName,
                        u.Email,
                        u.FirstName,
                        u.LastName,
                        u.PhoneNumber,
                        u.ProfilePictureUrl  // ✅ ADD THIS
                    })
                    .ToListAsync();

                // Batch load roles for all users
                var userList = new List<object>();
                foreach (var user in users)
                {
                    var appUser = await _userManager.FindByIdAsync(user.Id);
                    var roles = await _userManager.GetRolesAsync(appUser);

                    // ✅ Build full URL for profile picture
                    var profilePictureUrl = GetFullImageUrl(user.ProfilePictureUrl);

                    userList.Add(new
                    {
                        user.Id,
                        user.UserName,
                        user.Email,
                        user.FirstName,
                        user.LastName,
                        user.PhoneNumber,
                        ProfilePictureUrl = profilePictureUrl,  // ✅ ADD THIS
                        Roles = roles
                    });
                }

                return Ok(new
                {
                    Status = "Success",
                    Data = userList,
                    Pagination = new
                    {
                        CurrentPage = page,
                        PageSize = pageSize,
                        TotalCount = total,
                        TotalPages = (int)Math.Ceiling(total / (double)pageSize),
                        HasPrevious = page > 1,
                        HasNext = page < (int)Math.Ceiling(total / (double)pageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving users list");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred while retrieving users" });
            }
        }
        private string GetFullImageUrl(string relativePath)
        {
            if (string.IsNullOrEmpty(relativePath))
                return null;

            // If already a full URL, return as-is
            if (relativePath.StartsWith("http://") || relativePath.StartsWith("https://"))
                return relativePath;

            // Get API base URL from configuration
            var apiBaseUrl = _configuration["ApiBaseUrl"] ?? $"{Request.Scheme}://{Request.Host}";

            // Remove trailing slash from base URL
            apiBaseUrl = apiBaseUrl.TrimEnd('/');

            // Ensure relative path starts with /
            if (!relativePath.StartsWith("/"))
                relativePath = "/" + relativePath;

            return $"{apiBaseUrl}{relativePath}";
        }
        [HttpGet("{id}")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetUserById(string id)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(id))
                {
                    return BadRequest(new { Status = "Error", Message = "User ID is required" });
                }

                var user = await _userManager.FindByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                var roles = await _userManager.GetRolesAsync(user);
                var profilePictureUrl = GetFullImageUrl(user.ProfilePictureUrl);  // ✅ ADD THIS

                return Ok(new
                {
                    Status = "Success",
                    Data = new
                    {
                        user.Id,
                        user.UserName,
                        user.Email,
                        user.FirstName,
                        user.LastName,
                        user.PhoneNumber,
                        ProfilePictureUrl = profilePictureUrl,  // ✅ ADD THIS
                        user.EmailConfirmed,
                        user.LockoutEnd,
                        IsLocked = await _userManager.IsLockedOutAsync(user),
                        Roles = roles
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user {UserId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // POST: api/UserManagement
        [HttpPost]
        [ProducesResponseType(typeof(object), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status409Conflict)]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserDto model)
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

                // Check duplicates
                if (await _userManager.FindByNameAsync(model.UserName) != null)
                {
                    return Conflict(new { Status = "Error", Message = "Username already exists!" });
                }

                if (await _userManager.FindByEmailAsync(model.Email) != null)
                {
                    return Conflict(new { Status = "Error", Message = "Email already exists!" });
                }

                var user = new ApplicationUser
                {
                    UserName = model.UserName,
                    Email = model.Email,
                    FirstName = model.FirstName,
                    LastName = model.LastName,
                    PhoneNumber = model.PhoneNumber,
                    EmailConfirmed = true, // Auto-confirm for admin-created users
                    SecurityStamp = Guid.NewGuid().ToString()
                };

                var result = await _userManager.CreateAsync(user, model.Password);

                if (!result.Succeeded)
                {
                    _logger.LogWarning("User creation failed: {Errors}",
                        string.Join(", ", result.Errors.Select(e => e.Description)));

                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "User creation failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                // Assign roles
                if (model.Roles != null && model.Roles.Any())
                {
                    var validRoles = new List<string>();
                    foreach (var role in model.Roles)
                    {
                        if (await _roleManager.RoleExistsAsync(role))
                        {
                            validRoles.Add(role);
                        }
                    }

                    if (validRoles.Any())
                    {
                        await _userManager.AddToRolesAsync(user, validRoles);
                    }
                }
                else
                {
                    // Default role
                    if (!await _roleManager.RoleExistsAsync("User"))
                    {
                        await _roleManager.CreateAsync(new IdentityRole("User"));
                    }
                    await _userManager.AddToRoleAsync(user, "User");
                }

                var userRoles = await _userManager.GetRolesAsync(user);

                _logger.LogInformation("User created by admin: {UserName}", model.UserName);

                return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, new
                {
                    Status = "Success",
                    Message = "User created successfully!",
                    Data = new
                    {
                        user.Id,
                        user.UserName,
                        user.Email,
                        user.FirstName,
                        user.LastName,
                        user.PhoneNumber,
                        Roles = userRoles
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred while creating user" });
            }
        }

        // PUT: api/UserManagement/{id}
        [HttpPut("{id}")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserDto model)
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

                var user = await _userManager.FindByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                // Check username uniqueness
                if (user.UserName != model.UserName)
                {
                    var existingUser = await _userManager.FindByNameAsync(model.UserName);
                    if (existingUser != null)
                    {
                        return Conflict(new { Status = "Error", Message = "Username already exists!" });
                    }
                }

                // Check email uniqueness
                if (user.Email != model.Email)
                {
                    var existingEmail = await _userManager.FindByEmailAsync(model.Email);
                    if (existingEmail != null)
                    {
                        return Conflict(new { Status = "Error", Message = "Email already exists!" });
                    }
                }

                user.UserName = model.UserName;
                user.Email = model.Email;
                user.FirstName = model.FirstName;
                user.LastName = model.LastName;
                user.PhoneNumber = model.PhoneNumber;

                var result = await _userManager.UpdateAsync(user);

                if (!result.Succeeded)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "User update failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                var roles = await _userManager.GetRolesAsync(user);

                _logger.LogInformation("User updated: {UserName}", model.UserName);

                return Ok(new
                {
                    Status = "Success",
                    Message = "User updated successfully!",
                    Data = new
                    {
                        user.Id,
                        user.UserName,
                        user.Email,
                        user.FirstName,
                        user.LastName,
                        user.PhoneNumber,
                        Roles = roles
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user {UserId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // DELETE: api/UserManagement/{id}
        [HttpDelete("{id}")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteUser(string id)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                // Prevent self-deletion
                var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (currentUserId == id)
                {
                    return BadRequest(new { Status = "Error", Message = "You cannot delete your own account!" });
                }

                // Optional: Prevent deletion of other admins
                var userRoles = await _userManager.GetRolesAsync(user);
                if (userRoles.Contains("Admin") && userRoles.Count == 1)
                {
                    var adminCount = (await _userManager.GetUsersInRoleAsync("Admin")).Count;
                    if (adminCount <= 1)
                    {
                        return BadRequest(new { Status = "Error", Message = "Cannot delete the last admin user!" });
                    }
                }

                var result = await _userManager.DeleteAsync(user);

                if (!result.Succeeded)
                {
                    return StatusCode(500, new
                    {
                        Status = "Error",
                        Message = "User deletion failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                _logger.LogInformation("User deleted: {UserName} by {Admin}", user.UserName, User.Identity.Name);

                return Ok(new
                {
                    Status = "Success",
                    Message = "User deleted successfully!"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user {UserId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // GET: api/UserManagement/{id}/roles
        [HttpGet("{id}/roles")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetUserRoles(string id)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                // Cache all roles for 5 minutes
                var allRoles = await _cache.GetOrCreateAsync("AllRoles", async entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                    return await _roleManager.Roles.ToListAsync();
                });

                var userRoles = await _userManager.GetRolesAsync(user);

                var rolesData = allRoles.Select(role => new RoleAssignmentDto
                {
                    Id = role.Id,
                    Name = role.Name,
                    IsAssigned = userRoles.Contains(role.Name)
                }).ToList();

                return Ok(new
                {
                    Status = "Success",
                    Data = new UserRolesDto
                    {
                        UserId = user.Id,
                        UserName = user.UserName,
                        Roles = rolesData
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting roles for user {UserId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // PUT: api/UserManagement/{id}/roles
        [HttpPut("{id}/roles")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> UpdateUserRoles(string id, [FromBody] UpdateRolesDto model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { Status = "Error", Message = "Invalid input" });
                }

                var user = await _userManager.FindByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                var currentRoles = await _userManager.GetRolesAsync(user);

                // Remove current roles
                if (currentRoles.Any())
                {
                    var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
                    if (!removeResult.Succeeded)
                    {
                        return StatusCode(500, new
                        {
                            Status = "Error",
                            Message = "Failed to remove existing roles!",
                            Errors = removeResult.Errors.Select(e => e.Description)
                        });
                    }
                }

                // Add new roles
                if (model.Roles != null && model.Roles.Any())
                {
                    var validRoles = new List<string>();
                    foreach (var role in model.Roles)
                    {
                        if (await _roleManager.RoleExistsAsync(role))
                        {
                            validRoles.Add(role);
                        }
                    }

                    if (validRoles.Any())
                    {
                        var addResult = await _userManager.AddToRolesAsync(user, validRoles);
                        if (!addResult.Succeeded)
                        {
                            return StatusCode(500, new
                            {
                                Status = "Error",
                                Message = "Failed to assign new roles!",
                                Errors = addResult.Errors.Select(e => e.Description)
                            });
                        }
                    }
                }

                var updatedRoles = await _userManager.GetRolesAsync(user);

                _logger.LogInformation("Roles updated for user {UserName}: {Roles}",
                    user.UserName, string.Join(", ", updatedRoles));

                return Ok(new
                {
                    Status = "Success",
                    Message = "User roles updated successfully!",
                    Data = new
                    {
                        UserId = user.Id,
                        UserName = user.UserName,
                        Roles = updatedRoles
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating roles for user {UserId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // PUT: api/UserManagement/{id}/password
        [HttpPut("{id}/password")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> ResetUserPassword(string id, [FromBody] AdminResetPasswordDto model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { Status = "Error", Message = "Invalid input" });
                }

                var user = await _userManager.FindByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                var result = await _userManager.ResetPasswordAsync(user, token, model.NewPassword);

                if (!result.Succeeded)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Password reset failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                _logger.LogInformation("Password reset by admin for user: {UserName}", user.UserName);

                return Ok(new
                {
                    Status = "Success",
                    Message = "Password reset successfully!"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting password for user {UserId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // GET: api/UserManagement/search
        [HttpGet("search")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> SearchUsers(
            [FromQuery][Required] string query,
            [FromQuery][Range(1, int.MaxValue)] int page = 1,
            [FromQuery][Range(1, 100)] int pageSize = 10)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(query))
                {
                    return BadRequest(new { Status = "Error", Message = "Search query cannot be empty" });
                }

                var searchTerm = query.ToLower().Trim();
                var usersQuery = _userManager.Users.Where(u =>
                    u.UserName.ToLower().Contains(searchTerm) ||
                    u.Email.ToLower().Contains(searchTerm) ||
                    u.FirstName.ToLower().Contains(searchTerm) ||
                    u.LastName.ToLower().Contains(searchTerm)
                );

                var total = await usersQuery.CountAsync();

                var users = await usersQuery
                    .OrderBy(u => u.UserName)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                var userList = new List<object>();
                foreach (var user in users)
                {
                    var roles = await _userManager.GetRolesAsync(user);
                    userList.Add(new
                    {
                        user.Id,
                        user.UserName,
                        user.Email,
                        user.FirstName,
                        user.LastName,
                        user.PhoneNumber,
                        Roles = roles
                    });
                }

                return Ok(new
                {
                    Status = "Success",
                    Data = userList,
                    SearchQuery = query,
                    Pagination = new
                    {
                        CurrentPage = page,
                        PageSize = pageSize,
                        TotalCount = total,
                        TotalPages = (int)Math.Ceiling(total / (double)pageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching users with query: {Query}", query);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }
        // ADD THIS METHOD TO YOUR UserManagementController.cs
        // Place it after the GetAllUsers method (around line 100)

        // GET: api/UserManagement/roles - Get all roles
        [HttpGet("roles")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> GetAllRoles()
        {
            try
            {
                var roles = await _roleManager.Roles.ToListAsync();

                var rolesList = roles.Select(r => new
                {
                    Id = r.Id,
                    Name = r.Name
                }).ToList();

                return Ok(new
                {
                    Status = "Success",
                    Data = rolesList
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving roles list");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred while retrieving roles" });
            }
        }
        // PUT: api/UserManagement/{id}/lock
        [HttpPut("{id}/lock")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        public async Task<IActionResult> LockUser(string id)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                // Lock user for 1 year
                var result = await _userManager.SetLockoutEndDateAsync(user, DateTimeOffset.Now.AddYears(1));

                if (!result.Succeeded)
                {
                    return BadRequest(new { Status = "Error", Message = "Failed to lock user!" });
                }

                _logger.LogInformation("User locked: {UserName} by {Admin}", user.UserName, User.Identity.Name);

                return Ok(new { Status = "Success", Message = "User locked successfully!" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error locking user {UserId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // PUT: api/UserManagement/{id}/unlock
        [HttpPut("{id}/unlock")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        public async Task<IActionResult> UnlockUser(string id)
        {
            try
            {
                var user = await _userManager.FindByIdAsync(id);
                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                var result = await _userManager.SetLockoutEndDateAsync(user, null);

                if (!result.Succeeded)
                {
                    return BadRequest(new { Status = "Error", Message = "Failed to unlock user!" });
                }

                // Reset failed login attempts
                await _userManager.ResetAccessFailedCountAsync(user);

                _logger.LogInformation("User unlocked: {UserName} by {Admin}", user.UserName, User.Identity.Name);

                return Ok(new { Status = "Success", Message = "User unlocked successfully!" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unlocking user {UserId}", id);
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }
    }

    // DTO for admin password reset
    public class AdminResetPasswordDto
    {
        [Required]
        [StringLength(100, MinimumLength = 6, ErrorMessage = "Password must be between 6 and 100 characters")]
        public string NewPassword { get; set; }
    }
}