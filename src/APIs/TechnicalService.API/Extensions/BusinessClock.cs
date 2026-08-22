namespace TechnicalService.API.Extensions;

/// <summary>
/// The workshop's local wall-clock time.
/// </summary>
/// <remarks>
/// Status transitions are stamped with the time the work happened in the
/// workshop, not UTC: the queues, the day filters and the printed reports are
/// all read in local terms. This was previously written as a bare
/// <c>DateTime.UtcNow.AddHours(7)</c> at thirteen separate call sites, which is
/// the same class of bug already fixed in the AI search route (a UTC "today"
/// naming yesterday for the first seven hours of every local day).
///
/// One helper means the offset is stated once and can be corrected or made
/// configurable in one place. It resolves the real IANA/Windows zone where the
/// host knows it, and falls back to the fixed +07:00 that the call sites
/// previously hardcoded when the zone database has neither id - Cambodia has
/// never observed daylight saving, so the fallback and the zone agree.
/// </remarks>
public static class BusinessClock
{
    private static readonly TimeSpan FallbackOffset = TimeSpan.FromHours(7);

    private static readonly TimeZoneInfo BusinessZone = ResolveZone();

    /// <summary>Current local time in the workshop's timezone.</summary>
    public static DateTime Now =>
        BusinessZone is null
            ? DateTime.UtcNow.Add(FallbackOffset)
            : TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, BusinessZone);

    /// <summary>Today's date in the workshop's timezone, at midnight.</summary>
    public static DateTime Today => Now.Date;

    private static TimeZoneInfo ResolveZone()
    {
        // "Asia/Phnom_Penh" is the IANA id (Linux containers); "SE Asia
        // Standard Time" is the Windows id for the same zone.
        foreach (var id in new[] { "Asia/Phnom_Penh", "SE Asia Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
                // Try the next id.
            }
            catch (InvalidTimeZoneException)
            {
                // Corrupt entry in the zone database; try the next id.
            }
        }

        return null;
    }
}
