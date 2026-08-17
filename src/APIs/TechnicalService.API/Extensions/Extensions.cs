using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using TechnicalService.API.Application.Queries;
using TechnicalService.API.Extensions;
using TechnicalService.API.Infrastructure;
using TechnicalService.Domain.AggregatesModel.RentalAggregate;
using TechnicalService.Domain.AggregatesModel.TechnicalAggregate;

internal static class Extensions
{
    /// <summary>
    /// Output-cache policy name for the seeded lookup tables (service types,
    /// priorities, statuses). They change only when a migration reseeds them,
    /// but every page load asks for them.
    /// </summary>
    public const string LookupCachePolicy = "lookups";

    /// <summary>Output-cache policy for the dashboard stat tiles.</summary>
    public const string DashboardCachePolicy = "dashboard";

    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        var services = builder.Services;

        // The database lives on a remote host (see ConnectionStrings), so every
        // query crosses the public internet. EnableRetryOnFailure rides out the
        // transient drops that come with that instead of surfacing them to the
        // user as a 500, and an explicit command timeout stops one pathological
        // query from pinning a request thread until the default 30s elapses.
        builder.Services.AddDbContext<TechnicalServiceContext>(options =>
            options.UseSqlServer(
                builder.Configuration.GetConnectionString("TechnicalServiceConnectionString"),
                sql =>
                {
                    sql.EnableRetryOnFailure(
                        maxRetryCount: 3,
                        maxRetryDelay: TimeSpan.FromSeconds(5),
                        errorNumbersToAdd: null);
                    sql.CommandTimeout(30);
                }));

        services.AddMigration<TechnicalServiceContext, TechnicalServiceContextSeed>();
        services.AddHttpContextAccessor();

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblyContaining(typeof(Program));
        });

        services.AddScoped<ITechnicalServiceQueries, TechnicalServiceQueries>();
        services.AddScoped<ITechnicalServiceRepository, TechnicalServiceRepository>();
        services.AddScoped<IRentalServiceRepository, RentalServiceRepository>();

        services.AddApiSecurity(builder.Configuration);
        services.AddApiPerformance();

        // Readiness for a load balancer / container orchestrator. "live" answers
        // as long as the process is up; the default (unfiltered) set also checks
        // that the database is actually reachable.
        services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
            .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);
    }

    /// <summary>
    /// JWT bearer validation + a request rate limit.
    ///
    /// Authentication is opt-in via <c>Jwt:Enabled</c> so that turning it on is
    /// a deliberate deployment step: the endpoints have always been anonymous,
    /// and flipping every one of them to 401 without the matching frontend
    /// configuration would take the whole app down. Set <c>Jwt:Enabled</c> to
    /// true (and fill in Key/Issuer/Audience) to enforce it.
    ///
    /// This half only registers the scheme, and registering a scheme protects
    /// nothing: authentication reads a token when one is presented, it does not
    /// demand one. The demand is <c>RequireAuthorization()</c> on the endpoint
    /// group in <c>Program.cs</c>, gated on this same flag — which was missing
    /// entirely until 2026-08-17, so this switch read as a working security
    /// control while enabling it would have changed nothing. If you are adding
    /// a new endpoint group, it needs that call too, or it is public.
    /// </summary>
    private static void AddApiSecurity(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection("Jwt");

        if (jwt.GetValue("Enabled", false))
        {
            var key = jwt.GetRequiredValue("Key");

            services
                .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = jwt.GetRequiredValue("Issuer"),
                        ValidAudience = jwt.GetRequiredValue("Audience"),
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                        // The token is minted by the User Management API on
                        // another host; without this the two clocks have to
                        // agree to the second.
                        ClockSkew = TimeSpan.FromMinutes(2),
                    };
                });

            services.AddAuthorization();
        }
        else
        {
            // Register the authentication/authorization services with no scheme
            // so `UseAuthentication()`/`UseAuthorization()` in the pipeline can
            // still resolve their dependencies. With no scheme registered and no
            // endpoint requiring authorization, both are pass-throughs — the API
            // keeps accepting anonymous calls exactly as before.
            services.AddAuthentication();
            services.AddAuthorization();
        }

        // A single misbehaving client (or a runaway retry loop in the UI) should
        // not be able to saturate the remote database. 300 requests/minute per
        // client is far above what a human working the queues generates.
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 300,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                    }));
        });
    }

    /// <summary>
    /// Response compression and output caching.
    /// </summary>
    private static void AddApiPerformance(this IServiceCollection services)
    {
        // Ticket list rows carry ~40 mostly-textual fields each, so a page of
        // them compresses to a fraction of its size — the win is largest for
        // exactly the payloads the UI fetches most.
        services.AddResponseCompression(options =>
        {
            // The API sits behind the Next.js proxy over plain HTTP inside the
            // deployment, and the JSON it returns carries no user-supplied
            // secrets in the same response as attacker-controlled input, so the
            // BREACH conditions that make HTTPS compression risky do not apply.
            options.EnableForHttps = true;
            options.Providers.Add<BrotliCompressionProvider>();
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/json"]);
        });

        services.Configure<BrotliCompressionProviderOptions>(o =>
            o.Level = System.IO.Compression.CompressionLevel.Fastest);
        services.Configure<GzipCompressionProviderOptions>(o =>
            o.Level = System.IO.Compression.CompressionLevel.Fastest);

        services.AddOutputCache(options =>
        {
            options.AddPolicy(LookupCachePolicy, policy => policy
                .Expire(TimeSpan.FromMinutes(30))
                .SetVaryByQuery("api-version"));

            options.AddPolicy(DashboardCachePolicy, policy => policy
                .Expire(TimeSpan.FromSeconds(60))
                .SetVaryByQuery("api-version"));
        });
    }
}

/// <summary>
/// Reports whether the SQL Server behind <see cref="TechnicalServiceContext"/>
/// is reachable. Used by the <c>/health/ready</c> probe.
/// </summary>
internal sealed class DatabaseHealthCheck(TechnicalServiceContext context) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context_,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await context.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Cannot connect to TechnicalServiceDB.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("TechnicalServiceDB check threw.", ex);
        }
    }
}
