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

var repairs = app.NewVersionedApi("Repairs");
repairs.MapRepairsApiV1();

app.UseDefaultOpenApi();
app.Run();
