using System;
using System.Diagnostics;
using System.Runtime;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace UserManagementAPI.Services;

/// <summary>
/// High-performance cross-platform memory cleaner for UserManagementAPI.
/// Compacts .NET Large Object Heap (LOH), collects Gen0-2, and releases unmapped
/// pages back to the Linux kernel via glibc malloc_trim(0) or Windows EmptyWorkingSet.
/// </summary>
public static class MemoryCleaner
{
    [DllImport("libc", EntryPoint = "malloc_trim", SetLastError = true)]
    private static extern int MallocTrim(nuint pad);

    [DllImport("psapi.dll", SetLastError = true)]
    private static extern bool EmptyWorkingSet(IntPtr hProcess);

    public static (double beforeMb, double afterMb, double savedMb, double gcHeapMb) CleanMemory()
    {
        double beforeMb = 0;
        try
        {
            using var proc = Process.GetCurrentProcess();
            beforeMb = Math.Round(proc.WorkingSet64 / (1024.0 * 1024.0), 1);
        }
        catch { }

        try
        {
            // 1. Force LOH compaction on the next collection
            GCSettings.LargeObjectHeapCompactionMode = GCLargeObjectHeapCompactionMode.CompactOnce;

            // 2. Perform full Gen0, Gen1, Gen2 collection with heap compaction
            GC.Collect(2, GCCollectionMode.Aggressive, blocking: true, compacting: true);
            GC.WaitForPendingFinalizers();
            GC.Collect(2, GCCollectionMode.Aggressive, blocking: true, compacting: true);

            // 3. Return unallocated heap arenas back to OS kernel
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                try
                {
                    MallocTrim(0);
                }
                catch { }
            }
            else if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                try
                {
                    using var proc = Process.GetCurrentProcess();
                    EmptyWorkingSet(proc.Handle);
                }
                catch { }
            }
        }
        catch
        {
            // Best-effort safety: never throw out of memory cleanup
        }

        double afterMb = 0;
        double gcHeapMb = 0;
        try
        {
            using var proc = Process.GetCurrentProcess();
            afterMb = Math.Round(proc.WorkingSet64 / (1024.0 * 1024.0), 1);
            gcHeapMb = Math.Round(GC.GetTotalMemory(false) / (1024.0 * 1024.0), 1);
        }
        catch { }

        var savedMb = Math.Max(0, Math.Round(beforeMb - afterMb, 1));
        return (beforeMb, afterMb, savedMb, gcHeapMb);
    }
}

/// <summary>
/// Autonomous background service that performs scheduled and adaptive memory maintenance for UserManagementAPI.
/// Ensures containers self-regulate and never require manual restarts.
/// </summary>
public sealed class MemoryMaintenanceHostedService : BackgroundService
{
    private readonly ILogger<MemoryMaintenanceHostedService> _logger;
    private static readonly TimeSpan DefaultInterval = TimeSpan.FromMinutes(15);
    private const double MemoryPressureCeilingMb = 350.0;

    public MemoryMaintenanceHostedService(ILogger<MemoryMaintenanceHostedService> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Automatic Memory Maintenance Service initialized for UserManagementAPI (Default Interval: {Interval}m).", DefaultInterval.TotalMinutes);

        // Initial warm-up delay before first cleanup cycle (2 minutes after startup)
        await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var (beforeMb, afterMb, savedMb, gcHeapMb) = MemoryCleaner.CleanMemory();
                if (savedMb > 5.0)
                {
                    _logger.LogInformation(
                        "[UserMemoryMaintenance] Automatic memory purge completed. WorkingSet: {BeforeMb}MB -> {AfterMb}MB (Saved: {SavedMb}MB, GC Heap: {GcHeapMb}MB).",
                        beforeMb, afterMb, savedMb, gcHeapMb);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[UserMemoryMaintenance] Error occurred during memory cleanup cycle.");
            }

            try
            {
                // Dynamic delay: if memory exceeds pressure ceiling, clean sooner (5 mins)
                double currentMb = 0;
                try
                {
                    using var proc = Process.GetCurrentProcess();
                    currentMb = proc.WorkingSet64 / (1024.0 * 1024.0);
                }
                catch { }

                var nextDelay = currentMb > MemoryPressureCeilingMb ? TimeSpan.FromMinutes(5) : DefaultInterval;
                await Task.Delay(nextDelay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }

        _logger.LogInformation("Automatic Memory Maintenance Service shutting down.");
    }
}
