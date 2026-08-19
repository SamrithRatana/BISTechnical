/* =====================================================================
   dbo.Services — create the indexes the query layer already assumes
   =====================================================================

   REVISION 2026-08-19 — the first version of this script FAILED partway.
   -----------------------------------------------------------------------
   It created IX_Services_ServiceDate, then died on:

       SQL Error [1919]: Column 'ReportNo' in table 'dbo.Services' is of a
       type that is invalid for use as a key column in an index.

   Cause: **every string column on dbo.Services is NVARCHAR(MAX)** —
   ReportNo, CompanyName, ContactName, PhoneNumber, Address,
   CustomerRequest, Inspection and Solution. Only ServiceLocation is bounded
   (NVARCHAR(30)). A MAX/LOB column can never be an index KEY column, at any
   length, so `IX_Services_Status_ReportNo` and `IX_Services_ReportNo` were
   impossible as written and have been removed from this script.

   That is a schema defect, not just a scripting one, and it has a real
   consequence: the queue pages sort by ReportNo, and **that sort can never
   be served by an index while the column is MAX**. SQL Server must sort the
   whole filtered set on every request and every scroll batch. The fix is to
   bound the column — see `sql/bound-services-string-columns.sql`, which is
   deliberately a separate script because it is an ALTER on live data and
   should be rehearsed on the staging database first.

   Measured over all 3,666 rows via the API, to size that change honestly:

       column           max len   p99
       ReportNo              13    13
       SerialNumber          20    14
       PhoneNumber           40    25
       ContactName           50    19
       ItemName              46    37
       CompanyName           70    60
       Address              244   189

   So nothing is remotely near a limit; these were declared MAX by default,
   not by need.

   WHAT THIS SCRIPT DOES NOW
   -------------------------
   Three indexes, all on columns whose types allow it:

       IX_Services_ServiceDate      (ServiceDate)  INCLUDE (ServiceStatusId)
       IX_Services_ServiceStatusId  (ServiceStatusId)
       IX_Services_FinishedDate     (FinishedDate) WHERE FinishedDate IS NOT NULL

   It is safe to re-run after the partial failure: each guard checks key
   columns, so the already-created IX_Services_ServiceDate is skipped rather
   than duplicated.

   SAFETY
   ------
   - Creates indexes only. No data is read, written or deleted.
   - Cannot fire the two DML triggers on Services — CREATE INDEX is DDL.
   - Does take a brief schema-modification lock on Services per index. At
     6.6 MB that is well under a second each, but it is not zero: production
     and the old Blazor app read this same database. Run it in a quiet window.
   - Reversible: DROP INDEX <name> ON dbo.Services;
   - No SET PARSEONLY. It applies to SUBSEQUENT batches and does not make the
     batch containing it read-only — that is how three redundant indexes were
     once created here by a step meant to validate without executing.
   ===================================================================== */

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------
   BEFORE
   --------------------------------------------------------------------- */
SELECT
    Stage      = 'before',
    IndexName  = i.name,
    IndexType  = i.type_desc,
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
WHERE i.object_id = OBJECT_ID('dbo.Services')
  AND i.name IS NOT NULL
ORDER BY i.name;
GO


/* ---------------------------------------------------------------------
   1. IX_Services_ServiceDate

   The single most-used predicate in the system. All eight report pages send
   `forceServiceDateOnly=true`, which filters ServiceDate alone; the
   dashboard's today tile is a ServiceDate range; ServiceDate is the default
   sort for the ticket search.

   Those predicates are written half-open (`>= from AND < to+1day`) rather
   than CAST(col AS date) precisely so this index can be seeked.

   INCLUDE (ServiceStatusId): lets the dashboard's conditional counts and the
   report status filter resolve without a key lookup. One narrow int column.

   NOTE: likely ALREADY CREATED by the first run of this script. The guard
   below will skip it and report so.
   --------------------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes i
    JOIN sys.index_columns ic
      ON ic.object_id = i.object_id AND ic.index_id = i.index_id
     AND ic.key_ordinal = 1 AND ic.is_included_column = 0
    JOIN sys.columns c
      ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.Services')
      AND c.name = 'ServiceDate'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_ServiceDate
        ON dbo.Services (ServiceDate)
        INCLUDE (ServiceStatusId);
    PRINT 'created IX_Services_ServiceDate';
END
ELSE PRINT 'skipped IX_Services_ServiceDate - already present';
GO


/* ---------------------------------------------------------------------
   2. IX_Services_ServiceStatusId

   Replaces the intended (ServiceStatusId, ReportNo) composite, which cannot
   exist while ReportNo is NVARCHAR(MAX).

   Serves the status filter on every queue page and the dashboard's
   per-status counts. It does NOT remove the sort: the queue pages order by
   ReportNo, and that still has to be sorted in memory. Bounding ReportNo is
   what fixes the sort — this index only fixes the filter.

   ServiceStatusId is also a foreign key with no index today, so this covers
   what InitialCreate intended by IX_Services_ServiceStatusId as well.
   --------------------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes i
    JOIN sys.index_columns ic
      ON ic.object_id = i.object_id AND ic.index_id = i.index_id
     AND ic.key_ordinal = 1 AND ic.is_included_column = 0
    JOIN sys.columns c
      ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.Services')
      AND c.name = 'ServiceStatusId'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_ServiceStatusId
        ON dbo.Services (ServiceStatusId)
        INCLUDE (ServiceDate);
    PRINT 'created IX_Services_ServiceStatusId';
END
ELSE PRINT 'skipped IX_Services_ServiceStatusId - an index already leads with ServiceStatusId';
GO


/* ---------------------------------------------------------------------
   3. IX_Services_FinishedDate  — FILTERED

   GetDashboardStatsAsync counts tickets finished this month, and the
   status-scoped report branch filters on FinishedDate.

   Filtered to non-NULL: most tickets have never been finished, so this keeps
   the index to rows that can ever match. Every query using this column tests
   FinishedDate.HasValue first, so the filter matches how it is queried.
   --------------------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes i
    JOIN sys.index_columns ic
      ON ic.object_id = i.object_id AND ic.index_id = i.index_id
     AND ic.key_ordinal = 1 AND ic.is_included_column = 0
    JOIN sys.columns c
      ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.Services')
      AND c.name = 'FinishedDate'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_FinishedDate
        ON dbo.Services (FinishedDate)
        WHERE FinishedDate IS NOT NULL;
    PRINT 'created IX_Services_FinishedDate';
END
ELSE PRINT 'skipped IX_Services_FinishedDate - an index already leads with FinishedDate';
GO


/* ---------------------------------------------------------------------
   REMOVED FROM THIS SCRIPT — impossible until ReportNo is bounded

     IX_Services_Status_ReportNo  (ServiceStatusId, ReportNo)
     IX_Services_ReportNo         (ReportNo)

   Both need ReportNo as a key column; NVARCHAR(MAX) forbids it (error 1919).
   Run `sql/bound-services-string-columns.sql` on the staging database first,
   verify the app, then re-add these. They are the ones that remove the
   queue pages' sort.

   ALSO DELIBERATELY NOT CREATED
   -----------------------------
   IX_Services_ItemId / _ServiceTypeId / _ServicePriorityId
       EF declares these because it always indexes a foreign key. They do not
       help the queries this app runs: the projections join Services -> Items
       / ServiceTypes by seeking the TARGET table's primary key. An index on
       the Services side serves the opposite direction, which nothing asks.

   Anything on dbo.SparepartStockAuditLog or dbo.StockNotificationOutbox
       Already correctly indexed — verified from the live catalogue. The audit
       log takes a row per trigger fire, so it is the one table here where an
       extra index has a real ongoing write cost. Nothing needed.
   --------------------------------------------------------------------- */


/* ---------------------------------------------------------------------
   AFTER — expect PK_Services plus the three above
   --------------------------------------------------------------------- */
SELECT
    Stage      = 'after',
    IndexName  = i.name,
    IndexType  = i.type_desc,
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
WHERE i.object_id = OBJECT_ID('dbo.Services')
  AND i.name IS NOT NULL
ORDER BY i.name;
GO
