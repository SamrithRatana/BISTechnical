// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.
#nullable disable

using System;
using System.ComponentModel.DataAnnotations;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ServiceMaintenance.Services;
using ServiceMaintenance.Services.JWT;

namespace ServiceMaintenance.Areas.Identity.Pages.Account.Manage
{
    [Authorize]
    public class IndexModel : PageModel
    {
        private readonly JwtSessionService _jwtSessionService;
        private readonly JwtHttpClientService _jwtHttpClient;
        private readonly ILogger<IndexModel> _logger;

        public IndexModel(
            JwtSessionService jwtSessionService,
            JwtHttpClientService jwtHttpClient,
            ILogger<IndexModel> logger)
        {
            _jwtSessionService = jwtSessionService;
            _jwtHttpClient = jwtHttpClient;
            _logger = logger;
        }

        public string Username { get; set; }
        public string ProfilePictureUrl { get; set; }

        [TempData]
        public string StatusMessage { get; set; }

        [BindProperty]
        public InputModel Input { get; set; }

        public class InputModel
        {
            [Required]
            [Display(Name = "First Name")]
            public string FirstName { get; set; }

            [Required]
            [Display(Name = "Last Name")]
            public string LastName { get; set; }

            [EmailAddress]
            [Display(Name = "Email")]
            public string Email { get; set; }

            [Phone]
            [Display(Name = "Phone number")]
            public string PhoneNumber { get; set; }

            [Display(Name = "Profile Picture")]
            public IFormFile ProfilePictureFile { get; set; }
        }

        private async Task<bool> LoadAsync()
        {
            try
            {
                if (_jwtSessionService.IsTokenExpired())
                {
                    _logger.LogWarning("JWT token expired");
                    return false;
                }

                var response = await _jwtHttpClient.GetAsync("api/Auth/profile");

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning($"Failed to load profile: {response.StatusCode} - {errorContent}");
                    return false;
                }

                var profileResponse = await response.Content.ReadFromJsonAsync<ProfileResponse>();

                if (profileResponse?.Data == null)
                {
                    _logger.LogWarning("Profile data is null");
                    return false;
                }

                var profile = profileResponse.Data;

                Username = profile.UserName;
                ProfilePictureUrl = profile.ProfilePictureUrl;

                Input = new InputModel
                {
                    FirstName = profile.FirstName,
                    LastName = profile.LastName,
                    Email = profile.Email,
                    PhoneNumber = profile.PhoneNumber
                };

                _logger.LogInformation($"Profile loaded successfully for user: {Username}");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading user profile");
                return false;
            }
        }

        public async Task<IActionResult> OnGetAsync()
        {
            if (_jwtSessionService.IsTokenExpired())
            {
                _logger.LogWarning("JWT token expired, redirecting to login");
                return RedirectToPage("/Account/Login", new { area = "Identity", expired = true });
            }

            var loaded = await LoadAsync();
            if (!loaded)
            {
                StatusMessage = "Error: Unable to load user profile";
                return RedirectToPage("/Account/Login", new { area = "Identity" });
            }

            return Page();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            if (_jwtSessionService.IsTokenExpired())
            {
                _logger.LogWarning("JWT token expired during profile update");
                return RedirectToPage("/Account/Login", new { area = "Identity", expired = true });
            }

            if (!ModelState.IsValid)
            {
                await LoadAsync();
                return Page();
            }

            try
            {
                bool profileUpdated = false;
                bool pictureUpdated = false;

                // ✅ STEP 1: Upload profile picture FIRST if provided
                if (Input.ProfilePictureFile != null && Input.ProfilePictureFile.Length > 0)
                {
                    _logger.LogInformation($"Uploading profile picture: {Input.ProfilePictureFile.FileName} ({Input.ProfilePictureFile.Length} bytes)");

                    using var content = new MultipartFormDataContent();
                    using var fileStream = Input.ProfilePictureFile.OpenReadStream();
                    using var streamContent = new StreamContent(fileStream);

                    streamContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
                        Input.ProfilePictureFile.ContentType ?? "image/jpeg");

                    content.Add(streamContent, "profilePicture", Input.ProfilePictureFile.FileName);

                    var uploadResponse = await _jwtHttpClient.PostAsync("api/Auth/upload-profile-picture", content);

                    if (uploadResponse.IsSuccessStatusCode)
                    {
                        pictureUpdated = true;
                        var uploadResult = await uploadResponse.Content.ReadFromJsonAsync<UploadProfilePictureResponse>();
                        ProfilePictureUrl = uploadResult?.ProfilePictureUrl;

                        _logger.LogInformation($"✅ Profile picture uploaded successfully. Full URL: {ProfilePictureUrl}");

                        // ✅ The upload endpoint already saved to database, so we're done with picture upload
                        // No need to send ProfilePictureUrl in update request
                    }
                    else
                    {
                        var errorContent = await uploadResponse.Content.ReadAsStringAsync();
                        _logger.LogError($"❌ Failed to upload profile picture: {uploadResponse.StatusCode} - {errorContent}");
                        StatusMessage = $"Error uploading profile picture: {errorContent}";
                    }
                }

                // ✅ STEP 2: Update profile information (FirstName, LastName, Email, PhoneNumber)
                // DO NOT include ProfilePictureUrl in this request - it's already saved by upload endpoint
                bool hasProfileChanges = Input.FirstName != null || Input.LastName != null;

                if (hasProfileChanges)
                {
                    // Get current email if not provided
                    if (string.IsNullOrEmpty(Input.Email))
                    {
                        var profileResponse = await _jwtHttpClient.GetAsync("api/Auth/profile");
                        if (profileResponse.IsSuccessStatusCode)
                        {
                            var profile = await profileResponse.Content.ReadFromJsonAsync<ProfileResponse>();
                            Input.Email = profile?.Data?.Email ?? "";
                        }
                    }

                    // ✅ DO NOT send ProfilePictureUrl - the upload endpoint already saved it
                    var updateRequest = new
                    {
                        FirstName = Input.FirstName?.Trim(),
                        LastName = Input.LastName?.Trim(),
                        Email = Input.Email?.Trim(),
                        PhoneNumber = Input.PhoneNumber?.Trim()
                        // ProfilePictureUrl is NOT included here - already saved by upload endpoint
                    };

                    _logger.LogInformation($"Updating profile via PUT /api/Auth/update-profile");

                    var response = await _jwtHttpClient.PutAsync(
                        "api/Auth/update-profile",
                        JsonContent.Create(updateRequest));

                    if (response.IsSuccessStatusCode)
                    {
                        profileUpdated = true;
                        _logger.LogInformation("✅ Profile updated successfully");
                    }
                    else
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError($"❌ Failed to update profile: {response.StatusCode} - {errorContent}");

                        try
                        {
                            var errorResponse = await JsonSerializer.DeserializeAsync<ErrorResponse>(
                                await response.Content.ReadAsStreamAsync());
                            StatusMessage = $"Error: {errorResponse?.Message ?? errorContent}";
                        }
                        catch
                        {
                            StatusMessage = $"Error: {errorContent}";
                        }
                    }
                }

                // ✅ STEP 3: Set success message
                if (profileUpdated && pictureUpdated)
                {
                    StatusMessage = "Your profile and picture have been updated successfully";
                }
                else if (profileUpdated)
                {
                    StatusMessage = "Your profile has been updated successfully";
                }
                else if (pictureUpdated)
                {
                    StatusMessage = "Your profile picture has been updated successfully";
                }

                // ✅ Reload profile data from API to get fresh data
                await LoadAsync();

                return RedirectToPage();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user profile");
                StatusMessage = "Error: An unexpected error occurred while updating your profile";
                await LoadAsync();
                return Page();
            }
        }
        public async Task<IActionResult> OnPostDeletePictureAsync()
        {
            try
            {
                if (_jwtSessionService.IsTokenExpired())
                {
                    return RedirectToPage("/Account/Login", new { area = "Identity", expired = true });
                }

                _logger.LogInformation("Deleting profile picture");

                var response = await _jwtHttpClient.DeleteAsync("api/Auth/delete-profile-picture");

                if (response.IsSuccessStatusCode)
                {
                    ProfilePictureUrl = null;
                    StatusMessage = "Profile picture deleted successfully";
                    _logger.LogInformation("✅ Profile picture deleted");
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"❌ Failed to delete profile picture: {response.StatusCode} - {errorContent}");
                    StatusMessage = $"Error: {errorContent}";
                }

                await LoadAsync();
                return RedirectToPage();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting profile picture");
                StatusMessage = "Error: An unexpected error occurred";
                return RedirectToPage();
            }
        }
    }

    public class ProfileResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public ProfileData Data { get; set; }
    }

    public class ProfileData
    {
        public string Id { get; set; }
        public string UserName { get; set; }
        public string Email { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string PhoneNumber { get; set; }
        public string ProfilePictureUrl { get; set; }
    }

    public class UploadProfilePictureResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
        public string ProfilePictureUrl { get; set; }
    }

    public class ErrorResponse
    {
        public string Status { get; set; }
        public string Message { get; set; }
    }
}