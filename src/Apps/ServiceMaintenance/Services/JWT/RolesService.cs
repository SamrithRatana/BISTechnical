
using System.Security.Claims;


namespace ServiceMaintenance.Services.JWT
{
    /// <summary>
    /// ✅ JWT-based Roles Service
    /// Replaces Identity RoleManager<IdentityRole>
    /// All role operations go through JWT API
    /// </summary>
    public class RolesService
    {
        private readonly JwtUserManagementService _jwtUserManagementService;
        private readonly JwtHttpClientService _jwtHttpClient;
        private readonly ILogger<RolesService> _logger;

        public RolesService(
            JwtUserManagementService jwtUserManagementService,
            JwtHttpClientService jwtHttpClient,
            ILogger<RolesService> logger)
        {
            _jwtUserManagementService = jwtUserManagementService;
            _jwtHttpClient = jwtHttpClient;
            _logger = logger;
        }

        // ==========================================
        // GET ROLES
        // ==========================================

        /// <summary>
        /// Get all roles from JWT API
        /// Replaces: _roleManager.Roles.ToListAsync()
        /// </summary>
        public async Task<List<RoleViewModel>> GetRolesAsync()
        {
            try
            {
                _logger.LogInformation("📥 Fetching all roles from JWT API");

                var response = await _jwtUserManagementService.GetAllRolesAsync();

                if (response.Status == "Success" && response.Data != null)
                {
                    _logger.LogInformation($"✅ Fetched {response.Data.Count} roles from JWT API");

                    return response.Data.Select(r => new RoleViewModel
                    {
                        Id = r.Id,
                        Name = r.Name
                    }).ToList();
                }

                _logger.LogWarning($"❌ Failed to fetch roles: {response.Message}");
                return new List<RoleViewModel>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error fetching roles from JWT API");
                return new List<RoleViewModel>();
            }
        }

        /// <summary>
        /// Check if role exists
        /// Replaces: _roleManager.RoleExistsAsync(roleName)
        /// </summary>
        public async Task<bool> RoleExistsAsync(string roleName)
        {
            try
            {
                var roles = await GetRolesAsync();
                return roles.Any(r => r.Name.Equals(roleName, StringComparison.OrdinalIgnoreCase));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error checking if role exists: {roleName}");
                return false;
            }
        }

        /// <summary>
        /// Get role by ID from JWT API
        /// Replaces: _roleManager.FindByIdAsync(roleId)
        /// </summary>
        public async Task<RoleViewModel> GetRoleByIdAsync(string roleId)
        {
            try
            {
                _logger.LogDebug($"📥 Fetching role by ID: {roleId}");

                // You may need to add this endpoint to your JWT API
                var response = await _jwtHttpClient.GetAsync($"api/RoleManagement/{roleId}");

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<RoleDetailResponse>();
                    if (result?.Status == "Success" && result.Data != null)
                    {
                        return new RoleViewModel
                        {
                            Id = result.Data.Id,
                            Name = result.Data.Name
                        };
                    }
                }

                _logger.LogWarning($"❌ Role not found: {roleId}");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error fetching role {roleId}");
                return null;
            }
        }

        // ==========================================
        // CREATE/UPDATE/DELETE ROLES
        // ==========================================

        /// <summary>
        /// Create a new role via JWT API
        /// Replaces: _roleManager.CreateAsync(new IdentityRole(roleName))
        /// </summary>
        public async Task<RoleOperationResult> CreateRoleAsync(string roleName)
        {
            try
            {
                _logger.LogInformation($"📝 Creating role: {roleName}");

                var payload = new { Name = roleName };
                var response = await _jwtHttpClient.PostAsync(
                    "api/RoleManagement",
                    JsonContent.Create(payload)
                );

                var result = await response.Content.ReadFromJsonAsync<ApiResponse>();

                if (response.IsSuccessStatusCode && result?.Status == "Success")
                {
                    _logger.LogInformation($"✅ Role created: {roleName}");
                    return RoleOperationResult.Success();
                }

                _logger.LogWarning($"❌ Failed to create role: {result?.Message}");
                return RoleOperationResult.Failed(result?.Message ?? "Failed to create role");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error creating role: {roleName}");
                return RoleOperationResult.Failed($"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Update role name via JWT API
        /// Replaces: _roleManager.UpdateAsync(role)
        /// </summary>
        public async Task<RoleOperationResult> UpdateRoleAsync(string roleId, string newRoleName)
        {
            try
            {
                _logger.LogInformation($"📝 Updating role {roleId} to: {newRoleName}");

                var payload = new { Name = newRoleName };
                var response = await _jwtHttpClient.PutAsync(
                    $"api/RoleManagement/{roleId}",
                    JsonContent.Create(payload)
                );

                var result = await response.Content.ReadFromJsonAsync<ApiResponse>();

                if (response.IsSuccessStatusCode && result?.Status == "Success")
                {
                    _logger.LogInformation($"✅ Role updated: {roleId}");
                    return RoleOperationResult.Success();
                }

                _logger.LogWarning($"❌ Failed to update role: {result?.Message}");
                return RoleOperationResult.Failed(result?.Message ?? "Failed to update role");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error updating role: {roleId}");
                return RoleOperationResult.Failed($"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Delete role via JWT API
        /// Replaces: _roleManager.DeleteAsync(role)
        /// </summary>
        public async Task DeleteRoleAsync(string roleId)
        {
            try
            {
                _logger.LogInformation($"🗑️ Deleting role: {roleId}");

                var response = await _jwtHttpClient.DeleteAsync($"api/RoleManagement/{roleId}");

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Role deleted: {roleId}");
                }
                else
                {
                    _logger.LogWarning($"❌ Failed to delete role: {roleId}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error deleting role: {roleId}");
            }
        }

        // ==========================================
        // ROLE CLAIMS (PERMISSIONS)
        // ==========================================

        /// <summary>
        /// Get role claims/permissions from JWT API
        /// Replaces: _roleManager.GetClaimsAsync(role)
        /// </summary>
        public async Task<List<Claim>> GetRoleClaimsAsync(RoleViewModel role)
        {
            try
            {
                _logger.LogDebug($"📥 Fetching claims for role: {role.Name}");

                var response = await _jwtHttpClient.GetAsync($"api/RoleManagement/{role.Id}/claims");

                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<RoleClaimsResponse>();
                    if (result?.Status == "Success" && result.Data != null)
                    {
                        return result.Data.Select(c => new Claim(c.Type, c.Value)).ToList();
                    }
                }

                _logger.LogWarning($"❌ Failed to fetch claims for role: {role.Name}");
                return new List<Claim>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error fetching claims for role: {role.Name}");
                return new List<Claim>();
            }
        }

        /// <summary>
        /// Add claim to role via JWT API
        /// Replaces: _roleManager.AddClaimAsync(role, claim)
        /// </summary>
        public async Task<RoleOperationResult> AddClaimAsync(RoleViewModel role, Claim claim)
        {
            try
            {
                _logger.LogInformation($"📝 Adding claim to role {role.Name}: {claim.Type}={claim.Value}");

                var payload = new { claim.Type, claim.Value };
                var response = await _jwtHttpClient.PostAsync(
                    $"api/RoleManagement/{role.Id}/claims",
                    JsonContent.Create(payload)
                );

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Claim added to role: {role.Name}");
                    return RoleOperationResult.Success();
                }

                _logger.LogWarning($"❌ Failed to add claim to role: {role.Name}");
                return RoleOperationResult.Failed("Failed to add claim");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error adding claim to role: {role.Name}");
                return RoleOperationResult.Failed($"Error: {ex.Message}");
            }
        }

        /// <summary>
        /// Remove claim from role via JWT API
        /// Replaces: _roleManager.RemoveClaimAsync(role, claim)
        /// </summary>
        public async Task<RoleOperationResult> RemoveClaimAsync(RoleViewModel role, Claim claim)
        {
            try
            {
                _logger.LogInformation($"🗑️ Removing claim from role {role.Name}: {claim.Type}={claim.Value}");

                var payload = new { claim.Type, claim.Value };
                var response = await _jwtHttpClient.DeleteAsync($"api/RoleManagement/{role.Id}/claims");

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation($"✅ Claim removed from role: {role.Name}");
                    return RoleOperationResult.Success();
                }

                _logger.LogWarning($"❌ Failed to remove claim from role: {role.Name}");
                return RoleOperationResult.Failed("Failed to remove claim");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Error removing claim from role: {role.Name}");
                return RoleOperationResult.Failed($"Error: {ex.Message}");
            }
        }

        // ==========================================
        // PERMISSIONS MANAGEMENT
        // ==========================================

        /// <summary>
        /// Get permissions for a role
        /// Replaces the old GetPermissionsAsync method
        /// </summary>
       

       
    }

    // ==========================================
    // RESPONSE MODELS
    // ==========================================

    public class RoleViewModel
    {
        public string Id { get; set; }
        public string Name { get; set; }
    }

    public class RoleDetailResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public RoleDto Data { get; set; }
    }

    public class RoleClaimsResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public List<ClaimDto> Data { get; set; }
    }

    public class ClaimDto
    {
        public string Type { get; set; }
        public string Value { get; set; }
    }

    public class RoleOperationResult
    {
        public bool Succeeded { get; set; }
        public string ErrorMessage { get; set; }

        public static RoleOperationResult Success()
        {
            return new RoleOperationResult { Succeeded = true };
        }

        public static RoleOperationResult Failed(string errorMessage)
        {
            return new RoleOperationResult { Succeeded = false, ErrorMessage = errorMessage };
        }
    }
}