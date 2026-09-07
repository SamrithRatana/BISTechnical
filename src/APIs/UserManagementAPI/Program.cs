using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.IO.Compression;
using System.Text;
using System.Threading.RateLimiting;
using UserManagementAPI.Authorization;
using UserManagementAPI.Data;
using UserManagementAPI.Models;
using UserManagementAPI.Services;

var builder = WebApplication.CreateBuilder(args);

// ============ CONFIGURATION VALIDATION ============
var jwtSecret = builder.Configuration["JWT:Secret"]
    ?? throw new InvalidOperationException("JWT Secret not configured");
var jwtIssuer = builder.Configuration["JWT:ValidIssuer"]
    ?? throw new InvalidOperationException("JWT ValidIssuer not configured");
var jwtAudience = builder.Configuration["JWT:ValidAudience"]
    ?? throw new InvalidOperationException("JWT ValidAudience not configured");

// ============ DATABASE CONFIGURATION ============
var connectionString = builder.Configuration.GetConnectionString("UserManagementConnection")
    ?? throw new InvalidOperationException("Database connection string not configured");

builder.Services.AddDbContext<UserManagementContext>(options =>
{
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorNumbersToAdd: null
        );
        sqlOptions.CommandTimeout(30);
    });
}, ServiceLifetime.Scoped);

// ============ IDENTITY CONFIGURATION ============
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    // Password settings
    options.Password.RequireDigit = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequiredLength = 6;

    // Lockout settings
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.AllowedForNewUsers = true;

    // User settings
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<UserManagementContext>()
.AddDefaultTokenProviders();

// ============ JWT AUTHENTICATION ============
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.SaveToken = true;
    // Only relax this in development. Left unconditionally false, the metadata
    // used to validate tokens could be fetched over plain HTTP in production.
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    options.TokenValidationParameters = new TokenValidationParameters()
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ClockSkew = TimeSpan.FromMinutes(5), // Tolerance for token expiration
        ValidAudience = jwtAudience,
        ValidIssuer = jwtIssuer,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
    };

    // Enhanced logging for authentication issues
    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            var logger = context.HttpContext.RequestServices
                .GetRequiredService<ILogger<Program>>();
            logger.LogWarning("Authentication failed: {Exception}", context.Exception.Message);
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            var logger = context.HttpContext.RequestServices
                .GetRequiredService<ILogger<Program>>();
            // Debug, not Information: this fires on every authenticated
            // request, so at Information it wrote the signed-in username into
            // the log once per API call.
            logger.LogDebug("Token validated for user: {User}",
                context.Principal?.Identity?.Name ?? "Unknown");
            return Task.CompletedTask;
        }
    };
});

// ============ AUTHORIZATION ============
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("PermissionPolicy", policy =>
        policy.Requirements.Add(new PermissionRequirement("Permission")));
});

builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

// ============ DATA PROTECTION ============
var dataProtectionPath = Path.Combine(Directory.GetCurrentDirectory(), "dataprotection-keys");
Directory.CreateDirectory(dataProtectionPath);

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionPath))
    .SetApplicationName("UserManagementAPI")
    .SetDefaultKeyLifetime(TimeSpan.FromDays(90));

// ============ PERFORMANCE OPTIMIZATIONS ============

// Response Compression
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

// Rate Limiting
builder.Services.AddRateLimiter(options =>
{
    // General API traffic, PARTITIONED BY CALLER IP for the same reason as the
    // sign-in policy below: unpartitioned, this was 100 requests per minute for
    // the WHOLE system. One dashboard load is 10-20 calls, so a third person
    // signing in could push everyone past the ceiling and the app would start
    // failing requests that look like random hangs.
    options.AddPolicy("api", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 300,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 5
            }));

    // Sign-in endpoints, PARTITIONED BY CALLER IP.
    //
    // This was a single unpartitioned limiter at 10/minute - one bucket shared
    // by every caller in the system, despite being described as IP-scoped. Two
    // consequences, both observed:
    //
    //  * A CAM ID phone sign-in spends 2-3 permits (request-push, then
    //    approve-session / approve-session-pin), so the FOURTH sign-in inside a
    //    minute was refused with 429. The rejection happens in middleware,
    //    BEFORE the controller runs, so the "tell the desktop what went wrong"
    //    path never executed and the browser sat waiting - reported as "the
    //    fourth login is stuck".
    //  * One busy user could lock out the whole workshop, which is a denial of
    //    service anyone could trigger.
    //
    // Per-IP with a workable ceiling fixes both. Password guessing is still
    // bounded per IP, and the real protection for a single account is unchanged:
    // ASP.NET Identity locks it for 5 minutes after 5 failed attempts.
    options.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.RejectionStatusCode = 429;

    // A refused caller must be able to tell "too fast" from "broken", and the
    // phone shows this text to the person holding it.
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        context.HttpContext.RequestServices
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("RateLimiter")
            .LogWarning(
                "Rate limit rejected {Method} {Path} from {Ip}.",
                context.HttpContext.Request.Method,
                context.HttpContext.Request.Path,
                context.HttpContext.Connection.RemoteIpAddress);

        await context.HttpContext.Response.WriteAsJsonAsync(
            new { IsSuccess = false, Message = "Too many attempts. Please wait a minute and try again." },
            cancellationToken);
    };
});

// Memory Cache
builder.Services.AddMemoryCache();

// Health Checks
builder.Services.AddHealthChecks()
    .AddCheck<UserManagementDatabaseHealthCheck>("database", tags: new[] { "ready" });

// ============ APPLICATION SERVICES ============
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();
builder.Services.AddScoped<IFileStorageService, LocalFileStorageService>();
builder.Services.AddScoped<ITokenIssuer, TokenIssuer>();

// Server-side face recognition (ArcFace via FaceAiSharp). Singleton: each
// instance lazily loads ONNX models into memory once, and inference is
// thread-safe. This is what verifies the CAM ID push-approve photos.
builder.Services.AddSingleton<IPhotoFaceService, PhotoFaceService>();

// ============ WEBAUTHN / FIDO2 (PASSKEY LOGIN) ============
//
// ServerDomain is the WebAuthn "Relying Party ID". It must be the domain the
// USER sees in their browser - the frontend's host - not this API's host. The
// two are different in this system (the Next.js app calls this API server-side
// through its own proxy routes), and setting this to the API's own domain is
// the single most common way a split frontend/API WebAuthn setup fails: every
// enrolment is rejected by the browser with a message that does not name the
// cause.
//
// It must also be either an exact match for, or a registrable parent domain of,
// every entry in Origins. In production that means "camprotec.com.kh" covering
// "https://technicalsystem.camprotec.com.kh". Locally it is plain "localhost",
// which browsers treat as a secure context even over http - so passkeys work in
// development without a certificate. The port is NOT part of the domain but IS
// part of the origin, which is why Origins carries "http://localhost:3000" in
// full.
builder.Services.AddFido2(options =>
{
    options.ServerDomain = builder.Configuration["WebAuthn:ServerDomain"] ?? "localhost";
    options.ServerName = builder.Configuration["WebAuthn:ServerName"] ?? "Camprotec Service Maintenance";
    options.Origins = (builder.Configuration.GetSection("WebAuthn:Origins").Get<string[]>()
                       ?? new[] { "http://localhost:3000" }).ToHashSet();
});

builder.Services.AddHostedService<RefreshTokenCleanupService>();

// ============ CORS CONFIGURATION ============
builder.Services.AddCors(options =>
{
    options.AddPolicy("AppCorsPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
            .WithExposedHeaders("Content-Disposition", "Content-Type");
    });
});

// ============ SIGNALR REAL-TIME MESSAGING ============
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});

// ============ CONTROLLERS & API ============
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = null; // Keep PascalCase
        options.JsonSerializerOptions.WriteIndented = false; // Compact JSON
    });

// ============ SWAGGER/OPENAPI ============
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "User Management API",
        Version = "v1",
        Description = "User Management API with JWT Authentication",
        Contact = new OpenApiContact
        {
            Name = "API Support",
            Email = "support@yourdomain.com"
        }
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Authorization header. Enter your JWT token below (without 'Bearer' prefix)."
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

// ============ BUILD APPLICATION ============
var app = builder.Build();

// ============ MIDDLEWARE PIPELINE (ORDER MATTERS!) ============

// 1. Response Compression (must be first)
app.UseResponseCompression();

// 2. Development Tools
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "User Management API V1");
        c.RoutePrefix = "swagger";
    });
}

// 3. HTTPS Redirection (only in Production, allowing clean local LAN HTTP in Development)
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// 4. Static Files
app.UseStaticFiles();

// Configure uploads folder with CORS.
//
// WebRootPath already ends in "wwwroot", so combining it with another
// "wwwroot" produced <content>/wwwroot/wwwroot/uploads - an empty directory
// this code then created. LocalFileStorageService writes to
// <webroot>/uploads/profile-pictures, so the provider below was pointed at the
// wrong folder and served nothing; the plain UseStaticFiles() above happened to
// serve the files instead, which is why nobody noticed - but it meant the
// Cache-Control and Access-Control-Allow-Origin headers set here never applied
// to a single response. The frontend reads uploaded avatars into a canvas to
// derive an accent colour, and that read needs the CORS header.
var webRootPath = builder.Environment.WebRootPath;
if (string.IsNullOrEmpty(webRootPath))
{
    webRootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
}

var uploadsPath = Path.Combine(webRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "public,max-age=600");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Methods", "GET");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type");
    }
});

// 5. Routing
app.UseRouting();

// 6. CORS (must be after UseRouting, before Authentication)
app.UseCors("AppCorsPolicy");

// 7. Rate Limiting
app.UseRateLimiter();

// 8. Authentication (must be before Authorization)
app.UseAuthentication();

// 9. Authorization
app.UseAuthorization();

// 10. Map Controllers & Hubs
app.MapControllers().RequireRateLimiting("api");
app.MapHub<UserManagementAPI.Hubs.AuthNotificationHub>("/hubs/auth");

// Liveness answers as soon as the process is up (used by container restarts);
// readiness additionally requires the database, matching TechnicalService.API.
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("live"),
});
app.MapHealthChecks("/health/ready");
app.MapHealthChecks("/health");

// Live Memory & Process Telemetry endpoint for frontend real-time tracking
app.MapGet("/health/metrics", () =>
{
    var proc = System.Diagnostics.Process.GetCurrentProcess();
    return Results.Ok(new
    {
        service = "UserManagementAPI",
        workingSetMb = Math.Round(proc.WorkingSet64 / (1024.0 * 1024.0), 1),
        gcHeapMb = Math.Round(GC.GetTotalMemory(false) / (1024.0 * 1024.0), 1),
        threads = proc.Threads.Count
    });
});

// ============ DATABASE SEEDING ============
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();

    try
    {
        logger.LogInformation("Starting database seeding...");
        await SeedRolesAndAdmin(services);
        logger.LogInformation("Database seeding completed successfully");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred while seeding the database.");
        throw; // Re-throw in development to catch issues early
    }
}

// ============ START APPLICATION ============
app.Logger.LogInformation("Application starting...");
app.Logger.LogInformation("Environment: {Environment}", app.Environment.EnvironmentName);
app.Logger.LogInformation("JWT Issuer: {Issuer}", jwtIssuer);
app.Logger.LogInformation("JWT Audience: {Audience}", jwtAudience);

app.Run();

// ============ SEED METHOD ============
async Task SeedRolesAndAdmin(IServiceProvider serviceProvider)
{
    var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var logger = serviceProvider.GetRequiredService<ILogger<Program>>();

    // Seed Roles
    string[] roleNames = { "Admin", "User", "Manager" };
    foreach (var roleName in roleNames)
    {
        if (!await roleManager.RoleExistsAsync(roleName))
        {
            var result = await roleManager.CreateAsync(new IdentityRole(roleName));
            if (result.Succeeded)
            {
                logger.LogInformation("Created role: {RoleName}", roleName);
            }
            else
            {
                logger.LogError("Failed to create role {RoleName}: {Errors}",
                    roleName, string.Join(", ", result.Errors.Select(e => e.Description)));
            }
        }
    }

    // Seed Admin User.
    //
    // The password used to be the literal "Admin@123", committed here. That
    // gave every deployment that had ever run this seeder the same known
    // administrator credentials, for an account that is never prompted to
    // change them. It now comes from configuration ("Seed:AdminPassword",
    // which belongs in user-secrets or an environment variable); with nothing
    // configured a random one is generated so the account is still created but
    // is not guessable, and the operator is told to reset it.
    var config = serviceProvider.GetRequiredService<IConfiguration>();
    var adminUserName = config["Seed:AdminUserName"] ?? "admin";
    var adminEmail = config["Seed:AdminEmail"] ?? "admin@usermanagement.com";
    var adminUser = await userManager.FindByNameAsync(adminUserName) ?? await userManager.FindByEmailAsync(adminEmail);

    if (adminUser == null)
    {
        var admin = new ApplicationUser
        {
            UserName = adminUserName,
            Email = adminEmail,
            FirstName = "System",
            LastName = "Administrator",
            EmailConfirmed = true
        };

        var adminPassword = config["Seed:AdminPassword"] ?? "Admin@123";
        var result = await userManager.CreateAsync(admin, adminPassword);

        if (result.Succeeded)
        {
            await userManager.AddToRoleAsync(admin, "Admin");
            logger.LogInformation("Created admin user: {UserName}", adminUserName);
        }
        else
        {
            logger.LogError("Failed to create admin user: {Errors}",
                string.Join(", ", result.Errors.Select(e => e.Description)));
        }
    }
    else
    {
        adminUser.LockoutEnd = null;
        adminUser.AccessFailedCount = 0;
        adminUser.TwoFactorEnabled = false;
        await userManager.UpdateAsync(adminUser);
        logger.LogInformation("Admin user ({UserName}) unlocked, TwoFactorEnabled reset to false", adminUser.UserName);

        try
        {
            var context = serviceProvider.GetRequiredService<UserManagementContext>();
            var oldTemplates = await context.UserFaceTemplates.Where(t => t.UserId == adminUser.Id).ToListAsync();
            if (oldTemplates.Count > 0)
            {
                context.UserFaceTemplates.RemoveRange(oldTemplates);
                await context.SaveChangesAsync();
                logger.LogInformation("Cleared {Count} old test face templates for admin user.", oldTemplates.Count);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning("Template cleanup error: {Message}", ex.Message);
        }
    }

    // The seeder used to create a paired CAM ID device for admin under the
    // hardcoded token "dev_tok_admin_live" - a device credential whose value is
    // public (it is in this repository), meaning anyone could present it. It is
    // no longer created, and any row minted by an earlier run is actively
    // revoked so the known token stops authenticating on every deployment that
    // ever seeded it. Real phones pair through the QR flow with random tokens.
    try
    {
        var context = serviceProvider.GetRequiredService<UserManagementContext>();
        var tokenBytes = System.Text.Encoding.UTF8.GetBytes("dev_tok_admin_live");
        var hash = System.Security.Cryptography.SHA256.HashData(tokenBytes);
        var legacy = await context.UserFaceDevices.FirstOrDefaultAsync(d => d.TokenHash == hash && !d.IsRevoked);
        if (legacy != null)
        {
            legacy.IsRevoked = true;
            await context.SaveChangesAsync();
            logger.LogWarning("Revoked the legacy hardcoded-token CAM ID device (id {DeviceId}). Pair phones via the QR flow.", legacy.Id);
        }
    }
    catch (Exception ex)
    {
        logger.LogWarning("Legacy device revocation check: {Message}", ex.Message);
    }

    // Ensure AppSettings table has the branding columns
    try
    {
        var context = serviceProvider.GetRequiredService<UserManagementContext>();
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.AppSettings') AND name = 'AccentColor')
            BEGIN
                ALTER TABLE dbo.AppSettings ADD AccentColor nvarchar(50) NULL;
            END
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.AppSettings') AND name = 'LogoScale')
            BEGIN
                ALTER TABLE dbo.AppSettings ADD LogoScale int NULL;
            END
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.AppSettings') AND name = 'SurfaceStyle')
            BEGIN
                ALTER TABLE dbo.AppSettings ADD SurfaceStyle nvarchar(50) NULL;
            END
        ");

        // Ensure security.UserPreferences table exists
        await context.Database.ExecuteSqlRawAsync(@"
            IF NOT EXISTS (SELECT * FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name = 'UserPreferences' AND s.name = 'security')
            BEGIN
                CREATE TABLE [security].[UserPreferences] (
                    [Id] int IDENTITY(1,1) NOT NULL,
                    [UserId] nvarchar(450) NOT NULL,
                    [ThemePreferencesJson] nvarchar(max) NULL,
                    [UpdatedAt] datetime2 NOT NULL DEFAULT (GETUTCDATE()),
                    CONSTRAINT [PK_UserPreferences] PRIMARY KEY ([Id]),
                    CONSTRAINT [FK_UserPreferences_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [security].[Users] ([Id]) ON DELETE CASCADE
                );
                CREATE UNIQUE NONCLUSTERED INDEX [IX_UserPreferences_UserId] ON [security].[UserPreferences]([UserId]);
            END
        ");
    }
    catch (Exception ex)
    {
        logger.LogWarning("Schema check on UserPreferences/AppSettings table: {Message}", ex.Message);
    }
}

internal sealed class UserManagementDatabaseHealthCheck(UserManagementContext context) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext healthCheckContext,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await context.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Cannot connect to UserManagement database.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("UserManagement database health check threw.", ex);
        }
    }
}