/* ===========================================================================
   Add search/sort indexes to dbo.Services
   ---------------------------------------------------------------------------
   Why: every ticket list in the React UI issues the same query shape —
   filter by ServiceStatusId, ORDER BY ReportNo DESC, page. ServiceStatusId
   already had an FK index, but ReportNo had none, so SQL Server sorted the
   entire filtered set on every request, on every scroll batch, per user.

   This script is the hand-run equivalent of the EF configuration in
   ServiceEntityTypeConfiguration.cs. Prefer generating a real migration when a
   .NET SDK is available:

       dotnet ef migrations add AddServiceSearchIndexes \
           --project src/Shared/TechnicalService.Infrastructure \
           --startup-project src/APIs/TechnicalService.API

   Run this script only if you need the indexes before that can happen. It is
   idempotent — re-running it is a no-op.

   ORDER MATTERS: step 2 must succeed before step 3, because SQL Server cannot
   use an nvarchar(max) column as an index key (1700-byte limit).
   =========================================================================== */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   STEP 1 — PRE-FLIGHT CHECK. Run this on its own and read the result BEFORE
   running anything below.

   Step 2 shortens ReportNo to nvarchar(100). If any existing row is longer,
   the ALTER fails (SQL Server will not silently truncate) — and if it somehow
   did truncate, report numbers would be corrupted. Expect a small number here;
   report numbers are short codes.
--------------------------------------------------------------------------- */
SELECT
    MAX(LEN(ReportNo))                                        AS MaxReportNoLength,
    SUM(CASE WHEN LEN(ReportNo) > 100 THEN 1 ELSE 0 END)      AS RowsThatWouldFail
FROM dbo.Services;
GO

/* ---------------------------------------------------------------------------
   STEP 2 — Bound ReportNo so it can be used as an index key.
   Only proceed if RowsThatWouldFail above is 0.
--------------------------------------------------------------------------- */
IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Services')
      AND name      = N'ReportNo'
      AND max_length = -1          -- -1 means nvarchar(max)
)
BEGIN
    PRINT 'Altering dbo.Services.ReportNo -> nvarchar(100)';
    ALTER TABLE dbo.Services ALTER COLUMN ReportNo nvarchar(100) NULL;
END
ELSE
    PRINT 'dbo.Services.ReportNo already bounded - skipping';
GO

/* ---------------------------------------------------------------------------
   STEP 3 — Indexes.

   IX_Services_Status_ReportNo is the important one: it serves the exact query
   the UI runs, letting SQL Server seek the status and read ReportNo already
   ordered, so the sort disappears from the plan.
--------------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Services_Status_ReportNo'
                 AND object_id = OBJECT_ID(N'dbo.Services'))
BEGIN
    PRINT 'Creating IX_Services_Status_ReportNo';
    CREATE NONCLUSTERED INDEX IX_Services_Status_ReportNo
        ON dbo.Services (ServiceStatusId, ReportNo);
END
GO

-- Serves lookups that don't filter by status (e.g. the header's global search).
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Services_ReportNo'
                 AND object_id = OBJECT_ID(N'dbo.Services'))
BEGIN
    PRINT 'Creating IX_Services_ReportNo';
    CREATE NONCLUSTERED INDEX IX_Services_ReportNo
        ON dbo.Services (ReportNo);
END
GO

-- Fallback sort column, and what every report date range filters on.
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Services_ServiceDate'
                 AND object_id = OBJECT_ID(N'dbo.Services'))
BEGIN
    PRINT 'Creating IX_Services_ServiceDate';
    CREATE NONCLUSTERED INDEX IX_Services_ServiceDate
        ON dbo.Services (ServiceDate);
END
GO

/* ---------------------------------------------------------------------------
   STEP 4 — Confirm the database collation is case-insensitive.

   TechnicalServiceQueries no longer wraps search columns in LOWER(), because
   doing so forced a row-by-row evaluation and ruled out index use. Matching
   now relies on the column's own collation. A name containing "_CI_" (e.g.
   SQL_Latin1_General_CP1_CI_AS) means case-insensitive, and search behaviour
   is unchanged. If this returns a "_CS_" collation, searches became
   case-sensitive and the LOWER() calls need reinstating (or the columns
   re-collated).
--------------------------------------------------------------------------- */
SELECT DATABASEPROPERTYEX(DB_NAME(), 'Collation') AS DatabaseCollation;
GO
