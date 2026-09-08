using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using TechnicalService.API.Apis;
using TechnicalService.API.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.AddApplicationServices();
builder.Services.AddProblemDetails();
builder.Services.AddHostedService<MemoryMaintenanceHostedService>();

// Maps a missing record to 404 before the generic 500 path sees it.
builder.Services.AddExceptionHandler<NotFoundExceptionHandler>();

// Maps a rejected request value (an unrecognised condition, service location or
// rental action in the body) to 400. Without it those threw out of the command
// handler as ArgumentException and were reported as server faults.
builder.Services.AddExceptionHandler<ValidationExceptionHandler>();

// Maps a state conflict (duplicate lookup name, a category/type/brand still in
// use, or a raced FK/unique/CHECK violation from SQL Server) to 409.
builder.Services.AddExceptionHandler<ConflictExceptionHandler>();

var withApiVersioning = builder.Services.AddApiVersioning();

builder.AddDefaultOpenApi(withApiVersioning);

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
});

// AddProblemDetails() only registers the writer — without this an unhandled
// exception left the client with a bare, bodyless 500 (and a stack trace in
// Development). Now every failure comes back as a consistent ProblemDetails
// document that the Next.js proxy can surface.
app.UseExceptionHandler();
app.UseStatusCodePages();

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

// On-demand Memory Cleaner endpoint (triggers GC collection and OS page release)
app.MapPost("/health/clean-memory", () =>
{
    var (beforeMb, afterMb, savedMb, gcHeapMb) = MemoryCleaner.CleanMemory();
    return Results.Ok(new
    {
        success = true,
        service = "TechnicalService.API",
        beforeMb,
        afterMb,
        savedMb,
        gcHeapMb
    });
});

var repairs = app.NewVersionedApi("Repairs");
repairs.MapRepairsApiV1();
// Same versioned builder, so the RequireAuthorization() below covers it.
repairs.MapSparepartTaxonomyApiV1();

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

// Ensure ServiceTelegramMessages tracking table exists in SQL Server & FK constraints allow service deletion
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<TechnicalService.Infrastructure.TechnicalServiceContext>();
    try
    {
        await dbContext.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ServiceTelegramMessages')
BEGIN
    CREATE TABLE dbo.ServiceTelegramMessages (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        ServiceId UNIQUEIDENTIFIER NOT NULL,
        TopicKey NVARCHAR(50) NOT NULL,
        MessageId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        DeletedAt DATETIME2 NULL
    );

    CREATE INDEX IX_ServiceTelegramMessages_ServiceId_TopicKey ON dbo.ServiceTelegramMessages (ServiceId, TopicKey);
    CREATE INDEX IX_ServiceTelegramMessages_MessageId ON dbo.ServiceTelegramMessages (MessageId);
END

-- Ensure FK_AuditLog_Services allows deletion of services by setting ServiceId to NULL
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_AuditLog_Services')
BEGIN
    ALTER TABLE dbo.SparepartStockAuditLog DROP CONSTRAINT FK_AuditLog_Services;
    ALTER TABLE dbo.SparepartStockAuditLog ADD CONSTRAINT FK_AuditLog_Services
        FOREIGN KEY (ServiceId) REFERENCES dbo.Services(Id) ON DELETE SET NULL;
END

-- Ensure StockNotificationOutbox FK to Services is CASCADE if exists
DECLARE @fkOutbox NVARCHAR(200);
SELECT TOP 1 @fkOutbox = name FROM sys.foreign_keys 
WHERE parent_object_id = OBJECT_ID('dbo.StockNotificationOutbox') 
  AND referenced_object_id = OBJECT_ID('dbo.Services');
IF @fkOutbox IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.StockNotificationOutbox DROP CONSTRAINT ' + @fkOutbox);
    EXEC('ALTER TABLE dbo.StockNotificationOutbox ADD CONSTRAINT ' + @fkOutbox + ' FOREIGN KEY (ServiceId) REFERENCES dbo.Services(Id) ON DELETE CASCADE');
END

-- Ensure SparepartItems FK to Services is CASCADE
DECLARE @fkSpareItems NVARCHAR(200);
SELECT TOP 1 @fkSpareItems = name FROM sys.foreign_keys 
WHERE parent_object_id = OBJECT_ID('dbo.SparepartItems') 
  AND referenced_object_id = OBJECT_ID('dbo.Services');
IF @fkSpareItems IS NOT NULL AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = @fkSpareItems AND delete_referential_action = 0)
BEGIN
    EXEC('ALTER TABLE dbo.SparepartItems DROP CONSTRAINT ' + @fkSpareItems);
    EXEC('ALTER TABLE dbo.SparepartItems ADD CONSTRAINT ' + @fkSpareItems + ' FOREIGN KEY (ServiceId) REFERENCES dbo.Services(Id) ON DELETE CASCADE');
END

-- Ensure Covering Indexes for fast Spareparts search and pagination
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Spareparts_ItemName' AND object_id = OBJECT_ID('dbo.Spareparts'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Spareparts_ItemName ON dbo.Spareparts (ItemName) INCLUDE (Quantity, DefaultPrice, PictureUrl, SerialNumber, UserFor);
END
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Spareparts_SerialNumber' AND object_id = OBJECT_ID('dbo.Spareparts'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Spareparts_SerialNumber ON dbo.Spareparts (SerialNumber);
END
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Spareparts_UserFor' AND object_id = OBJECT_ID('dbo.Spareparts'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Spareparts_UserFor ON dbo.Spareparts (UserFor);
END
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Spareparts_Quantity' AND object_id = OBJECT_ID('dbo.Spareparts'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Spareparts_Quantity ON dbo.Spareparts (Quantity);
END

-- Update trg_Sparepartitems_AfterDelete_StockIn: when a sparepart is removed from a service,
-- restore actual stock (if live movement) and delete its audit log rows & outbox rows
EXEC('
CREATE OR ALTER TRIGGER trg_Sparepartitems_AfterDelete_StockIn
ON SparepartItems
AFTER DELETE
AS
BEGIN
    SET NOCOUNT ON
    SET XACT_ABORT ON

    IF NOT EXISTS (
        SELECT 1 FROM deleted
        WHERE SparepartId IS NOT NULL
          AND SparepartId != ''00000000-0000-0000-0000-000000000000''
    )
        RETURN

    BEGIN TRY
        EXEC sp_set_session_context N''SkipDirectQuantityAudit'', 1

        -- Restore stock if real movement occurred
        UPDATE sp
        SET sp.Quantity = sp.Quantity + d.Quantity
        FROM Spareparts sp WITH (UPDLOCK, ROWLOCK)
        INNER JOIN deleted d ON sp.Id = d.SparepartId
        WHERE d.SparepartId IS NOT NULL
          AND d.SparepartId != ''00000000-0000-0000-0000-000000000000''
          AND ISNULL(d.IsHoldStatus, 0) = 0
          AND d.Quantity > 0
          AND ISNULL(d.Condition, '''') != ''Fix''

        EXEC sp_set_session_context N''SkipDirectQuantityAudit'', 0

        -- 🗑️ Delete draft/hold tracking rows (QuantityChange = 0) when removed
        DELETE a
        FROM SparepartStockAuditLog a
        INNER JOIN deleted d ON a.ServiceId = d.ServiceId AND a.SparepartId = d.SparepartId
        WHERE ISNULL(d.IsHoldStatus, 0) = 1 OR a.QuantityChange = 0;

        -- 🗑️ Delete pending outbox notifications for the removed sparepart
        DELETE o
        FROM StockNotificationOutbox o
        INNER JOIN deleted d ON o.ServiceId = d.ServiceId AND o.SparepartId = d.SparepartId;

        -- 📦 If real stock was restored (IsHoldStatus = 0), log STOCK_IN so stock tracking is complete and not lost!
        INSERT INTO SparepartStockAuditLog (
            Id, SparepartId, ServiceId, OperationType, QuantityChange,
            StockBalanceBefore, StockBalanceAfter, Timestamp, Remarks
        )
        SELECT
            NEWID(),
            d.SparepartId,
            d.ServiceId,
            'STOCK_IN',
            d.Quantity,
            sp.Quantity - d.Quantity,
            sp.Quantity,
            SYSUTCDATETIME(),
            CONCAT(N'Stock restored: Item removed from service (Report: ', ISNULL(svc.ReportNo, 'N/A'), N') | Restored: +', d.Quantity)
        FROM deleted d
        INNER JOIN Spareparts sp ON d.SparepartId = sp.Id
        LEFT JOIN Services svc ON d.ServiceId = svc.Id
        WHERE ISNULL(d.IsHoldStatus, 0) = 0
          AND d.Quantity > 0
          AND ISNULL(d.Condition, '''') != 'Fix';

    END TRY
    BEGIN CATCH
        EXEC sp_set_session_context N''SkipDirectQuantityAudit'', 0
        DECLARE @Error NVARCHAR(4000) = ERROR_MESSAGE()
        RAISERROR(@Error, 16, 1)
    END CATCH
END
');

-- Clean up orphan tracking rows (QuantityChange = 0) where sparepart was removed from the service
DELETE a
FROM dbo.SparepartStockAuditLog a
WHERE a.ServiceId IS NOT NULL
  AND a.QuantityChange = 0
  AND NOT EXISTS (
      SELECT 1 FROM dbo.SparepartItems spi
      WHERE spi.ServiceId = a.ServiceId
        AND spi.SparepartId = a.SparepartId
  );
");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Database Schema Init Warning]: {ex.Message}");
    }
}

app.Run();
