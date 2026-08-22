using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using TechnicalService.API.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Error + performance monitoring. Opt-in: with no DSN in configuration the SDK
// is never attached, so a clone without the Sentry project set up runs exactly
// as before instead of failing on a missing setting. Options live under the
// "Sentry" section of appsettings.json.
var sentryEnabled = !string.IsNullOrWhiteSpace(builder.Configuration["Sentry:Dsn"]);

if (sentryEnabled)
{
    builder.WebHost.UseSentry(options =>
    {
        options.Environment = builder.Environment.EnvironmentName;

        // Request bodies here are inspection records and customer details, and
        // the Authorization header is a live token. A stack trace plus the
        // route is what actually diagnoses a 500.
        options.SendDefaultPii = false;
        options.MaxRequestBodySize = Sentry.Extensibility.RequestSize.None;

        // Anything the app logs at Error or above becomes a Sentry issue, so
        // the existing ILogger calls in the command handlers report themselves
        // without being rewritten.
        options.MinimumEventLevel = LogLevel.Error;
        options.MinimumBreadcrumbLevel = LogLevel.Information;

        // Free text the user typed (customer names, serial numbers) rides in
        // the query string of every search; it is not needed to debug a crash.
        options.SetBeforeSend(SentryScrubbing.Scrub);
    });
}

// Add services to the container.
builder.AddApplicationServices();
builder.Services.AddProblemDetails();

// Maps a missing record to 404 before the generic 500 path sees it.
builder.Services.AddExceptionHandler<NotFoundExceptionHandler>();

// Maps a rejected request value (an unrecognised condition, service location or
// rental action in the body) to 400. Without it those threw out of the command
// handler as ArgumentException and were reported as server faults.
builder.Services.AddExceptionHandler<ValidationExceptionHandler>();

var withApiVersioning = builder.Services.AddApiVersioning();

builder.AddDefaultOpenApi(withApiVersioning);

var app = builder.Build();

// AddProblemDetails() only registers the writer — without this an unhandled
// exception left the client with a bare, bodyless 500 (and a stack trace in
// Development). Now every failure comes back as a consistent ProblemDetails
// document that the Next.js proxy can surface.
app.UseExceptionHandler();
app.UseStatusCodePages();

// Tags each Sentry event with the matched route template ("/api/technicalservices/search")
// instead of the raw URL, so issues group per endpoint rather than per ticket id.
// Gated on the same condition as the SDK itself: this middleware resolves
// Sentry services from DI, so adding it unconditionally fails startup on any
// deployment that has no DSN configured.
if (sentryEnabled)
{
    app.UseSentryTracing();
}

// Order matters: compression wraps the response body, so it goes first;
// rate limiting rejects before any handler work happens; output caching must
// sit after routing-independent middleware but before the endpoints it serves.
app.UseResponseCompression();
app.UseRateLimiter();
app.UseOutputCache();

app.UseAuthentication();
app.UseAuthorization();

// Liveness answers as soon as the process is up (used by container restarts);
// readiness additionally requires the database, so a load balancer stops
// sending traffic to an instance that has lost its connection.
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("live"),
});
app.MapHealthChecks("/health/ready");

// Live Memory & Process Telemetry endpoint for frontend real-time tracking
app.MapGet("/health/metrics", () =>
{
    var proc = System.Diagnostics.Process.GetCurrentProcess();
    return Results.Ok(new
    {
        service = "TechnicalService.API",
        workingSetMb = Math.Round(proc.WorkingSet64 / (1024.0 * 1024.0), 1),
        gcHeapMb = Math.Round(GC.GetTotalMemory(false) / (1024.0 * 1024.0), 1),
        threads = proc.Threads.Count
    });
});

var repairs = app.NewVersionedApi("Repairs");
repairs.MapRepairsApiV1();

// `UseAuthentication()`/`UseAuthorization()` above enforce nothing on their
// own. Authentication only *reads* a token if one is presented; authorization
// only acts where an endpoint asks for it. With no endpoint asking, every route
// here served anonymous callers even with `Jwt:Enabled` set to true — so the
// flag looked like a working security switch and turning it on would have
// changed no behaviour whatsoever. Verified against production on 2026-08-17: a
// GET to /api/technicalservices/search with no Authorization header returned
// 200 and the full ticket table. This is the half that makes the flag real.
//
// Applied to the whole versioned group rather than per endpoint, so a route
// added later is covered by default instead of by remembering to opt in. The
// health checks are mapped above and outside this group, so container probes
// and load balancers keep working anonymously.
//
// Still gated on the same flag, and still shipped OFF. Requiring a token is a
// breaking change for any caller that isn't sending one, so enabling it is a
// deployment decision that belongs with whoever can confirm the frontend's
// tokens carry the configured Issuer and Audience — see the `Jwt` section of
// appsettings.json.
if (app.Configuration.GetSection("Jwt").GetValue("Enabled", false))
{
    repairs.RequireAuthorization();
}

app.UseDefaultOpenApi();
app.Run();
