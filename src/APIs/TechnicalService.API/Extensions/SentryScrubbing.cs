using System.Text.RegularExpressions;

namespace TechnicalService.API.Extensions;

/// <summary>
/// Removes credentials and customer-identifying free text from Sentry events
/// before they leave the process.
///
/// The search endpoints take what staff typed into a search box as a query
/// parameter — customer names, phone numbers, serial numbers — and that string
/// ends up on the event's request URL. None of it helps diagnose a stack trace,
/// and shipping it to a third-party service is a data-protection decision that
/// should be made deliberately rather than inherited from a default.
/// </summary>
public static partial class SentryScrubbing
{
    /// <summary>Query parameters whose values are replaced wholesale.</summary>
    private static readonly string[] RedactedParams =
    [
        "searchTerm",
        "serialNumber",
        "companyNames",
        "q",
    ];

    /// <summary>Headers dropped from the event entirely.</summary>
    private static readonly string[] RedactedHeaders =
    [
        "Authorization",
        "Cookie",
        "Set-Cookie",
    ];

    /// <summary>
    /// Sentry's BeforeSend hook. Returning the event sends it; returning null
    /// would drop it.
    /// </summary>
    public static SentryEvent? Scrub(SentryEvent @event, SentryHint hint)
    {
        if (@event.Request is not null)
        {
            foreach (var header in RedactedHeaders)
            {
                @event.Request.Headers.Remove(header);
            }

            if (!string.IsNullOrEmpty(@event.Request.QueryString))
            {
                @event.Request.QueryString = RedactQueryString(@event.Request.QueryString);
            }

            if (!string.IsNullOrEmpty(@event.Request.Url))
            {
                @event.Request.Url = RedactUrl(@event.Request.Url);
            }
        }

        return @event;
    }

    private static string RedactUrl(string url)
    {
        var split = url.IndexOf('?');
        if (split < 0) return url;

        var query = RedactQueryString(url[(split + 1)..]);
        return string.Concat(url.AsSpan(0, split + 1), query);
    }

    private static string RedactQueryString(string queryString)
    {
        var trimmed = queryString.TrimStart('?');

        foreach (var param in RedactedParams)
        {
            // Matches "name=value" up to the next & or end of string, on either
            // side of an & boundary, case-insensitively (the frontend and
            // Swagger disagree on casing for some parameters).
            trimmed = Regex.Replace(
                trimmed,
                $@"(?<=^|&){Regex.Escape(param)}=[^&]*",
                $"{param}=[redacted]",
                RegexOptions.IgnoreCase);
        }

        return trimmed;
    }
}
