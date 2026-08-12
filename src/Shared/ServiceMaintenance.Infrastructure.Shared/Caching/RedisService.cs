using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ServiceMaintenance.Infrastructure.Shared.Caching;



public interface IRedisService
{
    Task SetAsync(string key, string value, TimeSpan? expiry = null, CancellationToken ct = default);

    // ✅ NEW — atomic "SET key value NX EX ttl". Returns true only if the key
    // did NOT already exist (i.e. this call is the one that set it). Used by
    // IdempotencyHelper.TryClaimAsync() to close the check-then-set race that
    // IsAlreadyProcessedAsync() + MarkAsProcessedAsync() has as two separate
    // round-trips.
    Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan? expiry = null, CancellationToken ct = default);

    Task<string?> GetAsync(string key, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);
    Task DeleteByPrefixAsync(string prefix, CancellationToken ct = default);
    Task<bool> ExistsAsync(string key, CancellationToken ct = default);
    Task<bool> IsHealthyAsync(CancellationToken ct = default);
}

public class RedisService : IRedisService, IAsyncDisposable, IDisposable
{
    private readonly IConfiguration _config;
    private readonly ILogger<RedisService> _logger;

    // Lazy<Task<T>> — connection only happens on first real use, awaited (not
    // .Result'd), and guaranteed to run once even under concurrent first callers.
    private readonly Lazy<Task<IConnectionMultiplexer>> _multiplexerLazy;

    public RedisService(IConfiguration config, ILogger<RedisService> logger)
    {
        _config = config;
        _logger = logger;
        _multiplexerLazy = new Lazy<Task<IConnectionMultiplexer>>(CreateConnectionAsync);
    }

    private async Task<IConnectionMultiplexer> CreateConnectionAsync()
    {
        var connectionString = _config["Redis:ConnectionString"]
            ?? throw new InvalidOperationException("Redis:ConnectionString is missing in appsettings.json");

        var options = ConfigurationOptions.Parse(connectionString);
        options.AbortOnConnectFail = false;
        options.ConnectRetry = 3;
        options.ConnectTimeout = 2000;
        options.SyncTimeout = 2000;
        options.AsyncTimeout = 2000;
        options.ReconnectRetryPolicy = new LinearRetry(2000);

        var multiplexer = await ConnectionMultiplexer.ConnectAsync(options);

        multiplexer.ConnectionFailed += (_, e) =>
            _logger.LogWarning("⚠️ Redis connection failed: {EndPoint} — {FailureType}", e.EndPoint, e.FailureType);
        multiplexer.ConnectionRestored += (_, e) =>
            _logger.LogInformation("✅ Redis connection restored: {EndPoint}", e.EndPoint);

        _logger.LogInformation("✅ Redis initialized: {Host}", options.EndPoints.FirstOrDefault());
        return multiplexer;
    }

    private async Task<IDatabase?> TryGetDatabaseAsync()
    {
        try
        {
            var multiplexer = await _multiplexerLazy.Value;
            return multiplexer.IsConnected ? multiplexer.GetDatabase() : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("⚠️ Redis connection unavailable: {Message}", ex.Message);
            return null;
        }
    }

    public async Task SetAsync(string key, string value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        var db = await TryGetDatabaseAsync();
        if (db is null)
        {
            _logger.LogDebug("⏭️ Redis not connected — skipping SET [{Key}]", key);
            return;
        }
        try
        {
            ct.ThrowIfCancellationRequested();
            if (expiry.HasValue)
                await db.StringSetAsync(key, value, expiry.Value);
            else
                await db.StringSetAsync(key, value);
        }
        catch (OperationCanceledException)
        {
            _logger.LogDebug("⏹️ SET cancelled [{Key}]", key);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("⚠️ SET failed [{Key}]: {Message}", key, ex.Message);
        }
    }

    // ✅ NEW — atomic SET ... NX EX ttl in a single Redis round-trip.
    // StackExchange.Redis exposes this via the `When` parameter on
    // StringSetAsync: When.NotExists means "only set if the key is absent",
    // and the return value tells us whether the SET actually happened.
    // Failure/disconnection is treated as "claim granted" (fail-open) so a
    // Redis outage never permanently blocks message processing — matching
    // the fail-open behavior already used elsewhere in this class (Get/Exists).
    public async Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        var db = await TryGetDatabaseAsync();
        if (db is null)
        {
            _logger.LogDebug("⏭️ Redis not connected — skipping SETNX [{Key}] (treating as claimed)", key);
            return true;
        }
        try
        {
            ct.ThrowIfCancellationRequested();
            bool wasSet = await db.StringSetAsync(key, value, expiry, When.NotExists);
            return wasSet;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("⚠️ SETNX failed [{Key}]: {Message} — treating as claimed", key, ex.Message);
            return true;
        }
    }

    public async Task<string?> GetAsync(string key, CancellationToken ct = default)
    {
        var db = await TryGetDatabaseAsync();
        if (db is null)
        {
            _logger.LogDebug("⏭️ Redis not connected — skipping GET [{Key}]", key);
            return null;
        }
        try
        {
            ct.ThrowIfCancellationRequested();
            var value = await db.StringGetAsync(key);
            return value.HasValue ? value.ToString() : null;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("⚠️ GET failed [{Key}]: {Message}", key, ex.Message);
            return null;
        }
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        var db = await TryGetDatabaseAsync();
        if (db is null) return;
        try
        {
            ct.ThrowIfCancellationRequested();
            await db.KeyDeleteAsync(key);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("⚠️ DELETE failed [{Key}]: {Message}", key, ex.Message);
        }
    }

    public async Task DeleteByPrefixAsync(string prefix, CancellationToken ct = default)
    {
        IConnectionMultiplexer multiplexer;
        try
        {
            multiplexer = await _multiplexerLazy.Value;
            if (!multiplexer.IsConnected)
            {
                _logger.LogDebug("⏭️ Redis not connected — skipping prefix delete [{Prefix}]", prefix);
                return;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("⚠️ Redis connection unavailable: {Message}", ex.Message);
            return;
        }

        var pattern = $"{prefix}*";
        const int scanPageSize = 250;
        const int deleteBatchSize = 500;
        var db = multiplexer.GetDatabase();
        int totalDeleted = 0;

        try
        {
            var masters = multiplexer.GetEndPoints()
                .Select(ep => multiplexer.GetServer(ep))
                .Where(s => !s.IsReplica)
                .ToList();

            foreach (var server in masters)
            {
                ct.ThrowIfCancellationRequested();
                var batch = new List<RedisKey>(deleteBatchSize);

                await foreach (var key in server.KeysAsync(pattern: pattern, pageSize: scanPageSize).WithCancellation(ct))
                {
                    batch.Add(key);
                    if (batch.Count >= deleteBatchSize)
                    {
                        totalDeleted += (int)await db.KeyDeleteAsync(batch.ToArray());
                        batch.Clear();
                    }
                }
                if (batch.Count > 0)
                    totalDeleted += (int)await db.KeyDeleteAsync(batch.ToArray());
            }
            _logger.LogDebug("🗑️ Deleted {Count} keys with prefix: {Prefix}", totalDeleted, prefix);
        }
        catch (OperationCanceledException)
        {
            _logger.LogDebug("⏹️ Prefix delete cancelled [{Prefix}] after {Count} keys", prefix, totalDeleted);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("⚠️ Prefix delete failed [{Prefix}]: {Message}", prefix, ex.Message);
        }
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken ct = default)
    {
        var db = await TryGetDatabaseAsync();
        if (db is null) return false;
        try
        {
            ct.ThrowIfCancellationRequested();
            return await db.KeyExistsAsync(key);
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> IsHealthyAsync(CancellationToken ct = default)
    {
        var db = await TryGetDatabaseAsync();
        if (db is null) return false;
        try
        {
            ct.ThrowIfCancellationRequested();
            await db.PingAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_multiplexerLazy.IsValueCreated)
        {
            var multiplexer = await _multiplexerLazy.Value;
            await multiplexer.CloseAsync();
            multiplexer.Dispose();
        }
    }

    public void Dispose()
    {
        if (_multiplexerLazy.IsValueCreated)
            _multiplexerLazy.Value.GetAwaiter().GetResult().Dispose();
    }
}
