#nullable enable
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Logging;

namespace ServiceMaintenance.Services.RealTimeServices
{
    public class SignalRService : IAsyncDisposable
    {
        private HubConnection? _hubConnection;
        private readonly ILogger<SignalRService> _logger;
        private readonly NavigationManager _navigationManager;

        // ✅ ជំនួស Public multicast event ចាស់ដោយ List + Lock ដើម្បីធានា
        // Consumer ត្រូវប្រើ SubscribeNotification/SubscribeMessage ដែល Return
        // IDisposable មកវិញ — Dispose វានឹង Remove Handler ចេញពី List
        // ដោយស្វ័យប្រវត្តិ ជៀសវាង Component Leak ដូចមុន
        private readonly List<Func<string, string, string, string, Task>> _notificationHandlers = new();
        private readonly List<Func<string, string, string, string, string, int, Task>> _messageHandlers = new();
        private readonly object _handlerLock = new();

        public bool IsConnected => _hubConnection?.State == HubConnectionState.Connected;

        public SignalRService(ILogger<SignalRService> logger, NavigationManager navigationManager)
        {
            _logger = logger;
            _navigationManager = navigationManager;
        }

        public IDisposable SubscribeNotification(Func<string, string, string, string, Task> handler)
        {
            lock (_handlerLock) { _notificationHandlers.Add(handler); }
            return new Unsubscriber(() =>
            {
                lock (_handlerLock) { _notificationHandlers.Remove(handler); }
            });
        }

        public IDisposable SubscribeMessage(Func<string, string, string, string, string, int, Task> handler)
        {
            lock (_handlerLock) { _messageHandlers.Add(handler); }
            return new Unsubscriber(() =>
            {
                lock (_handlerLock) { _messageHandlers.Remove(handler); }
            });
        }

        private sealed class Unsubscriber : IDisposable
        {
            private readonly Action _unsubscribe;
            private bool _disposed;
            public Unsubscriber(Action unsubscribe) => _unsubscribe = unsubscribe;
            public void Dispose()
            {
                if (_disposed) return;
                _disposed = true;
                _unsubscribe();
            }
        }

        public async Task InitializeAsync(string hubUrl)
        {
            if (_hubConnection != null)
            {
                _logger.LogWarning("Hub connection already initialized");
                return;
            }

            try
            {
                _hubConnection = new HubConnectionBuilder()
                    .WithUrl(_navigationManager.ToAbsoluteUri(hubUrl), options =>
                    {
                        options.Transports = HttpTransportType.LongPolling |
                                           HttpTransportType.ServerSentEvents |
                                           HttpTransportType.WebSockets;
                        options.SkipNegotiation = false;
                    })
                    .WithAutomaticReconnect(new[]
                    {
                        TimeSpan.Zero,
                        TimeSpan.FromSeconds(2),
                        TimeSpan.FromSeconds(5),
                        TimeSpan.FromSeconds(10)
                    })
                    .ConfigureLogging(logging =>
                    {
                        logging.SetMinimumLevel(LogLevel.Information);
                    })
                    .Build();

                _hubConnection.Closed += OnConnectionClosed;
                _hubConnection.Reconnecting += OnReconnecting;
                _hubConnection.Reconnected += OnReconnected;

                _hubConnection.On<string, string, string, string>("sendToUser",
                    async (heading, content, username, profilePicture) =>
                    {
                        _logger.LogInformation("📨 Notification received from {User}", username);
                        List<Func<string, string, string, string, Task>> handlersSnapshot;
                        lock (_handlerLock) { handlersSnapshot = _notificationHandlers.ToList(); }
                        foreach (var handler in handlersSnapshot)
                        {
                            try { await handler(heading, content, username, profilePicture); }
                            catch (Exception ex) { _logger.LogError(ex, "Notification handler threw"); }
                        }
                    });

                _hubConnection.On<string, string, string, string, string, int>("ReceiveMessage",
                    async (user, message, timestamp, fileUrl, audioUrl, messageId) =>
                    {
                        _logger.LogInformation("💬 Message received from {User}", user);
                        List<Func<string, string, string, string, string, int, Task>> handlersSnapshot;
                        lock (_handlerLock) { handlersSnapshot = _messageHandlers.ToList(); }
                        foreach (var handler in handlersSnapshot)
                        {
                            try { await handler(user, message, timestamp, fileUrl, audioUrl, messageId); }
                            catch (Exception ex) { _logger.LogError(ex, "Message handler threw"); }
                        }
                    });

                await _hubConnection.StartAsync();
                _logger.LogInformation("✅ Connected to {HubUrl}. Connection ID: {ConnectionId}", hubUrl, _hubConnection.ConnectionId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to connect to {HubUrl}", hubUrl);
                throw;
            }
        }

        private async Task OnConnectionClosed(Exception? error)
        {
            _logger.LogWarning("❌ Connection closed: {Message}", error?.Message);
            await Task.Delay(Random.Shared.Next(0, 5) * 1000);

            try
            {
                if (_hubConnection != null)
                    await _hubConnection.StartAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to reconnect");
            }
        }

        private Task OnReconnecting(Exception? error)
        {
            _logger.LogWarning("🔄 Reconnecting: {Message}", error?.Message);
            return Task.CompletedTask;
        }

        private Task OnReconnected(string? connectionId)
        {
            _logger.LogInformation("✅ Reconnected. Connection ID: {ConnectionId}", connectionId);
            return Task.CompletedTask;
        }

        public async Task SendNotificationAsync(string heading, string content, string username, byte[] profilePicture)
        {
            if (_hubConnection?.State != HubConnectionState.Connected)
            {
                _logger.LogWarning("Cannot send notification - not connected");
                return;
            }

            try
            {
                await _hubConnection.SendAsync("SendNotification", heading, content, username, profilePicture);
                _logger.LogInformation("📤 Notification sent: {Heading}", heading);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to send notification");
            }
        }

        public async ValueTask DisposeAsync()
        {
            if (_hubConnection != null)
            {
                try { await _hubConnection.DisposeAsync(); }
                catch (Exception ex) { _logger.LogWarning(ex, "Error disposing hub connection"); }
                _hubConnection = null;
            }

            lock (_handlerLock)
            {
                _notificationHandlers.Clear();
                _messageHandlers.Clear();
            }
        }
    }
}