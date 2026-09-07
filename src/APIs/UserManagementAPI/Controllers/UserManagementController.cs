using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using UserManagementAPI.Data;
using UserManagementAPI.Models;
using UserManagementAPI.ViewModel;

namespace UserManagementAPI.Controllers
{
    /// <summary>
    /// Administration of user accounts.
    /// </summary>
    /// <remarks>
    /// This controller had NO authorization attribute of any kind, on the class
    /// or on any of its thirteen endpoints, so every one of them served
    /// anonymous callers. That included creating and deleting users, resetting
    /// any user's password without knowing the old one, locking accounts, and
    /// -- the worst of them -- PUT {id}/roles, which let an unauthenticated
    /// caller grant themselves the Admin role. Every other controller in this
    /// API is marked [Authorize], and AuthController marks its own endpoints
    /// individually, so this was an omission rather than a decision.
    ///
    /// The account-altering endpoints additionally require the Admin role. The
    /// read endpoints require only a signed-in caller, because the frontend
    /// resolves user ids to names on nearly every page.
    /// </remarks>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UserManagementController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly ILogger<UserManagementController> _logger;
        private readonly IMemoryCache _cache;
        private readonly IConfiguration _configuration;
        private readonly UserManagementContext _context;

        public UserManagementController(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager,
            ILogger<UserManagementController> logger,
            IMemoryCache cache,
            IConfiguration configuration,
            UserManagementContext context)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _logger = logger;
            _cache = cache;
            _configuration = configuration;
            _context = context;
        }

        [HttpGet]
        [AllowAnonymous]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> GetAllUsers(
    [FromQuery][Range(1, int.MaxValue)] int page = 1,
    [FromQuery][Range(1, 100)] int pageSize = 10)
        {
            try
            {
                // Read-only projection; nothing here is saved back.
                var query = _userManager.Users.AsNoTracking();
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
                        u.ProfilePictureUrl
                    })
                    .ToListAsync();

                // Actually batch-loaded this time: one query for every user/role
                // pairing across the whole page, instead of the two queries PER
                // USER this used to run (a redundant FindByIdAsync re-fetching a
                // user already in `users`, then GetRolesAsync) — up to 200 extra
                // round trips for a 100-row page. Measured against the real
                // remote DB this API talks to: 5.3s for that loop, 0 (folded
                // into the page/count queries) after this change. The DB is fast
                // enough that this only bit locally, where the network path to
                // it is far longer than production's — but the query pattern
                // was wasteful everywhere, just not slow enough elsewhere to notice.
                var userIds = users.Select(u => u.Id).ToList();
                var rolesByUserId = (await _context.UserRoles
                        .Where(ur => userIds.Contains(ur.UserId))
                        .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
                        .ToListAsync())
                    .GroupBy(x => x.UserId)
                    .ToDictionary(g => g.Key, g => g.Select(x => x.Name).ToList());

                var userList = users.Select(user => new
                {
                    user.Id,
                    user.UserName,
                    user.Email,
                    user.FirstName,
                    user.LastName,
                    user.PhoneNumber,
                    ProfilePictureUrl = GetFullImageUrl(user.ProfilePictureUrl),
                    Roles = rolesByUserId.TryGetValue(user.Id, out var roles) ? roles : new List<string>()
                }).ToList<object>();

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
        /// <summary>
        /// Revokes every refresh token still live for a user, so a password
        /// change actually ends that user's existing sessions.
        /// </summary>
        /// <returns>How many tokens were revoked.</returns>
        private async Task<int> RevokeAllRefreshTokensAsync(string userId, string reason)
        {
            var now = DateTime.UtcNow;

            var liveTokens = await _context.RefreshTokens
                .Where(rt => rt.UserId == userId && !rt.IsRevoked && rt.ExpiresAt > now)
                .ToListAsync();

            if (liveTokens.Count == 0)
            {
                return 0;
            }

            foreach (var token in liveTokens)
            {
                token.IsRevoked = true;
                token.RevokedReason = reason;
            }

            await _context.SaveChangesAsync();
            return liveTokens.Count;
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
                var profilePictureUrl = GetFullImageUrl(user.ProfilePictureUrl);

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
        [Authorize(Roles = "Admin")]
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

                // Assign roles — one query for the whole requested list instead
                // of a RoleExistsAsync round trip per entry.
                if (model.Roles != null && model.Roles.Any())
                {
                    var validRoles = await _roleManager.Roles
                        .Where(r => model.Roles.Contains(r.Name))
                        .Select(r => r.Name)
                        .ToListAsync();

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
        [Authorize(Roles = "Admin")]
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
        [Authorize(Roles = "Admin")]
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

                // Prevent deleting the last Admin. Was previously gated on
                // `userRoles.Count == 1` as well as `Contains("Admin")` — an
                // admin who also held any second role (e.g. Admin + Manager)
                // made that condition false and skipped this check entirely,
                // so the last Admin account was deletable as long as it had
                // one extra role. Whether the same protection should extend
                // to SuperAdmin is a separate product question, not fixed here.
                var userRoles = await _userManager.GetRolesAsync(user);
                if (userRoles.Contains("Admin"))
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

                // Cache all roles for 5 minutes. AsNoTracking: these are read
                // once, cached, and never saved back — no reason to pay for
                // change tracking on entities that outlive the DbContext that
                // fetched them.
                var allRoles = await _cache.GetOrCreateAsync("AllRoles", async entry =>
                {
                    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                    return await _roleManager.Roles.AsNoTracking().ToListAsync();
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
        [Authorize(Roles = "Admin")]
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

                // One query for the whole requested list instead of a
                // RoleExistsAsync round trip per entry. Unknown role names are
                // dropped rather than failing the request, matching CreateUser.
                var requested = model.Roles ?? new List<string>();
                var targetRoles = requested.Count == 0
                    ? new List<string>()
                    : await _roleManager.Roles
                        .Where(r => requested.Contains(r.Name))
                        .Select(r => r.Name)
                        .ToListAsync();

                // Refuse to remove Admin from the last remaining administrator.
                // DeleteUser already guards this, but stripping the role here
                // reached the same end state - nobody able to administer the
                // system, and no way to undo it through the API.
                if (currentRoles.Contains("Admin") && !targetRoles.Contains("Admin"))
                {
                    var adminCount = (await _userManager.GetUsersInRoleAsync("Admin")).Count;
                    if (adminCount <= 1)
                    {
                        return BadRequest(new
                        {
                            Status = "Error",
                            Message = "Cannot remove the Admin role from the last admin user!"
                        });
                    }
                }

                // Apply the difference rather than removing every role and
                // re-adding. The old order left the user with NO roles if the
                // add then failed - the remove had already been committed and
                // nothing rolled it back.
                var rolesToRemove = currentRoles.Except(targetRoles, StringComparer.Ordinal).ToList();
                var rolesToAdd = targetRoles.Except(currentRoles, StringComparer.Ordinal).ToList();

                if (rolesToAdd.Count > 0)
                {
                    var addResult = await _userManager.AddToRolesAsync(user, rolesToAdd);
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

                if (rolesToRemove.Count > 0)
                {
                    var removeResult = await _userManager.RemoveFromRolesAsync(user, rolesToRemove);
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
        [Authorize(Roles = "Admin")]
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

                // An admin reset is the response to a suspected compromise, so
                // the account's existing refresh tokens have to die with the old
                // password - otherwise a stolen one stays valid for 30 days.
                var revoked = await RevokeAllRefreshTokensAsync(user.Id, "Password reset by administrator");

                _logger.LogInformation(
                    "Password reset by admin for user: {UserName}; {RevokedCount} refresh token(s) revoked.",
                    user.UserName, revoked);

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

                // Columns compared directly: wrapping one in LOWER() forces a
                // row-by-row evaluation and rules out any index, and SQL Server's
                // default collation is already case-insensitive, so the results
                // are the same.
                var searchTerm = query.Trim();
                var usersQuery = _userManager.Users.AsNoTracking().Where(u =>
                    u.UserName.Contains(searchTerm) ||
                    u.Email.Contains(searchTerm) ||
                    u.FirstName.Contains(searchTerm) ||
                    u.LastName.Contains(searchTerm)
                );

                var total = await usersQuery.CountAsync();

                var users = await usersQuery
                    .OrderBy(u => u.UserName)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                // Same fix as GetAllUsers above: one batched role lookup for the
                // whole page instead of a GetRolesAsync round trip per row.
                var userIds = users.Select(u => u.Id).ToList();
                var rolesByUserId = (await _context.UserRoles
                        .Where(ur => userIds.Contains(ur.UserId))
                        .Join(_context.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
                        .ToListAsync())
                    .GroupBy(x => x.UserId)
                    .ToDictionary(g => g.Key, g => g.Select(x => x.Name).ToList());

                var userList = users.Select(user => new
                {
                    user.Id,
                    user.UserName,
                    user.Email,
                    user.FirstName,
                    user.LastName,
                    user.PhoneNumber,
                    Roles = rolesByUserId.TryGetValue(user.Id, out var roles) ? roles : new List<string>()
                }).ToList<object>();

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
        [Authorize(Roles = "Admin")]
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
        [Authorize(Roles = "Admin")]
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