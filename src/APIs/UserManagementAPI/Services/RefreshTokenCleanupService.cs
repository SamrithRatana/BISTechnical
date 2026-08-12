using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using UserManagementAPI.Data;

namespace UserManagementAPI.Services
{
    /// <summary>
    /// ✅ Background service to clean up expired refresh tokens
    /// Runs daily at 2 AM
    /// </summary>
    public class RefreshTokenCleanupService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<RefreshTokenCleanupService> _logger;

        public RefreshTokenCleanupService(
            IServiceProvider serviceProvider,
            ILogger<RefreshTokenCleanupService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🧹 Refresh Token Cleanup Service started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Wait until 2 AM next day
                    var now = DateTime.Now;
                    var next2AM = now.Date.AddDays(1).AddHours(2);
                    var delay = next2AM - now;

                    _logger.LogInformation($"⏰ Next cleanup scheduled for: {next2AM:yyyy-MM-dd HH:mm:ss}");

                    await Task.Delay(delay, stoppingToken);

                    await CleanupExpiredTokensAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    _logger.LogInformation("Cleanup service stopping");
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Error in cleanup service");
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken); // Retry in 1 hour
                }
            }
        }

        private async Task CleanupExpiredTokensAsync(CancellationToken cancellationToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<UserManagementContext>();

            try
            {
                _logger.LogInformation("🧹 Starting refresh token cleanup...");

                // Delete tokens expired more than 7 days ago
                var cutoffDate = DateTime.UtcNow.AddDays(-7);

                var expiredTokens = await context.RefreshTokens
                    .Where(rt => rt.ExpiresAt < cutoffDate)
                    .ToListAsync(cancellationToken);

                if (expiredTokens.Any())
                {
                    context.RefreshTokens.RemoveRange(expiredTokens);
                    await context.SaveChangesAsync(cancellationToken);

                    _logger.LogInformation($"✅ Deleted {expiredTokens.Count} expired refresh tokens");
                }
                else
                {
                    _logger.LogInformation("No expired tokens to delete");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error during token cleanup");
            }
        }
    }
}