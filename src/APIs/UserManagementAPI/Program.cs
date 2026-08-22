using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
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
    options.AddFixedWindowLimiter("api", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 5;
    });

    options.AddFixedWindowLimiter("login", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });

    options.RejectionStatusCode = 429;
});

// Memory Cache
builder.Services.AddMemoryCache();

// ============ APPLICATION SERVICES ============
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IFileStorageService, LocalFileStorageService>();
builder.Services.AddHostedService<RefreshTokenCleanupService>();

// ============ CORS CONFIGURATION ============
builder.Services.AddCors(options =>
{
    options.AddPolicy("AppCorsPolicy", policy =>
    {
        policy.WithOrigins(

                 "http://technicalsystemservices.koompi.cloud",
                 "https://technicalsystemservices.koompi.cloud",
                 "http://user.koompi.cloud",
                 "https://user.koompi.cloud"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
            .WithExposedHeaders("Content-Disposition", "Content-Type");
    });
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

// 3. HTTPS Redirection
app.UseHttpsRedirection();

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

// 10. Map Controllers
app.MapControllers().RequireRateLimiting("api");

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
    var adminEmail = config["Seed:AdminEmail"] ?? "admin@usermanagement.com";
    var adminUser = await userManager.FindByEmailAsync(adminEmail);

    if (adminUser == null)
    {
        var admin = new ApplicationUser
        {
            UserName = config["Seed:AdminUserName"] ?? "admin",
            Email = adminEmail,
            FirstName = "System",
            LastName = "Administrator",
            EmailConfirmed = true
        };

        var configuredPassword = config["Seed:AdminPassword"];
        var generatedPassword = string.IsNullOrWhiteSpace(configuredPassword);
        var adminPassword = generatedPassword
            ? GenerateSeedPassword()
            : configuredPassword;

        var result = await userManager.CreateAsync(admin, adminPassword);

        if (result.Succeeded)
        {
            await userManager.AddToRoleAsync(admin, "Admin");
            logger.LogInformation("Created admin user: {Email}", adminEmail);

            if (generatedPassword)
            {
                // Logged once, at first creation only. Set Seed:AdminPassword
                // to avoid this, and change the password after signing in.
                logger.LogWarning(
                    "No Seed:AdminPassword configured. A random password was generated " +
                    "for {Email}: {Password} - sign in and change it now.",
                    adminEmail, adminPassword);
            }
        }
        else
        {
            logger.LogError("Failed to create admin user: {Errors}",
                string.Join(", ", result.Errors.Select(e => e.Description)));
        }
    }
    else
    {
        logger.LogInformation("Admin user already exists: {Email}", adminEmail);
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
    }
    catch (Exception ex)
    {
        logger.LogWarning("Schema check on AppSettings table: {Message}", ex.Message);
    }
}

// Satisfies the configured Identity password policy (digit, lower, upper,
// length >= 6) without being predictable.
static string GenerateSeedPassword()
{
    const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const string lower = "abcdefghijkmnopqrstuvwxyz";
    const string digits = "23456789";
    const string all = upper + lower + digits;

    var chars = new List<char>
    {
        upper[System.Security.Cryptography.RandomNumberGenerator.GetInt32(upper.Length)],
        lower[System.Security.Cryptography.RandomNumberGenerator.GetInt32(lower.Length)],
        digits[System.Security.Cryptography.RandomNumberGenerator.GetInt32(digits.Length)],
    };

    while (chars.Count < 20)
    {
        chars.Add(all[System.Security.Cryptography.RandomNumberGenerator.GetInt32(all.Length)]);
    }

    // Shuffle so the guaranteed character classes are not always in front.
    for (var i = chars.Count - 1; i > 0; i--)
    {
        var j = System.Security.Cryptography.RandomNumberGenerator.GetInt32(i + 1);
        (chars[i], chars[j]) = (chars[j], chars[i]);
    }

    return new string(chars.ToArray());
}