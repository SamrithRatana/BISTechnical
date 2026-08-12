using Microsoft.AspNetCore.SignalR;

namespace ServiceMaintenance.Services.RealTimeServices
{
    public class NotificationHub : Hub
    {
        // Called by other services via IHubContext<NotificationHub> to push notifications, e.g.:
        // await _hubContext.Clients.All.SendAsync("ReceiveNotification", message, profilePictureBase64, username);
        //
        // Add server-side methods here if clients need to invoke the hub directly
        // (e.g. marking a notification as read). For now this is just a pass-through
        // hub since chat.js only listens for "ReceiveNotification".
    }
}