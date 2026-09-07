using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Cryptography;
using System.Text;
using UserManagementAPI.Data;
using UserManagementAPI.Models;
using UserManagementAPI.Services;

namespace UserManagementAPI.Hubs
{
    public class AuthNotificationHub : Hub
    {
        /// <summary>
        /// Which users currently have a CAM ID phone connected, by connection id.
        ///
        /// SignalR can send to a group whose membership is empty and report
        /// success, so "the row exists in UserFaceDevices" was being treated as
        /// "the phone will see this". It is not the same thing: a backgrounded
        /// app, a sleeping phone, a dropped Wi-Fi link - or an API restart, which
        /// severs every hub connection at once - all leave the desktop waiting on
        /// an approval nobody received. This registry is what lets
        /// <c>device/request-push</c> say so.
        ///
        /// Process-local, like the rest of this system's in-memory state; a
        /// multi-instance deployment needs a backplane here as well as for the
        /// hub itself.
        /// </summary>
        private static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> OnlineDevices = new();

        /// <summary>Whether <paramref name="userId"/> has at least one phone connected right now.</summary>
        public static bool IsUserPhoneOnline(string userId) =>
            !string.IsNullOrEmpty(userId)
            && OnlineDevices.TryGetValue(userId, out var connections)
            && !connections.IsEmpty;

        private static void TrackConnection(string userId, string connectionId) =>
            OnlineDevices.GetOrAdd(userId, _ => new ConcurrentDictionary<string, byte>())[connectionId] = 1;

        private static void UntrackConnection(string connectionId)
        {
            foreach (var (userId, connections) in OnlineDevices)
            {
                if (connections.TryRemove(connectionId, out _) && connections.IsEmpty)
                {
                    // Racy by nature: a reconnect may re-add between the emptiness
                    // check and the removal, so remove only if still empty.
                    OnlineDevices.TryRemove(KeyValuePair.Create(userId, connections));
                }
            }
        }

        public override Task OnDisconnectedAsync(Exception? exception)
        {
            UntrackConnection(Context.ConnectionId);
            return base.OnDisconnectedAsync(exception);
        }

        private readonly UserManagementContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<AuthNotificationHub> _logger;
        private readonly IMemoryCache _cache;

        public AuthNotificationHub(
            UserManagementContext context,
            UserManager<ApplicationUser> userManager,
            ILogger<AuthNotificationHub> logger,
            IMemoryCache cache)
        {
            _context = context;
            _userManager = userManager;
            _logger = logger;
            _cache = cache;
        }

        /// <summary>
        /// Desktop PC connects and registers its pending login session ID.
        /// </summary>
        public async Task RegisterDesktopSession(string sessionId)
        {
            if (string.IsNullOrWhiteSpace(sessionId)) return;
            await Groups.AddToGroupAsync(Context.ConnectionId, $"session_{sessionId}");
            _logger.LogInformation("Desktop connected to session group: session_{SessionId}", sessionId);
        }

        /// <summary>
        /// CAM ID mobile app connects and registers with its paired device token.
        /// </summary>
        public async Task RegisterDevice(string deviceToken)
        {
            if (string.IsNullOrWhiteSpace(deviceToken)) return;

            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(deviceToken));
            var device = await _context.UserFaceDevices
                .FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);

            if (device != null)
            {
                device.LastUsedAt = DateTime.UtcNow;
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Device LastUsedAt update notice: {Message}", ex.Message);
                }

                var hex = Convert.ToHexString(hash);
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{device.UserId}");
                await Groups.AddToGroupAsync(Context.ConnectionId, $"device_{hex}");
                TrackConnection(device.UserId, Context.ConnectionId);
                _logger.LogInformation("CAM ID Mobile registered for user: {UserId}, device: {DeviceId}", device.UserId, device.Id);
                
                var user = await _userManager.FindByIdAsync(device.UserId);
                var roles = user != null ? await _userManager.GetRolesAsync(user) : new List<string>();

                await Clients.Caller.SendAsync("DeviceRegistered", new
                {
                    IsSuccess = true,
                    UserId = device.UserId,
                    UserName = user?.UserName ?? "User",
                    FullName = $"{user?.FirstName} {user?.LastName}".Trim(),
                    Email = user?.Email ?? "",
                    PhoneNumber = user?.PhoneNumber ?? "",
                    ProfilePictureUrl = user?.ProfilePictureUrl ?? "",
                    CoverUrl = user?.CoverUrl ?? "",
                    Roles = roles,
                    DeviceName = device.DeviceName
                });
            }
            else
            {
                _logger.LogWarning("CAM ID registration rejected: Device token not paired or revoked in security.UserFaceDevices.");
                await Clients.Caller.SendAsync("DeviceRegistered", new
                {
                    IsSuccess = false,
                    Message = "This device is not paired. Please pair this phone in Settings."
                });
            }
        }

        /// <summary>
        /// Desktop triggers a push notification to the user's paired CAM ID mobile apps.
        /// </summary>
        public async Task RequestMobileApproval(string userId, string sessionId, string clientName, string ipAddress)
        {
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(sessionId)) return;

            _logger.LogInformation("Sending Mobile Auth Request to user_{UserId} for session_{SessionId}", userId, sessionId);

            // Bind session -> user so the verified approval endpoint can refuse a
            // device answering a challenge that was never meant for its user.
            _cache.Set(AuthSessionRegistry.Key(sessionId), userId, AuthSessionRegistry.Lifetime);

            await Clients.Group($"user_{userId}").SendAsync("ReceiveAuthRequest", new
            {
                SessionId = sessionId,
                ClientName = clientName ?? "Desktop PC",
                IpAddress = ipAddress ?? "Unknown",
                Timestamp = DateTime.UtcNow
            });
        }

        /// <summary>
        /// CAM ID mobile app answers the login request.
        ///
        /// APPROVAL IS NO LONGER POSSIBLE HERE, and the reason is worth stating
        /// plainly: this hub method is callable by ANY connected client with
        /// nothing but a sessionId, and it used to answer by minting a full admin
        /// session - the phone's face detection and biometric gates were entirely
        /// client-side theatre in front of an unauthenticated token vending
        /// machine. Approvals now go through
        /// <c>POST api/auth/face/device/approve-session</c>, where the server
        /// itself verifies the paired device token, the session binding, AND the
        /// caller's face (ArcFace, embedded server-side) before any token exists.
        ///
        /// Denial stays available with a session binding check only: refusing a
        /// sign-in must never be gated behind a face check that could fail.
        /// </summary>
        public async Task RespondToAuthRequest(string sessionId, bool approved, string? authPayload)
        {
            if (string.IsNullOrWhiteSpace(sessionId)) return;

            _logger.LogInformation("Mobile responded to session_{SessionId}: approved = {Approved}", sessionId, approved);

            if (approved)
            {
                _logger.LogWarning(
                    "Unverified hub approval for session_{SessionId} REFUSED. Approvals require api/auth/face/device/approve-session (server-side face verification).",
                    sessionId);

                await Clients.Caller.SendAsync("AuthResponseRejected", new
                {
                    SessionId = sessionId,
                    Message = "This app version cannot approve sign-ins. Update CAM ID: approvals now require server-verified face recognition.",
                    Timestamp = DateTime.UtcNow
                });
                return;
            }

            await Clients.Group($"session_{sessionId}").SendAsync("AuthDenied", new
            {
                SessionId = sessionId,
                Timestamp = DateTime.UtcNow
            });

            _cache.Remove(AuthSessionRegistry.Key(sessionId));

            await ForwardToNextJsAsync(new { sessionId, approved = false });
        }

        private async Task ForwardToNextJsAsync(object payload)
        {
            try
            {
                var handler = new HttpClientHandler
                {
                    ServerCertificateCustomValidationCallback = (req, cert, chain, errors) => true
                };
                using var http = new HttpClient(handler);
                var content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json"
                );

                var urls = new[] { "http://localhost:3000/api/auth/face-link/push-approve", "https://localhost:3000/api/auth/face-link/push-approve" };
                foreach (var url in urls)
                {
                    try
                    {
                        var res = await http.PostAsync(url, content);
                        if (res.IsSuccessStatusCode) break;
                    }
                    catch
                    {
                        // Try next endpoint
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Forwarding push result to Next.js notice: {Message}", ex.Message);
            }
        }
    }
}
