/* =====================================================================
   dbo.Services — bound ReportNo so it can be indexed
   =====================================================================

   ⚠ RUN THIS ON TechnicalServiceDB_Staging FIRST.
     It ALTERs a column on a live table. Rehearse it, run the app against
     staging, confirm nothing breaks, and only then consider production.
     See sql/create-staging-database.sql.

   THE PROBLEM
   -----------
   Every string column on dbo.Services is NVARCHAR(MAX):

       ReportNo, CompanyName, ContactName, PhoneNumber, Address,
       CustomerRequest, Inspection, Solution

   (only ServiceLocation is bounded, at NVARCHAR(30)). A MAX/LOB column can
   never be an index KEY column — attempting it fails with

       SQL Error [1919]: Column 'ReportNo' in table 'dbo.Services' is of a
       type that is invalid for use as a key column in an index.

   which is exactly what happened when create-services-indexes.sql was first
   run.

   WHY IT MATTERS BEYOND THE ERROR
   -------------------------------
   The queue pages filter by status and sort by ReportNo descending, then
   page. With ReportNo unindexable, SQL Server must sort the entire filtered
   set on every request — and these lists load by infinite scroll, so that is
   once per scroll batch, per user. The comment on IX_Services_Status_ReportNo
   in ServiceEntityTypeConfiguration.cs describes this exact cost. The index
   it describes has never been creatable.

   MEASURED, ALL 3,666 ROWS (via the API, 2026-08-19)
   --------------------------------------------------
       column            max   p99   mean
       ReportNo           13    13     13     <- fixed-format code, e.g. 20260819-1699
       PhoneNumber        40    25     11
       ContactName        50    19      5
       CompanyName        70    60     33
       Address           244   189     94
       CustomerRequest   255    53     19
       Inspection        304    91     31
       Solution          265   197     59

   Nothing is near a limit. These are MAX by default, not by need.

   WHAT THIS SCRIPT CHANGES — AND WHAT IT DELIBERATELY DOES NOT
   ------------------------------------------------------------
   REQUIRED (section 2):
       ReportNo  ->  NVARCHAR(50)
   A generated code in a fixed format, longest 13 characters. 50 gives ~4x
   headroom. This is the only change needed to unlock the indexes.

   OPTIONAL (section 4, commented out):
       PhoneNumber -> NVARCHAR(50), ContactName -> NVARCHAR(200),
       CompanyName -> NVARCHAR(200)
   Safe by the same measurements and they shrink the row, but nothing
   requires them. Enable only if you want the row-size win.

   NOT TOUCHED, ON PURPOSE:
       Address, CustomerRequest, Inspection, Solution
   These are genuinely free text a technician types. Today's longest is 304
   characters, but there is no length validation anywhere in the app, so
   bounding them converts "someone pasted a long note" into a runtime INSERT
   failure on a workshop floor. The indexing argument does not apply to them
   either — they are only ever searched with a leading-wildcard LIKE, which
   cannot seek a B-tree at any length. Leave them MAX.

   IMPACT
   ------
   - ALTER COLUMN rewrites the column and takes a schema-modification lock on
     dbo.Services for the duration: readers and writers wait. At 6.6 MB /
     3,666 rows this is fast, but it is not online. Quiet window.
   - Data is preserved. Section 1 refuses to proceed if any value would be
     truncated, so silent data loss is not possible.
   - Nullability is detected and preserved — getting this wrong would either
     reject existing NULLs or silently drop a NOT NULL guarantee.
   - Reversible: ALTER COLUMN ReportNo NVARCHAR(MAX) puts it back (you would
     have to drop the new indexes first).

   AFTER RUNNING — update the EF model to match
   --------------------------------------------
   In ServiceEntityTypeConfiguration.cs add:

       serviceConfiguration.Property(s => s.ReportNo).HasMaxLength(50);

   so the model and the database agree. Do NOT then run
   `dotnet ef migrations add` — migrations auto-apply at startup via
   AddMigration() in Extensions.cs, and the model snapshot has drifted far
   enough from this database that a generated migration could rename or drop
   live objects.
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---------------------------------------------------------------------
   REQUIRED SET OPTIONS — do not remove.

   Once dbo.Services carries a FILTERED index (IX_Services_FinishedDate, from
   fix-all-missing-indexes.sql), SQL Server refuses ANY ALTER TABLE on it
   unless all seven of these are set for the session:

       Msg 1934: ALTER TABLE failed because the following SET options have
       incorrect settings: 'QUOTED_IDENTIFIER'.

   Without them the failure cascades silently: the ALTER fails, ReportNo stays
   NVARCHAR(MAX), and both CREATE INDEX statements in section 3 then fail with
   the original error 1919 — leaving you exactly where you started while the
   script appears to have run. Caught by rehearsing this on a throwaway
   LocalDB copy.

   This applies to all future schema work on dbo.Services, not just this
   script.
   --------------------------------------------------------------------- */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* ---------------------------------------------------------------------
   SECTION 0 — where am I?  Refuse to run unnoticed on production.
   --------------------------------------------------------------------- */
SELECT
    CurrentDatabase = DB_NAME(),
    Warning = CASE WHEN DB_NAME() = 'TechnicalServiceDB'
                   THEN '*** THIS IS PRODUCTION - rehearse on staging first ***'
                   ELSE 'not production' END;
GO


/* ---------------------------------------------------------------------
   SECTION 1 — safety check: would anything be truncated?
   --------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM dbo.Services WHERE LEN(ReportNo) > 50)
BEGIN
    RAISERROR('ReportNo has row(s) longer than 50 characters. Widen the target length before proceeding.', 16, 1);
END
ELSE
BEGIN
    PRINT 'safe - no truncation possible';
END
GO


/* ---------------------------------------------------------------------
   SECTION 2 — the required change

   Nullability is read from the catalogue and reproduced, rather than
   assumed. ALTER COLUMN without an explicit NULL/NOT NULL defaults the
   column to NULLable, which would silently drop a NOT NULL constraint.
   --------------------------------------------------------------------- */
IF EXISTS (
    SELECT 1
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.Services')
      AND c.name = 'ReportNo'
      AND c.max_length = -1          -- -1 means MAX
)
BEGIN
    DECLARE @IsNullable bit = (
        SELECT is_nullable FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.Services') AND name = 'ReportNo');

    DECLARE @stmt nvarchar(max) =
        N'ALTER TABLE dbo.Services ALTER COLUMN ReportNo NVARCHAR(50) '
        + CASE WHEN @IsNullable = 1 THEN N'NULL;' ELSE N'NOT NULL;' END;

    PRINT @stmt;
    EXEC sp_executesql @stmt;
    PRINT 'ReportNo is now NVARCHAR(50)';
END
ELSE
    PRINT 'skipped - ReportNo is already bounded';
GO


/* ---------------------------------------------------------------------
   SECTION 3 — the two indexes that were impossible before

   IX_Services_Status_ReportNo is the one that matters: the queue pages seek
   the status then read ReportNo already in order, skipping the sort
   entirely. Created ASC — SQL Server scans an index backwards at no cost,
   so this serves ORDER BY ReportNo DESC without a DESC key.

   IX_Services_ReportNo serves lookups and sorts that do not filter by
   status, such as the header's global search.

   Note neither helps ReportNo.Contains(term): a leading-wildcard LIKE is
   not seekable on a B-tree. They are for the ORDER BY and for exact or
   prefix matches.
   --------------------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Services') AND name = 'IX_Services_Status_ReportNo')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_Status_ReportNo
        ON dbo.Services (ServiceStatusId, ReportNo);
    PRINT 'created IX_Services_Status_ReportNo';
END
ELSE PRINT 'skipped IX_Services_Status_ReportNo - already present';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Services') AND name = 'IX_Services_ReportNo')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_ReportNo
        ON dbo.Services (ReportNo);
    PRINT 'created IX_Services_ReportNo';
END
ELSE PRINT 'skipped IX_Services_ReportNo - already present';
GO

/* ---------------------------------------------------------------------
   3.3  DROP the now-redundant narrow status index — NOT optional

   IX_Services_ServiceStatusId exists only because ReportNo could not be
   indexed. The composite above leads with the same column and serves
   everything the narrow one did.

   Leaving both in place does not merely waste writes — it makes the plan
   WORSE. Measured on a rehearsal copy (2,047 rows, same schema shape), for
   the queue-page query
   `WHERE ServiceStatusId = @s ORDER BY ReportNo DESC OFFSET/FETCH 25`:

     both indexes present   ->  Index Seek x2, MERGE JOIN, SORT x2
     narrow one dropped     ->  Index Seek, TOP, Nested Loops, Key Lookup
                                ** no Sort operator at all **

   With both, the optimiser combines the two overlapping indexes and has to
   re-sort the result. With only the composite it seeks in ReportNo order,
   takes 25 rows, and looks up the remaining columns for just those 25 —
   which is the whole point of the composite.

   Note this is only reachable because ReportNo is now bounded. While it was
   NVARCHAR(MAX) the sort was unavoidable no matter what was indexed.
   --------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.indexes
           WHERE object_id = OBJECT_ID('dbo.Services') AND name = 'IX_Services_ServiceStatusId')
   AND EXISTS (SELECT 1 FROM sys.indexes
           WHERE object_id = OBJECT_ID('dbo.Services') AND name = 'IX_Services_Status_ReportNo')
BEGIN
    DROP INDEX IX_Services_ServiceStatusId ON dbo.Services;
    PRINT 'dropped IX_Services_ServiceStatusId - superseded by the composite';
END
ELSE PRINT 'skipped drop - composite missing or narrow index already gone';
GO


/* ---------------------------------------------------------------------
   SECTION 4 — OPTIONAL row-size reductions

   Safe by the measurements in the header, but nothing depends on them.
   Uncomment deliberately, not by default.
   --------------------------------------------------------------------- */
-- ALTER TABLE dbo.Services ALTER COLUMN PhoneNumber NVARCHAR(50)  NULL;
-- ALTER TABLE dbo.Services ALTER COLUMN ContactName NVARCHAR(200) NULL;
-- ALTER TABLE dbo.Services ALTER COLUMN CompanyName NVARCHAR(200) NULL;


/* ---------------------------------------------------------------------
   SECTION 5 — verify
   --------------------------------------------------------------------- */
SELECT
    ColumnName = c.name,
    DataType   = t.name,
    MaxChars   = CASE WHEN c.max_length = -1 THEN -1 ELSE c.max_length / 2 END,
    IsNullable = c.is_nullable
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.Services')
  AND t.name IN ('nvarchar','varchar')
ORDER BY c.name;

SELECT
    IndexName  = i.name,
    KeyColumns = STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        JOIN sys.columns c
          ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id
          AND ic.index_id  = i.index_id
          AND ic.is_included_column = 0
        ORDER BY ic.key_ordinal
        FOR XML PATH('')), 1, 2, '')
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.Services') AND i.name IS NOT NULL
ORDER BY i.name;

/* Row count must be unchanged and no ReportNo may be empty. */
SELECT
    TotalRows        = COUNT(*),
    NullOrEmptyRepNo = SUM(CASE WHEN ReportNo IS NULL OR ReportNo = '' THEN 1 ELSE 0 END),
    LongestReportNo  = MAX(LEN(ReportNo))
FROM dbo.Services;
GO
