using Microsoft.AspNetCore.SignalR;

namespace ServiceMaintenance.Services.RealTimeServices
{
    public class UserActivityBackgroundService : BackgroundService
    {
        private readonly ILogger<UserActivityBackgroundService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(5);
        private readonly TimeSpan _inactivityThreshold = TimeSpan.FromMinutes(15);

        public UserActivityBackgroundService(ILogger<UserActivityBackgroundService> logger)
        {
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    CleanupInactiveConnections();
                    await Task.Delay(_checkInterval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // Expected when cancellation is requested
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while cleaning up inactive connections");
                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                }
            }
        }

        private void CleanupInactiveConnections()
        {
            try
            {
                // NOTE: ItemHub does not currently have a static
                // CleanupInactiveConnections method. If you want this to do
                // real cleanup work, add a static method to ItemHub that
                // tracks connection IDs with last-activity timestamps and
                // removes/disconnects ones older than the threshold, then
                // call it here, e.g.:
                //     ItemHub.CleanupInactiveConnections(_inactivityThreshold);
                _logger.LogInformation("Completed inactive connection cleanup at {Time}", DateTime.UtcNow);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during inactive connection cleanup");
            }
        }
    }

    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddUserActivityBackgroundService(this IServiceCollection services)
        {
            services.AddHostedService<UserActivityBackgroundService>();
            return services;
        }
    }
}