/* =====================================================================
   Reconcile the database's indexes with what the code declares
   =====================================================================

   Creates every index that is declared in the EF model or in a migration but
   missing from the database, EXCEPT the two that are impossible until
   ReportNo is bounded (see section 5).

   Supersedes create-services-indexes.sql. Safe to run after that script's
   partial failure — every guard checks KEY COLUMNS, so anything already
   created is skipped rather than duplicated under a new name.

   STARTING STATE, verified from the live catalogue 2026-08-19
   -----------------------------------------------------------
     dbo.Services                    PK_Services  ..................... and nothing else
     dbo.SparepartItems              IX_SparepartItems_SparepartId ..... present
                                     IX_SparepartItems_RepairServiceId . present (name drift, s.4)
     dbo.SparepartStockAuditLog      all four IX_AuditLog_* ............ present
     dbo.StockNotificationOutbox     all three IX_StockNotificationOutbox_* present

   So only dbo.Services needs work. The trigger-managed tables are already
   correct and are deliberately NOT touched — the audit log takes a row per
   trigger fire and is the one table here where an extra index would carry a
   real ongoing write cost.

   WHAT GETS CREATED
   -----------------
     s.2  IX_Services_ServiceDate        (ServiceDate) INCLUDE (ServiceStatusId)
          IX_Services_ServiceStatusId    (ServiceStatusId) INCLUDE (ServiceDate)
          IX_Services_FinishedDate       (FinishedDate) WHERE NOT NULL
     s.3  IX_Services_ItemId             (ItemId)
          IX_Services_ServiceTypeId      (ServiceTypeId)
          IX_Services_ServicePriorityId  (ServicePriorityId)

   Section 2 is for reads. Section 3 restores the four foreign-key indexes
   InitialCreate declares. Their read value is marginal — the projections join
   Services -> Items / ServiceTypes by seeking the TARGET table's primary key,
   which an index on the Services side does not serve. They are worth having
   anyway for a different reason: **an unindexed foreign key makes SQL Server
   scan the whole child table every time a parent row is deleted**, and this
   app deletes Items (DeleteItemCommand) and spare parts. On 3,666 rows that
   scan is cheap today and gets linearly worse. They also close the drift
   between the model and the database, which is the thing that made this whole
   class of bug invisible in the first place.

   IMPACT
   ------
   - Creates indexes only. No data read, written or deleted. No table other
     than dbo.Services is modified.
   - Cannot fire the two DML triggers on Services — CREATE INDEX is DDL.
   - Each CREATE takes a brief schema-modification lock on dbo.Services;
     readers and writers wait. At 6.6 MB each should be well under a second,
     but production and the old Blazor app share this database. Quiet window.
   - Each statement is its own batch, so one failure does not abandon the rest.
   - Reversible: DROP INDEX <name> ON dbo.Services;
   ===================================================================== */

SET NOCOUNT ON;

/* ---------------------------------------------------------------------
   REQUIRED SET OPTIONS — do not remove.

   Section 2.3 creates a FILTERED index, and SQL Server refuses to create one
   unless all seven of these are set correctly for the session:

       Msg 1934: CREATE INDEX failed because the following SET options have
       incorrect settings: 'QUOTED_IDENTIFIER'.

   Most GUI clients (SSMS, DBeaver) set them this way already, so the failure
   only appears under sqlcmd or a driver that does not — which makes it the
   kind of bug that passes in your editor and fails in a deployment pipeline.
   Caught here by rehearsing this script on a throwaway LocalDB copy before
   letting it near the real server.

   These are session settings and persist across the GO batches below.
   --------------------------------------------------------------------- */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

/* =====================================================================
   SECTION 0 — where am I, and what is already here?
   ===================================================================== */
SELECT
    CurrentDatabase = DB_NAME(),
    Note = CASE WHEN DB_NAME() = 'TechnicalServiceDB'
                THEN 'PRODUCTION - shared with the live site and the old Blazor app'
                ELSE 'not production' END;

SELECT
    Stage      = 'before',
    TableName  = OBJECT_NAME(i.object_id),
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
WHERE i.object_id IN (
        OBJECT_ID('dbo.Services'),
        OBJECT_ID('dbo.SparepartItems'),
        OBJECT_ID('dbo.SparepartStockAuditLog'),
        OBJECT_ID('dbo.StockNotificationOutbox'))
  AND i.name IS NOT NULL
ORDER BY TableName, IndexName;
GO


/* =====================================================================
   SECTION 1 — confirm the columns exist and are indexable

   Cheaper than discovering it mid-run, which is exactly how the previous
   attempt failed on ReportNo. max_length = -1 means MAX, which can never be
   an index key.
   ===================================================================== */
SELECT
    ColumnName  = c.name,
    DataType    = t.name,
    MaxChars    = CASE WHEN c.max_length = -1 THEN -1 ELSE c.max_length / 2 END,
    IsNullable  = c.is_nullable,
    UsableAsKey = CASE WHEN c.max_length = -1 THEN 'NO - LOB/MAX' ELSE 'yes' END
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.Services')
  AND c.name IN ('ServiceDate','ServiceStatusId','FinishedDate','ReportNo',
                 'ItemId','ServiceTypeId','ServicePriorityId')
ORDER BY UsableAsKey DESC, c.name;
GO


/* =====================================================================
   SECTION 2 — the indexes that actually serve queries
   ===================================================================== */

/* ---------------------------------------------------------------------
   2.1  IX_Services_ServiceDate

   The most-used predicate in the system. All eight report pages send
   forceServiceDateOnly=true, which filters ServiceDate alone; the dashboard's
   today tile is a ServiceDate range; ServiceDate is the default sort.

   Those predicates are written half-open (>= from AND < to+1day) rather than
   CAST(col AS date) precisely so this index can be seeked.

   INCLUDE (ServiceStatusId) covers the dashboard's conditional counts and the
   report status filter without a key lookup — one narrow int.

   Likely ALREADY CREATED by the earlier partial run; the guard will say so.
   --------------------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
     AND ic.key_ordinal = 1 AND ic.is_included_column = 0
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.Services') AND c.name = 'ServiceDate')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_ServiceDate
        ON dbo.Services (ServiceDate) INCLUDE (ServiceStatusId);
    PRINT '2.1 created IX_Services_ServiceDate';
END
ELSE PRINT '2.1 skipped  IX_Services_ServiceDate - already present';
GO

/* ---------------------------------------------------------------------
   2.2  IX_Services_ServiceStatusId

   Serves the status filter on every queue page and the dashboard's per-status
   counts, and doubles as the FK index InitialCreate declares.

   It does NOT remove the queue pages' sort — they order by ReportNo, which
   stays unindexable until section 5. This fixes the filter, not the sort.

   INCLUDE (ServiceDate) so a status+date question is answered from either
   this index or 2.1, whichever the optimiser prefers.
   --------------------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
     AND ic.key_ordinal = 1 AND ic.is_included_column = 0
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.Services') AND c.name = 'ServiceStatusId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_ServiceStatusId
        ON dbo.Services (ServiceStatusId) INCLUDE (ServiceDate);
    PRINT '2.2 created IX_Services_ServiceStatusId';
END
ELSE PRINT '2.2 skipped  IX_Services_ServiceStatusId - an index already leads with ServiceStatusId';
GO

/* ---------------------------------------------------------------------
   2.3  IX_Services_FinishedDate  — FILTERED

   GetDashboardStatsAsync counts tickets finished this month; the
   status-scoped report branch filters on FinishedDate.

   Filtered to non-NULL: most tickets have never been finished, so this keeps
   the index to rows that can match. Every query using the column tests
   FinishedDate.HasValue first, so the filter matches the access pattern.
   --------------------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
     AND ic.key_ordinal = 1 AND ic.is_included_column = 0
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.Services') AND c.name = 'FinishedDate')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_FinishedDate
        ON dbo.Services (FinishedDate) WHERE FinishedDate IS NOT NULL;
    PRINT '2.3 created IX_Services_FinishedDate';
END
ELSE PRINT '2.3 skipped  IX_Services_FinishedDate - already present';
GO


/* =====================================================================
   SECTION 3 — the foreign-key indexes InitialCreate declares

   Reason to have these is DELETE of a parent row, not SELECT. Without them
   SQL Server scans dbo.Services to enforce the FK every time an Item,
   ServiceType or ServicePriority row is removed.

   Each is guarded by column name so a differently-named existing index on the
   same column is respected rather than duplicated.
   ===================================================================== */

/* 3.1 ItemId — the one that matters most; DeleteItemCommand is a real path. */
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Services') AND name = 'ItemId')
   AND NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
     AND ic.key_ordinal = 1 AND ic.is_included_column = 0
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.Services') AND c.name = 'ItemId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_ItemId ON dbo.Services (ItemId);
    PRINT '3.1 created IX_Services_ItemId';
END
ELSE PRINT '3.1 skipped  IX_Services_ItemId';
GO

/* 3.2 ServiceTypeId */
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Services') AND name = 'ServiceTypeId')
   AND NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
     AND ic.key_ordinal = 1 AND ic.is_included_column = 0
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.Services') AND c.name = 'ServiceTypeId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_ServiceTypeId ON dbo.Services (ServiceTypeId);
    PRINT '3.2 created IX_Services_ServiceTypeId';
END
ELSE PRINT '3.2 skipped  IX_Services_ServiceTypeId';
GO

/* 3.3 ServicePriorityId */
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Services') AND name = 'ServicePriorityId')
   AND NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
     AND ic.key_ordinal = 1 AND ic.is_included_column = 0
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.object_id = OBJECT_ID('dbo.Services') AND c.name = 'ServicePriorityId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Services_ServicePriorityId ON dbo.Services (ServicePriorityId);
    PRINT '3.3 created IX_Services_ServicePriorityId';
END
ELSE PRINT '3.3 skipped  IX_Services_ServicePriorityId';
GO


/* =====================================================================
   SECTION 4 — the SparepartItems name drift

   The model declares IX_SparepartItems_ServiceId; the database has
   IX_SparepartItems_RepairServiceId. This is almost certainly a historical
   name from when the column was called RepairServiceId — the index itself is
   present and working, so nothing is broken.

   This section only REPORTS. It does not rename, because a rename is
   cosmetic and I cannot see from here which column the index is actually on.
   Read the KeyColumns value below:

     - if it says ServiceId   -> the name is merely stale; the optional rename
                                 at the bottom makes the model and database
                                 agree. sp_rename on an index is instant and
                                 does not rebuild anything.
     - if it says something else -> do NOT rename. Investigate instead; it
                                 means the schema differs from the model in a
                                 way this audit has not accounted for.
   ===================================================================== */
SELECT
    IndexName  = i.name,
    KeyColumns = STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        JOIN sys.columns c
          ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.is_included_column = 0
        ORDER BY ic.key_ordinal
        FOR XML PATH('')), 1, 2, ''),
    Guidance = 'rename only if KeyColumns reads exactly: ServiceId'
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.SparepartItems')
  AND i.name = 'IX_SparepartItems_RepairServiceId';
GO

-- OPTIONAL, only after reading the result above:
-- EXEC sp_rename N'dbo.SparepartItems.IX_SparepartItems_RepairServiceId',
--                N'IX_SparepartItems_ServiceId', N'INDEX';


/* =====================================================================
   SECTION 5 — what is STILL missing, and why this script cannot fix it

     IX_Services_Status_ReportNo   (ServiceStatusId, ReportNo)
     IX_Services_ReportNo          (ReportNo)

   Both need ReportNo as a KEY column, and ReportNo is NVARCHAR(MAX). A
   MAX/LOB column can never be an index key at any length — that is error 1919,
   which killed the first version of this script.

   This is not cosmetic. The queue pages filter by status and sort by ReportNo
   descending, then page by infinite scroll. Until ReportNo is bounded, SQL
   Server sorts the entire filtered set on every scroll batch, for every user,
   and no index can prevent it.

   Fix: run sql/bound-services-string-columns.sql, which converts ReportNo to
   NVARCHAR(50) (measured longest value across all 3,666 rows: 13 characters)
   and then creates both indexes. That script ALTERs a column on a live table,
   so rehearse it on TechnicalServiceDB_Staging first — see
   sql/create-staging-database.sql.
   ===================================================================== */
SELECT
    StillMissing = 'IX_Services_Status_ReportNo, IX_Services_ReportNo',
    BlockedBy    = 'ReportNo is ' + CASE
                     WHEN (SELECT max_length FROM sys.columns
                           WHERE object_id = OBJECT_ID('dbo.Services') AND name = 'ReportNo') = -1
                     THEN 'NVARCHAR(MAX) - cannot be an index key. Run bound-services-string-columns.sql.'
                     ELSE 'already bounded - you can create them now (section 3 of that script).'
                   END;
GO


/* =====================================================================
   SECTION 6 — verify

   Expect on dbo.Services: PK_Services plus six IX_Services_* indexes.
   Then update statistics so the optimiser plans against the new indexes
   immediately rather than waiting for its own thresholds.
   ===================================================================== */
SELECT
    Stage      = 'after',
    TableName  = OBJECT_NAME(i.object_id),
    IndexName  = i.name,
    IndexType  = i.type_desc,
    IsFiltered = i.has_filter,
    KeyColumns = STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        JOIN sys.columns c
          ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.is_included_column = 0
        ORDER BY ic.key_ordinal
        FOR XML PATH('')), 1, 2, ''),
    IncludedColumns = ISNULL(STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        JOIN sys.columns c
          ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.is_included_column = 1
        ORDER BY ic.index_column_id
        FOR XML PATH('')), 1, 2, ''), '')
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.Services') AND i.name IS NOT NULL
ORDER BY i.name;
GO

UPDATE STATISTICS dbo.Services WITH FULLSCAN;
PRINT 'statistics updated on dbo.Services';
GO

/* Row count must be unchanged — this script never touched data. */
SELECT TotalServices = COUNT(*) FROM dbo.Services;
GO
