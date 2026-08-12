using System.Net.Http.Json;
using ServiceMaintenance.ViewModel;
using Microsoft.Extensions.Logging;

namespace ServiceMaintenance.Services.JWT
{
    /// <summary>
    /// ✅ IMPROVED: JWT User Management Service
    /// - Uses JwtHttpClientService for automatic token refresh
    /// - Consistent error handling with detailed logging
    /// - Cleaner code structure
    /// </summary>
    public class JwtUserManagementService
    {
        private readonly JwtHttpClientService _jwtHttpClient;
        private readonly ILogger<JwtUserManagementService> _logger;

        public JwtUserManagementService(
            JwtHttpClientService jwtHttpClient,
            ILogger<JwtUserManagementService> logger)
        {
            _jwtHttpClient = jwtHttpClient;
            _logger = logger;
        }

        // ==================== GET ALL USERS ====================
        public async Task<UserListResponse> GetAllUsersAsync(int page = 1, int pageSize = 100)
        {
            try
            {
                _logger.LogDebug($"📥 Fetching users (page: {page}, pageSize: {pageSize})");

                var response = await _jwtHttpClient.GetAsync(
                    $"api/UserManagement?page={page}&pageSize={pageSize}"
                );

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<UserListResponse>();
                    _logger.LogInformation($"✅ Fetched {result?.Data?.Count ?? 0} users");
                    return result ?? new UserListResponse { Status = "Error", Data = new List<UserDto>() };
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"❌ Failed to fetch users: {response.StatusCode} - {errorContent}");

                return new UserListResponse
                {
                    Status = "Error",
                    Message = $"Failed: {response.ReasonPhrase}",
                    Data = new List<UserDto>()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Exception fetching users");
                return new UserListResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}",
                    Data = new List<UserDto>()
                };
            }
        }

        // ==================== GET USER BY ID ====================
        public async Task<UserDetailResponse> GetUserByIdAsync(string userId)
        {
            try
            {
                var response = await _jwtHttpClient.GetAsync($"api/UserManagement/{userId}");

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<UserDetailResponse>();
                    _logger.LogDebug($"✅ Fetched user: {userId}");
                    return result;
                }

                _logger.LogWarning($"❌ User not found: {userId} ({response.StatusCode})");
                return new UserDetailResponse
                {
                    Status = "Error",
                    Message = $"User not found: {response.ReasonPhrase}"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error fetching user {userId}");
                return new UserDetailResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        // ==================== CREATE USER ====================
        public async Task<ApiResponse> CreateUserAsync(CreateUserDto user)
        {
            try
            {
                var response = await _jwtHttpClient.PostAsync(
                    "api/UserManagement",
                    JsonContent.Create(user)
                );

                var result = await response.Content.ReadFromJsonAsync<ApiResponse>();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ User created: {user.UserName}");
                }
                else
                {
                    _logger.LogWarning($"❌ Failed to create user: {response.StatusCode}");
                }

                return result ?? new ApiResponse
                {
                    Status = "Error",
                    Message = $"Failed: {response.ReasonPhrase}"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error creating user");
                return new ApiResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        // ==================== UPDATE USER ====================
        public async Task<ApiResponse> UpdateUserAsync(string userId, UpdateUserDto user)
        {
            try
            {
                var response = await _jwtHttpClient.PutAsync(
                    $"api/UserManagement/{userId}",
                    JsonContent.Create(user)
                );

                var result = await response.Content.ReadFromJsonAsync<ApiResponse>();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ User updated: {userId}");
                }

                return result ?? new ApiResponse
                {
                    Status = "Error",
                    Message = $"Failed: {response.ReasonPhrase}"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error updating user {userId}");
                return new ApiResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        // ==================== DELETE USER ====================
        public async Task<ApiResponse> DeleteUserAsync(string userId)
        {
            try
            {
                var response = await _jwtHttpClient.DeleteAsync($"api/UserManagement/{userId}");
                var result = await response.Content.ReadFromJsonAsync<ApiResponse>();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ User deleted: {userId}");
                }

                return result ?? new ApiResponse
                {
                    Status = "Error",
                    Message = $"Failed: {response.ReasonPhrase}"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error deleting user {userId}");
                return new ApiResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        // ==================== GET ALL ROLES ====================
        public async Task<RoleListResponse> GetAllRolesAsync()
        {
            try
            {
                _logger.LogDebug("📥 Fetching all roles");

                var response = await _jwtHttpClient.GetAsync("api/UserManagement/roles");

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<RoleListResponse>();
                    _logger.LogInformation($"✅ Fetched {result?.Data?.Count ?? 0} roles");
                    return result ?? new RoleListResponse
                    {
                        Status = "Error",
                        Message = "No data returned",
                        Data = new List<RoleDto>()
                    };
                }

                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning($"❌ Failed to fetch roles: {response.StatusCode} - {errorContent}");

                return new RoleListResponse
                {
                    Status = "Error",
                    Message = $"Failed: {response.ReasonPhrase}",
                    Data = new List<RoleDto>()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error fetching roles");
                return new RoleListResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}",
                    Data = new List<RoleDto>()
                };
            }
        }

        // ==================== GET USER ROLES ====================
        public async Task<UserRolesResponse> GetUserRolesAsync(string userId)
        {
            try
            {
                var response = await _jwtHttpClient.GetAsync($"api/UserManagement/{userId}/roles");

                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<UserRolesResponse>();
                }

                return new UserRolesResponse
                {
                    Status = "Error",
                    Message = $"Failed: {response.ReasonPhrase}"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error fetching roles for user {userId}");
                return new UserRolesResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        // ==================== UPDATE USER ROLES ====================
        public async Task<ApiResponse> UpdateUserRolesAsync(string userId, List<string> roles)
        {
            try
            {
                var payload = new { UserId = userId, Roles = roles };
                var response = await _jwtHttpClient.PutAsync(
                    $"api/UserManagement/{userId}/roles",
                    JsonContent.Create(payload)
                );

                var result = await response.Content.ReadFromJsonAsync<ApiResponse>();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Roles updated for user: {userId}");
                }

                return result ?? new ApiResponse
                {
                    Status = "Error",
                    Message = $"Failed: {response.ReasonPhrase}"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error updating roles for user {userId}");
                return new ApiResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        // ==================== RESET USER PASSWORD ====================
        public async Task<ApiResponse> ResetUserPasswordAsync(string userId, string newPassword)
        {
            try
            {
                var payload = new { NewPassword = newPassword };
                var response = await _jwtHttpClient.PutAsync(
                    $"api/UserManagement/{userId}/password",
                    JsonContent.Create(payload)
                );

                var result = await response.Content.ReadFromJsonAsync<ApiResponse>();

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Password reset for user: {userId}");
                }

                return result ?? new ApiResponse
                {
                    Status = "Error",
                    Message = $"Failed: {response.ReasonPhrase}"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error resetting password for user {userId}");
                return new ApiResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}"
                };
            }
        }

        // ==================== SEARCH USERS ====================
        public async Task<UserListResponse> SearchUsersAsync(string query, int page = 1, int pageSize = 10)
        {
            try
            {
                var response = await _jwtHttpClient.GetAsync(
                    $"api/UserManagement/search?query={query}&page={page}&pageSize={pageSize}"
                );

                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadFromJsonAsync<UserListResponse>();
                }

                return new UserListResponse
                {
                    Status = "Error",
                    Message = $"Search failed: {response.ReasonPhrase}",
                    Data = new List<UserDto>()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error searching users");
                return new UserListResponse
                {
                    Status = "Error",
                    Message = $"Error: {ex.Message}",
                    Data = new List<UserDto>()
                };
            }
        }

        // ==================== LOCK/UNLOCK USER ====================
        public async Task<ApiResponse> LockUserAsync(string userId)
        {
            try
            {
                var response = await _jwtHttpClient.PutAsync(
                    $"api/UserManagement/{userId}/lock",
                    null
                );

                return await response.Content.ReadFromJsonAsync<ApiResponse>() ?? new ApiResponse
                {
                    Status = "Error",
                    Message = "Failed to lock user"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error locking user {userId}");
                return new ApiResponse { Status = "Error", Message = ex.Message };
            }
        }

        public async Task<ApiResponse> UnlockUserAsync(string userId)
        {
            try
            {
                var response = await _jwtHttpClient.PutAsync(
                    $"api/UserManagement/{userId}/unlock",
                    null
                );

                return await response.Content.ReadFromJsonAsync<ApiResponse>() ?? new ApiResponse
                {
                    Status = "Error",
                    Message = "Failed to unlock user"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error unlocking user {userId}");
                return new ApiResponse { Status = "Error", Message = ex.Message };
            }
        }
    }

    // ==================== RESPONSE MODELS ====================
    public class UserListResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public List<UserDto> Data { get; set; }
        public PaginationInfo Pagination { get; set; }
    }

    public class UserDetailResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public UserDto Data { get; set; }
    }

    public class UserRolesResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public UserRolesDto Data { get; set; }
    }

    public class RoleListResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public List<RoleDto> Data { get; set; }
    }

    public class RoleDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
    }

    public class ApiResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public object Data { get; set; }
    }

    public class UserDto
    {
        public string Id { get; set; }
        public string UserName { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string PhoneNumber { get; set; }
        public string ProfilePictureUrl { get; set; }  // ✅ ADD THIS

        public List<string> Roles { get; set; } = new();
        public bool EmailConfirmed { get; set; }
        public DateTimeOffset? LockoutEnd { get; set; }
        public bool IsLocked { get; set; }
    }

    public class CreateUserDto
    {
        public string UserName { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string PhoneNumber { get; set; }
        public List<string> Roles { get; set; } = new();
    }

    public class UpdateUserDto
    {
        public string UserName { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string PhoneNumber { get; set; }
    }

    public class UserRolesDto
    {
        public string UserId { get; set; }
        public string UserName { get; set; }
        public List<RoleAssignmentDto> Roles { get; set; }
    }

    public class RoleAssignmentDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public bool IsAssigned { get; set; }
    }

    public class PaginationInfo
    {
        public int CurrentPage { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public int TotalPages { get; set; }
        public bool HasPrevious { get; set; }
        public bool HasNext { get; set; }
    }
}