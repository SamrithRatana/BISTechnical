using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using UserManagementAPI.Data;
using UserManagementAPI.Models;
using UserManagementAPI.Services;
using UserManagementAPI.ViewModel;

namespace UserManagementAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthController> _logger;
        private readonly UserManagementContext _context; // ✅ ADD THIS

        // ✅ FIXED: Add DbContext to constructor
        public AuthController(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager,
            IConfiguration configuration,
            ILogger<AuthController> logger,
            UserManagementContext context) // ✅ ADD THIS PARAMETER
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _configuration = configuration;
            _logger = logger;
            _context = context; // ✅ ADD THIS
        }

        // POST: api/auth/register
        [HttpPost("register")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(object), StatusCodes.Status409Conflict)]
        public async Task<IActionResult> Register([FromBody] RegisterViewModel model)
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

                // Check existing username
                if (await _userManager.FindByNameAsync(model.UserName) != null)
                {
                    return Conflict(new { Status = "Error", Message = "Username already exists!" });
                }

                // Check existing email
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
                    SecurityStamp = Guid.NewGuid().ToString()
                };

                var result = await _userManager.CreateAsync(user, model.Password);

                if (!result.Succeeded)
                {
                    _logger.LogWarning("User registration failed for {Email}: {Errors}",
                        model.Email,
                        string.Join(", ", result.Errors.Select(e => e.Description)));

                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "User creation failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                // Assign default role
                if (!await _roleManager.RoleExistsAsync("User"))
                {
                    await _roleManager.CreateAsync(new IdentityRole("User"));
                }
                await _userManager.AddToRoleAsync(user, "User");

                _logger.LogInformation("User registered successfully: {UserName}", model.UserName);

                return Ok(new { Status = "Success", Message = "User created successfully!" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during user registration");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred during registration" });
            }
        }
        /// <summary>
        /// Generate JWT token with user info, roles, AND role claims (permissions)
        /// </summary>
        private async Task<JwtSecurityToken> GenerateJwtTokenWithPermissions(ApplicationUser user)
        {
            var authClaims = new List<Claim>
    {
        new Claim(ClaimTypes.Name, user.UserName),
        new Claim(ClaimTypes.NameIdentifier, user.Id),
        new Claim(ClaimTypes.Email, user.Email),
        new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
    };

            // Get user's roles
            var userRoles = await _userManager.GetRolesAsync(user);

            _logger.LogInformation($"🔐 Generating JWT for user '{user.UserName}' with {userRoles.Count} roles");

            foreach (var roleName in userRoles)
            {
                // Add role claim
                authClaims.Add(new Claim(ClaimTypes.Role, roleName));
                _logger.LogInformation($"  ✅ Added role: {roleName}");

                // ⭐ THIS IS THE KEY FIX: Get role entity and its claims (permissions)
                var role = await _roleManager.FindByNameAsync(roleName);
                if (role != null)
                {
                    var roleClaims = await _roleManager.GetClaimsAsync(role);

                    _logger.LogInformation($"  📋 Found {roleClaims.Count} permissions for role '{roleName}':");

                    foreach (var roleClaim in roleClaims)
                    {
                        // Add each permission claim to the JWT token
                        authClaims.Add(new Claim(roleClaim.Type, roleClaim.Value));
                        _logger.LogInformation($"    ✅ {roleClaim.Type} = {roleClaim.Value}");
                    }
                }
                else
                {
                    _logger.LogWarning($"  ⚠️ Role '{roleName}' not found in database!");
                }
            }

            _logger.LogInformation($"🎫 Total claims in JWT: {authClaims.Count}");

            var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JWT:Secret"]));
            var tokenValidityInHours = Convert.ToDouble(_configuration["JWT:TokenValidityInHours"] ?? "3");

            var token = new JwtSecurityToken(
                issuer: _configuration["JWT:ValidIssuer"],
                audience: _configuration["JWT:ValidAudience"],
                expires: DateTime.UtcNow.AddHours(tokenValidityInHours),
                claims: authClaims,
                signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
            );

            return token;
        }
        // File: UserManagementAPI/Controllers/AuthController.cs
        // REPLACE Login method:

        [HttpPost("login")]
        [EnableRateLimiting("login")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(object), StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> Login([FromBody] LoginViewModel model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(CreateLoginErrorResponse("Invalid request"));
                }

                var user = await _userManager.FindByNameAsync(model.UserName);

                if (user == null || !await _userManager.CheckPasswordAsync(user, model.Password))
                {
                    _logger.LogWarning("Failed login attempt for username: {UserName}", model.UserName);
                    return Unauthorized(CreateLoginErrorResponse("Invalid username or password"));
                }

                if (await _userManager.IsLockedOutAsync(user))
                {
                    _logger.LogWarning("Login attempt for locked account: {UserName}", model.UserName);
                    return Unauthorized(CreateLoginErrorResponse("Account is locked. Please try again later."));
                }

                var userRoles = await _userManager.GetRolesAsync(user);

                // Generate JWT token with permissions
                var token = await GenerateJwtTokenWithPermissions(user);

                // ✅ FIXED: Generate refresh token
                var jwtId = token.Claims.First(c => c.Type == JwtRegisteredClaimNames.Jti).Value;
                var refreshToken = await GenerateRefreshTokenAsync(user, jwtId);

                _logger.LogInformation("✅ User logged in successfully: {UserName}", model.UserName);

                return Ok(new
                {
                    IsSuccess = true,
                    Message = "Login successful",
                    Token = new JwtSecurityTokenHandler().WriteToken(token),
                    RefreshToken = refreshToken, // ✅ FIXED: Now returns refresh token
                    Expiration = token.ValidTo,
                    User = new
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        Email = user.Email,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        Roles = userRoles.ToList()
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during login");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred during login" });
            }
        }
        // POST: api/auth/register-admin
        [HttpPost("register-admin")]
        [Authorize(Roles = "Admin")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> RegisterAdmin([FromBody] RegisterViewModel model)
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
                    SecurityStamp = Guid.NewGuid().ToString()
                };

                var result = await _userManager.CreateAsync(user, model.Password);

                if (!result.Succeeded)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "User creation failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                // Ensure roles exist
                foreach (var roleName in new[] { "Admin", "User" })
                {
                    if (!await _roleManager.RoleExistsAsync(roleName))
                    {
                        await _roleManager.CreateAsync(new IdentityRole(roleName));
                    }
                }

                await _userManager.AddToRolesAsync(user, new[] { "Admin", "User" });

                _logger.LogInformation("Admin user created by {CurrentUser}: {NewUserName}",
                    User.Identity.Name, model.UserName);

                return Ok(new { Status = "Success", Message = "Admin user created successfully!" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during admin registration");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // POST: api/auth/change-password
        [HttpPost("change-password")]
        [Authorize]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordApiViewModel model)
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

                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var user = await _userManager.FindByIdAsync(userId);

                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);

                if (!result.Succeeded)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Password change failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                _logger.LogInformation("Password changed for user: {UserName}", user.UserName);

                return Ok(new { Status = "Success", Message = "Password changed successfully!" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during password change");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // POST: api/auth/forgot-password
        [HttpPost("forgot-password")]
        [EnableRateLimiting("login")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordViewModel model)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Invalid email format"
                    });
                }

                var user = await _userManager.FindByEmailAsync(model.Email);

                // SECURITY: Always return success to prevent user enumeration
                // Don't reveal if user exists or not
                if (user == null)
                {
                    _logger.LogWarning("Password reset requested for non-existent email: {Email}", model.Email);
                    return Ok(new
                    {
                        Status = "Success",
                        Message = "If the email exists, a password reset link has been sent."
                    });
                }

                var token = await _userManager.GeneratePasswordResetTokenAsync(user);

                // TODO: Send email with reset link
                // var resetLink = $"{Request.Scheme}://{Request.Host}/reset-password?token={Uri.EscapeDataString(token)}&email={Uri.EscapeDataString(user.Email)}";
                // await _emailService.SendPasswordResetEmail(user.Email, resetLink);

                _logger.LogInformation("Password reset token generated for: {Email}", model.Email);

                // PRODUCTION: Remove token from response!
                return Ok(new
                {
                    Status = "Success",
                    Message = "If the email exists, a password reset link has been sent.",
                    // Token = token, // NEVER return this in production!
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during forgot password");
                return Ok(new
                {
                    Status = "Success",
                    Message = "If the email exists, a password reset link has been sent."
                });
            }
        }

        // POST: api/auth/reset-password
        [HttpPost("reset-password")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(object), StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordViewModel model)
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

                var user = await _userManager.FindByEmailAsync(model.Email);

                if (user == null)
                {
                    // Don't reveal user doesn't exist
                    return BadRequest(new { Status = "Error", Message = "Password reset failed!" });
                }

                var result = await _userManager.ResetPasswordAsync(user, model.Token, model.Password);

                if (!result.Succeeded)
                {
                    _logger.LogWarning("Password reset failed for {Email}: {Errors}",
                        model.Email,
                        string.Join(", ", result.Errors.Select(e => e.Description)));

                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Password reset failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                _logger.LogInformation("Password reset successfully for: {Email}", model.Email);

                return Ok(new { Status = "Success", Message = "Password has been reset successfully!" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during password reset");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }
        [HttpPost("upload-profile-picture")]
        [Authorize]
        [RequestSizeLimit(5 * 1024 * 1024)]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> UploadProfilePicture([FromForm] IFormFile profilePicture)
        {
            try
            {
                _logger.LogInformation("=== UPLOAD PROFILE PICTURE START ===");

                if (profilePicture == null || profilePicture.Length == 0)
                {
                    _logger.LogWarning("No file uploaded");
                    return BadRequest(new { Status = "Error", Message = "No file uploaded!" });
                }

                _logger.LogInformation($"File: {profilePicture.FileName}, Size: {profilePicture.Length} bytes");

                var fileService = HttpContext.RequestServices.GetRequiredService<IFileStorageService>();

                if (!fileService.IsValidImageFile(profilePicture))
                {
                    _logger.LogWarning("Invalid file validation");
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Invalid file. Only JPG, PNG, and WebP images under 5MB are allowed."
                    });
                }

                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var user = await _userManager.FindByIdAsync(userId);

                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                // Delete old profile picture if exists
                if (!string.IsNullOrEmpty(user.ProfilePictureUrl))
                {
                    _logger.LogInformation($"Deleting old picture: {user.ProfilePictureUrl}");
                    await fileService.DeleteProfilePictureAsync(user.ProfilePictureUrl);
                }

                // Save new profile picture (returns relative path like /uploads/profile-pictures/xxx.jpg)
                var relativePath = await fileService.SaveProfilePictureAsync(profilePicture, userId);
                _logger.LogInformation($"File saved with relative path: {relativePath}");

                // Store ONLY the relative path in database
                user.ProfilePictureUrl = relativePath;

                var result = await _userManager.UpdateAsync(user);

                if (!result.Succeeded)
                {
                    _logger.LogError("Failed to update user in database");
                    return BadRequest(new { Status = "Error", Message = "Failed to update profile picture!" });
                }

                _logger.LogInformation($"✅ Profile picture updated for user: {user.UserName}");

                // Build full URL for response
                var fullUrl = GetFullImageUrl(relativePath);
                _logger.LogInformation($"Returning full URL: {fullUrl}");

                return Ok(new
                {
                    Status = "Success",
                    Message = "Profile picture uploaded successfully!",
                    ProfilePictureUrl = fullUrl
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error uploading profile picture");
                return StatusCode(500, new { Status = "Error", Message = $"An error occurred: {ex.Message}" });
            }
        }

        // DELETE: api/auth/delete-profile-picture
        [HttpDelete("delete-profile-picture")]
        [Authorize]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        public async Task<IActionResult> DeleteProfilePicture()
        {
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var user = await _userManager.FindByIdAsync(userId);

                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                if (string.IsNullOrEmpty(user.ProfilePictureUrl))
                {
                    return BadRequest(new { Status = "Error", Message = "No profile picture to delete!" });
                }

                var fileService = HttpContext.RequestServices.GetRequiredService<IFileStorageService>();
                await fileService.DeleteProfilePictureAsync(user.ProfilePictureUrl);

                user.ProfilePictureUrl = null;
                await _userManager.UpdateAsync(user);

                _logger.LogInformation($"✅ Profile picture deleted for user: {user.UserName}");

                return Ok(new { Status = "Success", Message = "Profile picture deleted successfully!" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting profile picture");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }
        [HttpGet("profile")]
        [Authorize]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetProfile()
        {
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var user = await _userManager.FindByIdAsync(userId);

                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                var roles = await _userManager.GetRolesAsync(user);

                // Build full URL for profile picture
                var profilePictureUrl = GetFullImageUrl(user.ProfilePictureUrl);

                if (!string.IsNullOrEmpty(profilePictureUrl))
                {
                    _logger.LogInformation($"Profile picture URL for {user.UserName}: {profilePictureUrl}");
                }

                return Ok(new
                {
                    Status = "Success",
                    Data = new
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        Email = user.Email,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        PhoneNumber = user.PhoneNumber,
                        ProfilePictureUrl = profilePictureUrl,
                        Roles = roles
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting profile");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }

        // PUT: api/auth/update-profile
        [HttpPut("update-profile")]
        [Authorize]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileViewModel model)
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

                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var user = await _userManager.FindByIdAsync(userId);

                if (user == null)
                {
                    return NotFound(new { Status = "Error", Message = "User not found!" });
                }

                _logger.LogInformation($"BEFORE UPDATE: ProfilePictureUrl = '{user.ProfilePictureUrl ?? "NULL"}'");

                // Check if email is being changed and if it's taken
                if (user.Email != model.Email && await _userManager.FindByEmailAsync(model.Email) != null)
                {
                    return Conflict(new { Status = "Error", Message = "Email already in use!" });
                }

                // ✅ Update user properties
                user.FirstName = model.FirstName;
                user.LastName = model.LastName;
                user.Email = model.Email;
                user.PhoneNumber = model.PhoneNumber;

                // ✅ CRITICAL: Do NOT touch ProfilePictureUrl in this endpoint
                // ProfilePictureUrl is managed ONLY by upload-profile-picture and delete-profile-picture endpoints
                _logger.LogInformation($"ProfilePictureUrl unchanged: '{user.ProfilePictureUrl ?? "NULL"}'");

                var result = await _userManager.UpdateAsync(user);

                if (!result.Succeeded)
                {
                    return BadRequest(new
                    {
                        Status = "Error",
                        Message = "Profile update failed!",
                        Errors = result.Errors.Select(e => e.Description)
                    });
                }

                var updatedUser = await _userManager.FindByIdAsync(userId);
                _logger.LogInformation($"AFTER UPDATE: ProfilePictureUrl = '{updatedUser.ProfilePictureUrl ?? "NULL"}'");
                _logger.LogInformation($"✅ Profile updated successfully for user: {user.UserName}");

                return Ok(new { Status = "Success", Message = "Profile updated successfully!" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating profile");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }
        // File: UserManagementAPI/Controllers/AuthController.cs
        // ADD this method to AuthController:

        /// <summary>
        /// ✅ Generate Refresh Token and store in database
        /// </summary>
        private async Task<string> GenerateRefreshTokenAsync(ApplicationUser user, string jwtId)
        {
            var refreshTokenValidityInDays = Convert.ToInt32(
                _configuration["JWT:RefreshTokenValidityInDays"] ?? "30"
            );

            var refreshToken = new RefreshToken
            {
                UserId = user.Id,
                Token = Convert.ToBase64String(Guid.NewGuid().ToByteArray()) +
                        Convert.ToBase64String(Guid.NewGuid().ToByteArray()),
                JwtId = jwtId,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenValidityInDays), // From config
                IsUsed = false,
                IsRevoked = false
            };

            _context.RefreshTokens.Add(refreshToken);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"✅ Refresh token created for user {user.UserName}, expires: {refreshToken.ExpiresAt}");

            return refreshToken.Token;
        }
        /// <summary>
        /// ✅ FIXED: Complete Refresh Token Implementation
        /// POST: api/auth/refresh-token
        /// </summary>
        [HttpPost("refresh-token")]
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.RefreshToken))
                {
                    return BadRequest(new { Status = "Error", Message = "Refresh token is required" });
                }

                // 1. Validate refresh token exists and not expired
                var storedToken = await _context.RefreshTokens
                    .Include(rt => rt.User)
                    .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken);

                if (storedToken == null)
                {
                    return Unauthorized(new { Status = "Error", Message = "Invalid refresh token" });
                }

                // 2. Check if token is expired
                if (storedToken.ExpiresAt < DateTime.UtcNow)
                {
                    return Unauthorized(new { Status = "Error", Message = "Refresh token expired" });
                }

                // 3. Check if token is already used or revoked
                if (storedToken.IsUsed || storedToken.IsRevoked)
                {
                    return Unauthorized(new { Status = "Error", Message = "Refresh token already used or revoked" });
                }

                // 4. Get user
                var user = storedToken.User;
                if (user == null || await _userManager.IsLockedOutAsync(user))
                {
                    return Unauthorized(new { Status = "Error", Message = "User not found or locked" });
                }

                // 5. Mark old refresh token as used
                storedToken.IsUsed = true;
                _context.RefreshTokens.Update(storedToken);

                // 6. Generate new JWT token
                var newJwtToken = await GenerateJwtTokenWithPermissions(user);
                var newJwtId = newJwtToken.Claims.First(c => c.Type == JwtRegisteredClaimNames.Jti).Value;

                // 7. Generate new refresh token
                var newRefreshToken = await GenerateRefreshTokenAsync(user, newJwtId);

                // 8. Link old token to new token (for audit trail)
                storedToken.ReplacedByToken = newRefreshToken;
                await _context.SaveChangesAsync();

                _logger.LogInformation("✅ Token refreshed for user: {UserName}", user.UserName);

                return Ok(new
                {
                    Status = "Success",
                    Token = new JwtSecurityTokenHandler().WriteToken(newJwtToken),
                    RefreshToken = newRefreshToken,
                    Expiration = newJwtToken.ValidTo
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error refreshing token");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred during token refresh" });
            }
        }

        /// <summary>
        /// ✅ Revoke Refresh Token (for logout)
        /// POST: api/auth/revoke-token
        /// </summary>
        [HttpPost("revoke-token")]
        [AllowAnonymous] // Allow calling even if access token expired
        [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
        public async Task<IActionResult> RevokeToken([FromBody] RefreshTokenRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.RefreshToken))
                {
                    return BadRequest(new { Status = "Error", Message = "Refresh token is required" });
                }

                var token = await _context.RefreshTokens
                    .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken);

                if (token == null)
                {
                    return NotFound(new { Status = "Error", Message = "Token not found" });
                }

                // ✅ Check if already revoked
                if (token.IsRevoked)
                {
                    return Ok(new { Status = "Success", Message = "Token already revoked" });
                }

                token.IsRevoked = true;
                token.RevokedReason = "Revoked by user logout"; // ✅ SET REASON
                _context.RefreshTokens.Update(token);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"✅ Token revoked for user: {token.UserId}");

                return Ok(new { Status = "Success", Message = "Token revoked successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error revoking token");
                return StatusCode(500, new { Status = "Error", Message = "An error occurred" });
            }
        }
        // Helper: Generate JWT Token
        private JwtSecurityToken GenerateJwtToken(List<Claim> authClaims)
        {
            var authSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JWT:Secret"]));
            var tokenValidityInHours = Convert.ToDouble(_configuration["JWT:TokenValidityInHours"] ?? "3");

            var token = new JwtSecurityToken(
                issuer: _configuration["JWT:ValidIssuer"],
                audience: _configuration["JWT:ValidAudience"],
                expires: DateTime.UtcNow.AddHours(tokenValidityInHours),
                claims: authClaims,
                signingCredentials: new SigningCredentials(authSigningKey, SecurityAlgorithms.HmacSha256)
            );

            return token;
        }

        // Helper: Create consistent login error response
        private object CreateLoginErrorResponse(string message)
        {
            return new
            {
                IsSuccess = false,
                Message = message,
                Token = (string)null,
                RefreshToken = (string)null,
                Expiration = DateTime.MinValue,
                User = (object)null
            };
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

            var fullUrl = $"{apiBaseUrl}{relativePath}";

            _logger.LogInformation($"Built full URL: {fullUrl}");

            return fullUrl;
        }
    }
}