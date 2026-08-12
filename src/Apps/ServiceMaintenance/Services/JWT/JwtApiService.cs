using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace ServiceMaintenance.Services.JWT
{
    public class JwtApiService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<JwtApiService> _logger;

        public JwtApiService(IHttpClientFactory httpClientFactory, ILogger<JwtApiService> logger)
        {
            _httpClient = httpClientFactory.CreateClient("JwtApi");
            _logger = logger;
        }

        // File: ServiceMaintenance/Services/JWT/JwtApiService.cs
        // REPLACE LoginAsync method:

        public async Task<JwtLoginResponse> LoginAsync(string username, string password, bool rememberMe)
        {
            try
            {
                _logger.LogInformation("=== JWT API LOGIN ATTEMPT ===");
                _logger.LogInformation($"Username: {username}");

                if (string.IsNullOrWhiteSpace(username))
                {
                    return new JwtLoginResponse
                    {
                        IsSuccess = false,
                        Message = "Username cannot be empty"
                    };
                }

                if (string.IsNullOrWhiteSpace(password))
                {
                    return new JwtLoginResponse
                    {
                        IsSuccess = false,
                        Message = "Password cannot be empty"
                    };
                }

                var loginRequest = new ApiLoginRequest
                {
                    UserName = username,
                    Password = password,
                    RememberMe = rememberMe
                };

                var options = new JsonSerializerOptions
                {
                    PropertyNamingPolicy = null,
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                };

                var json = JsonSerializer.Serialize(loginRequest, options);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("api/Auth/login", content);
                var responseContent = await response.Content.ReadAsStringAsync();

                _logger.LogInformation($"Response Status: {response.StatusCode}");

                if (response.IsSuccessStatusCode)
                {
                    var apiResponse = JsonSerializer.Deserialize<ApiLoginSuccessResponse>(
                        responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );

                    if (apiResponse != null && !string.IsNullOrEmpty(apiResponse.Token))
                    {
                        _logger.LogInformation("✅ Login successful - token and refresh token received");

                        return new JwtLoginResponse
                        {
                            IsSuccess = true,
                            Message = "Login successful",
                            Token = apiResponse.Token,
                            RefreshToken = apiResponse.RefreshToken, // ✅ FIXED
                            Expiration = apiResponse.Expiration,
                            User = new JwtUserInfo
                            {
                                Id = apiResponse.User?.Id,
                                UserName = apiResponse.User?.UserName ?? username,
                                Email = apiResponse.User?.Email ?? username,
                                FirstName = apiResponse.User?.FirstName,
                                LastName = apiResponse.User?.LastName,
                                Roles = apiResponse.User?.Roles ?? new List<string>()
                            }
                        };
                    }
                }

                _logger.LogError($"Login failed - Status: {response.StatusCode}");
                return new JwtLoginResponse
                {
                    IsSuccess = false,
                    Message = "Invalid username or password"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception during login");
                return new JwtLoginResponse
                {
                    IsSuccess = false,
                    Message = $"Login error: {ex.Message}"
                };
            }
        }

    }

    // Request model - must match API's LoginViewModel
    public class ApiLoginRequest
    {
        [JsonPropertyName("UserName")]
        public string UserName { get; set; }

        [JsonPropertyName("Password")]
        public string Password { get; set; }

        [JsonPropertyName("RememberMe")]
        public bool RememberMe { get; set; }
    }

    // Response from your API (from AuthController)
    // File: ServiceMaintenance/Services/JWT/JwtApiService.cs
    // UPDATE ApiLoginSuccessResponse class:

    public class ApiLoginSuccessResponse
    {
        public bool IsSuccess { get; set; } // ✅ ADD THIS
        public string Message { get; set; } // ✅ ADD THIS
        public string Token { get; set; }
        public string RefreshToken { get; set; } // ✅ ADD THIS
        public DateTime Expiration { get; set; }

        // ✅ User object structure
        public UserData User { get; set; }
    }

    public class UserData
    {
        public string Id { get; set; }
        public string UserName { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public List<string> Roles { get; set; }
    }

    // What LoginModel.cs expects
    public class JwtLoginResponse
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; }
        public string Token { get; set; }
        public string RefreshToken { get; set; }
        public DateTime Expiration { get; set; }
        public JwtUserInfo User { get; set; }
    }

    public class JwtUserInfo
    {
        public string Id { get; set; }
        public string UserName { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public List<string> Roles { get; set; }
    }
}