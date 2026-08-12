using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.JSInterop;
using ServiceMaintenance.Services.JWT;
using System.Security.Claims;

namespace ServiceMaintenance.Shared
{
    public partial class IbottomNavMenu
    {
        private ElementReference drawerElement;
        private bool showSettingsDrawer;
        private string drawerClass = "closed";

        [Inject] private NavigationManager NavigationManager { get; set; }
        [Inject] private UserService UserService { get; set; }
        [Inject] private IJSRuntime JSRuntime { get; set; }
        [Inject] private JwtHttpClientService JwtHttpClient { get; set; }

        private UserDto currentUser;
        private string currentUserId;
        private string userName;
        private string profilePictureUrl;

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

        protected override async Task OnAfterRenderAsync(bool firstRender)
        {
            if (firstRender)
            {
                await JSRuntime.InvokeVoidAsync("addClickDrawer", drawerElement);
            }
        }

        protected override async Task OnInitializedAsync()
        {
            try
            {
                Console.WriteLine("═══════════════════════════════════════");
                Console.WriteLine("🔧 BOTTOM NAV INITIALIZATION");
                Console.WriteLine("═══════════════════════════════════════");

                var authState = await AuthenticationStateProvider.GetAuthenticationStateAsync();
                var userClaims = authState.User;

                if (!userClaims.Identity.IsAuthenticated)
                {
                    Console.WriteLine("⚠️ User not authenticated");
                    return;
                }

                currentUserId = userClaims.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                Console.WriteLine($"✅ User authenticated: {currentUserId}");

                if (string.IsNullOrEmpty(currentUserId))
                {
                    Console.WriteLine("❌ No user ID found");
                    return;
                }

                // ✅ STEP 1: Load user details
                currentUser = await UserService.GetApplicationUserAsync(currentUserId);
                if (currentUser != null)
                {
                    userName = $"{currentUser.FirstName} {currentUser.LastName}".Trim();
                    if (string.IsNullOrEmpty(userName))
                    {
                        userName = currentUser.UserName ?? "Unknown User";
                    }
                    Console.WriteLine($"✅ User loaded: {userName}");
                }

                // ✅ STEP 2: Load profile picture
                await LoadProfilePictureAsync();

                Console.WriteLine("═══════════════════════════════════════");
                Console.WriteLine($"✅ BOTTOM NAV INITIALIZATION COMPLETE");
                Console.WriteLine($"   User: {userName}");
                Console.WriteLine($"   Profile Picture: {(string.IsNullOrEmpty(profilePictureUrl) ? "Not set" : "Loaded")}");
                Console.WriteLine("═══════════════════════════════════════");

                StateHasChanged();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error in OnInitializedAsync: {ex.Message}");
                Console.WriteLine($"   Stack: {ex.StackTrace}");
            }
        }

        private async Task LoadProfilePictureAsync()
        {
            try
            {
                Console.WriteLine($"📸 Loading profile picture for user: {currentUserId}");

                var response = await JwtHttpClient.GetAsync("api/Auth/profile");

                if (response.IsSuccessStatusCode)
                {
                    var profileResponse = await response.Content.ReadFromJsonAsync<ProfileResponse>();

                    if (profileResponse?.Status == "Success" && profileResponse.Data != null)
                    {
                        profilePictureUrl = profileResponse.Data.ProfilePictureUrl;

                        if (!string.IsNullOrEmpty(profilePictureUrl))
                        {
                            Console.WriteLine($"✅ Profile picture loaded: {profilePictureUrl}");
                        }
                        else
                        {
                            Console.WriteLine($"ℹ️ No profile picture set");
                            profilePictureUrl = "/images/avatar.jpg";
                        }

                        StateHasChanged();
                    }
                }
                else
                {
                    Console.WriteLine($"⚠️ Failed to load profile: {response.StatusCode}");
                    profilePictureUrl = "/images/avatar.jpg";
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error loading profile picture: {ex.Message}");
                profilePictureUrl = "/images/avatar.jpg";
            }
        }

        private void NavigateToHome()
        {
            NavigationManager.NavigateTo("/");
            CloseDrawer();
        }

        private void ToggleSettingsDrawer()
        {
            if (!showSettingsDrawer)
            {
                showSettingsDrawer = true;
                drawerClass = "open";
            }
            else
            {
                showSettingsDrawer = false;
                drawerClass = "closed";
            }

            StateHasChanged();
        }

        private void CloseDrawer()
        {
            drawerClass = "closed";
            showSettingsDrawer = false;
            StateHasChanged();
        }

        private void dr1()
        {
            NavigationManager.NavigateTo("/some-setting");
            CloseDrawer();
        }

        private void dr2()
        {
            NavigationManager.NavigateTo("/another-setting");
            CloseDrawer();
        }

        private void dr3()
        {
            NavigationManager.NavigateTo("/another-setting");
            CloseDrawer();
        }
    }
}