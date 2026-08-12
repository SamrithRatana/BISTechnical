using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.SignalR.Client;

namespace ServiceMaintenance.Services.RealTimeServices
{
    /// <summary>
    /// ✅ Scoped (per-Circuit) wrapper around ONE HubConnection to /itemHub.
    /// receive-item.razor, inspect-item.razor, inspection-list.razor all call
    /// GetConnectionAsync() and subscribe their OWN handlers via
    /// hubConnection.On<T>(...), which returns an IDisposable each page
    /// disposes independently — WITHOUT ever disposing the shared HubConnection.
    ///
    /// Because this is Scoped, Blazor Server guarantees DisposeAsync() runs
    /// exactly once when the Circuit ends, regardless of any individual
    /// page's own IAsyncDisposable bugs.
    /// </summary>
    public class ItemHubConnectionService : IAsyncDisposable
    {
        private readonly NavigationManager _navigationManager;
        private readonly ILogger<ItemHubConnectionService> _logger;
        private readonly SemaphoreSlim _initLock = new(1, 1);
        private HubConnection _hubConnection;
        private bool _disposed;

        public ItemHubConnectionService(
            NavigationManager navigationManager,
            ILogger<ItemHubConnectionService> logger)
        {
            _navigationManager = navigationManager;
            _logger = logger;
        }

        public async Task<HubConnection> GetConnectionAsync()
        {
            if (_hubConnection is { State: HubConnectionState.Connected })
                return _hubConnection;

            await _initLock.WaitAsync();
            try
            {
                if (_disposed)
                    throw new ObjectDisposedException(nameof(ItemHubConnectionService));

                if (_hubConnection == null)
                {
                    _hubConnection = new HubConnectionBuilder()
                        .WithUrl(_navigationManager.ToAbsoluteUri("/itemHub"))
                        .WithAutomaticReconnect(new[]
                        {
                            TimeSpan.Zero,
                            TimeSpan.FromSeconds(2),
                            TimeSpan.FromSeconds(5),
                            TimeSpan.FromSeconds(10),
                            TimeSpan.FromSeconds(30)
                        })
                        .Build();

                    _hubConnection.Reconnecting += error =>
                    {
                        _logger.LogWarning("⚠️ ItemHub reconnecting: {Message}", error?.Message);
                        return Task.CompletedTask;
                    };

                    _hubConnection.Reconnected += connectionId =>
                    {
                        _logger.LogInformation("✅ ItemHub reconnected: {ConnectionId}", connectionId);
                        return Task.CompletedTask;
                    };

                    _hubConnection.Closed += error =>
                    {
                        _logger.LogWarning("❌ ItemHub closed permanently: {Message}", error?.Message);
                        return Task.CompletedTask;
                    };
                }

                if (_hubConnection.State == HubConnectionState.Disconnected)
                {
                    await _hubConnection.StartAsync();
                    _logger.LogInformation("✅ ItemHub connected (circuit-shared connection)");
                }
            }
            finally
            {
                _initLock.Release();
            }

            return _hubConnection;
        }

        public async ValueTask DisposeAsync()
        {
            if (_disposed) return;
            _disposed = true;

            if (_hubConnection != null)
            {
                try
                {
                    await _hubConnection.DisposeAsync();
                    _logger.LogInformation("🧹 ItemHub connection disposed (circuit ended)");
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "⚠️ Error disposing ItemHub connection");
                }
            }

            _initLock.Dispose();
        }
    }
}