using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Threading;
using System.Threading.Tasks;
using UserManagementAPI.Data;

namespace UserManagementAPI.Services
{
    /// <summary>
    /// Background service that deletes long-expired refresh tokens. Runs daily
    /// at 2 AM server-local time.
    /// </summary>
    public class RefreshTokenCleanupService : BackgroundService
    {
        /// <summary>Tokens are kept this long after expiry, for audit.</summary>
        private static readonly TimeSpan RetentionAfterExpiry = TimeSpan.FromDays(7);

        /// <summary>Backoff before retrying after an unexpected failure.</summary>
        private static readonly TimeSpan RetryDelay = TimeSpan.FromHours(1);

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
            _logger.LogInformation("Refresh token cleanup service started.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Wait until the next 2 AM. Always adding a day here was a
                    // real bug: if this service starts between midnight and
                    // 2 AM, `now.Date.AddDays(1).AddHours(2)` skips TODAY's
                    // still-upcoming 2 AM and waits ~25 hours instead of ~1-2.
                    var now = DateTime.Now;
                    var next2AM = now.Date.AddHours(2);
                    if (next2AM <= now)
                    {
                        next2AM = next2AM.AddDays(1);
                    }

                    _logger.LogInformation(
                        "Next refresh token cleanup scheduled for {NextRun:yyyy-MM-dd HH:mm:ss}.", next2AM);

                    await Task.Delay(next2AM - now, stoppingToken);

                    await CleanupExpiredTokensAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    // Normal shutdown.
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in refresh token cleanup service; retrying in {Delay}.", RetryDelay);

                    // This retry delay used to sit in the catch block with no
                    // guard of its own. On shutdown during the wait it threw
                    // OperationCanceledException from INSIDE a catch clause,
                    // where the surrounding try could not catch it - and an
                    // unhandled exception out of a BackgroundService stops the
                    // host (BackgroundServiceExceptionBehavior.StopHost), so a
                    // clean shutdown reported a fatal error.
                    try
                    {
                        await Task.Delay(RetryDelay, stoppingToken);
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                }
            }

            _logger.LogInformation("Refresh token cleanup service stopping.");
        }

        private async Task CleanupExpiredTokensAsync(CancellationToken cancellationToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<UserManagementContext>();

            try
            {
                var cutoffDate = DateTime.UtcNow - RetentionAfterExpiry;

                // One DELETE statement. The previous version materialised every
                // matching row into memory just to hand them back to
                // RemoveRange, which then issued a delete per row.
                var deleted = await context.RefreshTokens
                    .Where(rt => rt.ExpiresAt < cutoffDate)
                    .ExecuteDeleteAsync(cancellationToken);

                if (deleted > 0)
                {
                    _logger.LogInformation("Deleted {Count} expired refresh token(s).", deleted);
                }
                else
                {
                    _logger.LogDebug("No expired refresh tokens to delete.");
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during refresh token cleanup.");
            }
        }
    }
}
