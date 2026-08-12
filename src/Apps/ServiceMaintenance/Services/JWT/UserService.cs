using ServiceMaintenance.Models;
using ServiceMaintenance.ViewModel;
using System.Security.Claims;

namespace ServiceMaintenance.Services.JWT
{
    /// <summary>
    /// User Service - Fully migrated to JWT API
    /// All user data comes from JWT API
    /// </summary>
    public class UserService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly JwtUserManagementService _jwtUserManagementService;
        private readonly ILogger<UserService> _logger;

        public UserService(
            IHttpContextAccessor httpContextAccessor,
            JwtUserManagementService jwtUserManagementService,
            ILogger<UserService> logger)
        {
            _httpContextAccessor = httpContextAccessor;
            _jwtUserManagementService = jwtUserManagementService;
            _logger = logger;
        }

        // ==========================================
        // AUTHENTICATION & CURRENT USER
        // ==========================================

        /// <summary>
        /// Get current logged-in user ID from JWT claims
        /// This reads from HttpContext.User.Claims (populated by JWT authentication middleware)
        /// </summary>
        public Task<string> GetCurrentUserIdAsync()
        {
            try
            {
                var userId = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    _logger.LogWarning("No user ID found in claims - user may not be authenticated");
                    throw new InvalidOperationException("Current user is not authenticated.");
                }

                _logger.LogDebug($"Current user ID from claims: {userId}");
                return Task.FromResult(userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current user ID from claims");
                throw;
            }
        }

        /// <summary>
        /// Get current logged-in user's username from JWT claims
        /// </summary>
        public async Task<string> GetCurrentUserNameAsync()
        {
            try
            {
                var userId = await GetCurrentUserIdAsync();

                // Fetch user details from JWT API
                var userResponse = await _jwtUserManagementService.GetUserByIdAsync(userId);

                if (userResponse.Status == "Success" && userResponse.Data != null)
                {
                    var fullName = $"{userResponse.Data.FirstName} {userResponse.Data.LastName}".Trim();
                    return !string.IsNullOrWhiteSpace(fullName)
                        ? fullName
                        : userResponse.Data.UserName ?? "Unknown User";
                }

                _logger.LogWarning($"Failed to get user name for ID {userId}: {userResponse.Message}");
                return "Unknown User";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting current user name");
                return "System User";
            }
        }

        // ==========================================
        // USER RETRIEVAL (FROM JWT API)
        // ==========================================

        /// <summary>
        /// Get application user by ID from JWT API
        /// </summary>
        public async Task<UserDto> GetApplicationUserAsync(string userId)
        {
            try
            {
                var response = await _jwtUserManagementService.GetUserByIdAsync(userId);

                if (response.Status == "Success" && response.Data != null)
                {
                    return response.Data;
                }

                _logger.LogWarning($"User not found: {userId}");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching user {userId} from JWT API");
                return null;
            }
        }

        /// <summary>
        /// ✅ FIXED: Get all users for chat interface
        /// </summary>
        public async Task<List<UserViewModel>> GetAllUsersForChatAsync()
        {
            try
            {
                _logger.LogInformation("📥 Loading users for chat...");

                // ✅ FIXED: Changed _jwtUserService to _jwtUserManagementService
                var response = await _jwtUserManagementService.GetAllUsersAsync(page: 1, pageSize: 100);

                if (response?.Status == "Success" && response.Data != null)
                {
                    _logger.LogInformation($"✅ Loaded {response.Data.Count} users");

                    // Map to UserViewModel for chat interface
                    var userViewModels = response.Data.Select(u => new UserViewModel
                    {
                        Id = u.Id,
                        UserName = u.UserName,
                        Email = u.Email,
                        ProfilePicture = null, // Will be loaded separately if needed
                        IsOnline = false // Will be set by SignalR
                    }).ToList();

                    return userViewModels;
                }
                else
                {
                    _logger.LogWarning($"⚠️ Failed to load users: {response?.Message}");
                    return new List<UserViewModel>();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error loading users for chat");
                return new List<UserViewModel>();
            }
        }

        /// <summary>
        /// Get all users from JWT API
        /// </summary>
        public async Task<List<UserViewModel>> GetUsersAsync()
        {
            try
            {
                var allUsers = new List<UserDto>();
                int currentPage = 1;
                const int pageSize = 100; // API max
                bool hasMore = true;

                while (hasMore)
                {
                    var response = await _jwtUserManagementService.GetAllUsersAsync(page: currentPage, pageSize: pageSize);

                    if (response?.Status == "Success" && response.Data != null && response.Data.Any())
                    {
                        allUsers.AddRange(response.Data);
                        hasMore = response.Pagination?.HasNext ?? false;
                        currentPage++;
                    }
                    else
                    {
                        hasMore = false;
                    }
                }

                return allUsers.Select(u => new UserViewModel
                {
                    Id = u.Id,
                    UserName = u.UserName,
                    FirstName = u.FirstName,
                    LastName = u.LastName,
                    Email = u.Email,
                    PhoneNumber = u.PhoneNumber,
                    Roles = u.Roles
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching users from JWT API");
                return new List<UserViewModel>();
            }
        }

        /// <summary>
        /// Get specific user by ID from JWT API
        /// </summary>
        public async Task<UserViewModel> GetUserAsync(string userId)
        {
            try
            {
                var response = await _jwtUserManagementService.GetUserByIdAsync(userId);

                if (response.Status == "Success" && response.Data != null)
                {
                    var user = response.Data;
                    return new UserViewModel
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        Email = user.Email,
                        PhoneNumber = user.PhoneNumber,
                        Roles = user.Roles
                    };
                }

                _logger.LogWarning($"User not found: {userId}");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching user {userId} from JWT API");
                return null;
            }
        }

        // ==========================================
        // USER MANAGEMENT (CRUD OPERATIONS)
        // ==========================================

        /// <summary>
        /// Create new user via JWT API
        /// </summary>
        public async Task<ApiResponse> CreateUserAsync(UserViewModel userModel)
        {
            try
            {
                var createDto = new CreateUserDto
                {
                    UserName = userModel.UserName,
                    Email = userModel.Email,
                    Password = userModel.Password,
                    FirstName = userModel.FirstName,
                    LastName = userModel.LastName,
                    PhoneNumber = userModel.PhoneNumber,
                    Roles = userModel.Roles?.ToList() ?? new List<string>()
                };

                var response = await _jwtUserManagementService.CreateUserAsync(createDto);

                if (response.Status == "Success")
                {
                    _logger.LogInformation($"User created successfully: {userModel.UserName}");
                }
                else
                {
                    _logger.LogWarning($"Failed to create user: {response.Message}");
                }

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user via JWT API");
                return new ApiResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Update user via JWT API
        /// </summary>
        public async Task<ApiResponse> UpdateUserAsync(UserViewModel userModel)
        {
            try
            {
                var updateDto = new UpdateUserDto
                {
                    UserName = userModel.UserName,
                    Email = userModel.Email,
                    FirstName = userModel.FirstName,
                    LastName = userModel.LastName,
                    PhoneNumber = userModel.PhoneNumber
                };

                var response = await _jwtUserManagementService.UpdateUserAsync(userModel.Id, updateDto);

                if (response.Status == "Success")
                {
                    _logger.LogInformation($"User updated successfully: {userModel.Id}");
                }
                else
                {
                    _logger.LogWarning($"Failed to update user: {response.Message}");
                }

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating user {userModel.Id} via JWT API");
                return new ApiResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Delete user via JWT API
        /// </summary>
        public async Task<ApiResponse> DeleteUserAsync(string userId)
        {
            try
            {
                var response = await _jwtUserManagementService.DeleteUserAsync(userId);

                if (response.Status == "Success")
                {
                    _logger.LogInformation($"User deleted successfully: {userId}");
                }
                else
                {
                    _logger.LogWarning($"Failed to delete user: {response.Message}");
                }

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting user {userId} via JWT API");
                return new ApiResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        // ==========================================
        // ROLE MANAGEMENT (VIA JWT API)
        // ==========================================

        /// <summary>
        /// Get all available roles from JWT API
        /// Endpoint: GET api/UserManagement/roles
        /// </summary>
        public async Task<List<CheckBoxViewModel>> GetAllRolesAsync()
        {
            try
            {
                _logger.LogInformation("Fetching all roles from JWT API");

                // Call JWT API to get roles
                var response = await _jwtUserManagementService.GetAllRolesAsync();

                if (response.Status == "Success" && response.Data != null && response.Data.Any())
                {
                    _logger.LogInformation($"Successfully fetched {response.Data.Count} roles from JWT API");

                    // Convert RoleDto to CheckBoxViewModel
                    return response.Data.Select(role => new CheckBoxViewModel
                    {
                        RoleId = role.Id,
                        RoleName = role.Name,
                        DisplayValue = role.Name,
                        IsSelected = false
                    }).ToList();
                }

                _logger.LogWarning($"Failed to fetch roles from JWT API: {response.Message}");

                // Return empty list if failed
                return new List<CheckBoxViewModel>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching roles from JWT API");
                return new List<CheckBoxViewModel>();
            }
        }

        /// <summary>
        /// Get user roles from JWT API
        /// </summary>
        public async Task<UserRolesViewModel> GetUserRolesAsync(string userId)
        {
            try
            {
                var response = await _jwtUserManagementService.GetUserRolesAsync(userId);

                if (response.Status == "Success" && response.Data != null)
                {
                    return new UserRolesViewModel
                    {
                        UserId = response.Data.UserId,
                        UserName = response.Data.UserName,
                        Roles = response.Data.Roles.Select(r => new CheckBoxViewModel
                        {
                            RoleId = r.Id,
                            DisplayValue = r.Name,
                            IsSelected = r.IsAssigned
                        }).ToList()
                    };
                }

                _logger.LogWarning($"Failed to get roles for user {userId}");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching roles for user {userId}");
                return null;
            }
        }

        /// <summary>
        /// Update user roles via JWT API
        /// </summary>
        public async Task<ApiResponse> UpdateUserRolesAsync(UserRolesViewModel model)
        {
            try
            {
                var selectedRoles = model.Roles
                    .Where(r => r.IsSelected)
                    .Select(r => r.DisplayValue)
                    .ToList();

                var response = await _jwtUserManagementService.UpdateUserRolesAsync(model.UserId, selectedRoles);

                if (response.Status == "Success")
                {
                    _logger.LogInformation($"Roles updated for user: {model.UserId}");
                }

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating roles for user {model.UserId}");
                return new ApiResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Update user password via JWT API
        /// </summary>
        public async Task<ApiResponse> UpdatePasswordAsync(string userId, string newPassword)
        {
            try
            {
                var response = await _jwtUserManagementService.ResetUserPasswordAsync(userId, newPassword);

                if (response.Status == "Success")
                {
                    _logger.LogInformation($"Password updated for user: {userId}");
                }

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating password for user {userId}");
                return new ApiResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        // ==========================================
        // MESSAGING (VIA JWT API)
        // ==========================================

        /// <summary>
        /// Get last message between two users via JWT Message API
        /// Endpoint: GET api/Message/last
        /// </summary>
      
    }
}