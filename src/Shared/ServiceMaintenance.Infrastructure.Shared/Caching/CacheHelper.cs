using Microsoft.Extensions.Logging;
using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace ServiceMaintenance.Infrastructure.Shared.Caching;

public class CacheHelper
{
    private readonly IRedisService _redis;
    private readonly ILogger<CacheHelper> _logger;

    // Cache stampede protection — one SemaphoreSlim(1,1) per key, created on
    // demand. Only ONE caller ever runs fetchFunc() for a given key at a time.
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _keyLocks = new();

    // ✅ CHANGED — default expiry raised from 5 minutes to 24 hours.
    // This app's caching strategy relies on explicit invalidation on every
    // Create/Update/Delete/StatusChange path (Cache.InvalidateAsync /
    // InvalidateManyAsync / InvalidateByPrefixAsync are already called at
    // every mutation site, plus SignalR broadcasts trigger invalidation on
    // other connected clients). A short TTL was only masking gaps in that
    // invalidation coverage while also forcing unnecessary DB round-trips
    // every few minutes even when nothing changed. With invalidation as the
    // primary freshness mechanism, TTL is now a long-lived safety net (in
    // case an invalidation call is ever missed or Redis briefly drops a key)
    // rather than the main mechanism — matching IdempotencyHelper's 24h.
    private static readonly TimeSpan DefaultExpiry = TimeSpan.FromHours(24);

    public CacheHelper(IRedisService redis, ILogger<CacheHelper> logger)
    {
        _redis = redis;
        _logger = logger;
    }

    // Explicitly Task<T?> — fetchFunc may return null (e.g. "no data for this
    // range"), and that null is intentionally NOT cached, since caching
    // "no data" the same way as "cache miss" would mask a real future value.
    public async Task<T?> GetOrSetAsync<T>(
        string key,
        Func<Task<T?>> fetchFunc,
        TimeSpan? expiry = null,
        CancellationToken ct = default) where T : class
    {
        // Fast path: no lock, covers the overwhelmingly common case (hit).
        var hit = await TryReadAsync<T>(key, ct);
        if (hit is not null)
            return hit;

        var keyLock = _keyLocks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
        await keyLock.WaitAsync(ct);
        try
        {
            // Double-checked: someone may have populated the cache while we
            // were waiting for the lock.
            hit = await TryReadAsync<T>(key, ct);
            if (hit is not null)
                return hit;

            _logger.LogDebug("📥 Cache MISS: {Key} — fetching...", key);
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var data = await fetchFunc();
            sw.Stop();
            _logger.LogDebug("✅ Fetched [{Key}] in {Ms}ms", key, sw.ElapsedMilliseconds);

            if (data is not null)
            {
                try
                {
                    await _redis.SetAsync(
                        key,
                        JsonSerializer.Serialize(data),
                        expiry ?? DefaultExpiry,   // ✅ CHANGED — was TimeSpan.FromMinutes(5)
                        ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("⚠️ Cache write failed [{Key}]: {Message}", key, ex.Message);
                }
            }
            else
            {
                _logger.LogDebug("ℹ️ fetchFunc returned null for [{Key}] — not caching", key);
            }

            return data;
        }
        finally
        {
            keyLock.Release();

            // Best-effort cleanup so _keyLocks doesn't grow forever for
            // one-off keys. CurrentCount == 1 means nobody else is waiting.
            if (keyLock.CurrentCount == 1)
                _keyLocks.TryRemove(key, out _);
        }
    }

    private async Task<T?> TryReadAsync<T>(string key, CancellationToken ct) where T : class
    {
        try
        {
            var cached = await _redis.GetAsync(key, ct);
            if (cached is not null)
            {
                _logger.LogDebug("✅ Cache HIT: {Key}", key);
                return JsonSerializer.Deserialize<T>(cached);
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("⚠️ Cache read failed [{Key}]: {Message}", key, ex.Message);
        }
        return null;
    }

    public async Task InvalidateAsync(string key, CancellationToken ct = default)
    {
        try
        {
            await _redis.DeleteAsync(key, ct);
            _logger.LogDebug("🗑️ Invalidated: {Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("⚠️ Invalidate failed [{Key}]: {Message}", key, ex.Message);
        }
    }

    public async Task InvalidateManyAsync(params string[] keys)
        => await InvalidateManyAsync(CancellationToken.None, keys);

    public async Task InvalidateManyAsync(CancellationToken ct, params string[] keys)
    {
        var tasks = keys.Select(k => InvalidateAsync(k, ct));
        await Task.WhenAll(tasks);
    }

    public async Task InvalidateByPrefixAsync(string prefix, CancellationToken ct = default)
    {
        try
        {
            await _redis.DeleteByPrefixAsync(prefix, ct);
            _logger.LogDebug("🗑️ Invalidated prefix: {Prefix}*", prefix);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("⚠️ Prefix invalidate failed [{Prefix}]: {Message}", prefix, ex.Message);
        }
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken ct = default)
    {
        try { return await _redis.ExistsAsync(key, ct); }
        catch { return false; }
    }
}