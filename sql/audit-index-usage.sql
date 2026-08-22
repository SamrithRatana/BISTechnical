/* =====================================================================
   Index usage audit — READ ONLY
   =====================================================================

   Run against TechnicalServiceDB. Reads DMVs and catalogue views only:
   no data, no writes, no locks, no schema change.

   ⚠ READ THIS BEFORE TRUSTING SECTION 1
   -------------------------------------
   sys.dm_db_index_usage_stats is reset when the SQL Server instance
   restarts, and (on older builds) when a database is closed or detached.
   Counters that look like "this index is never used" may only mean "the
   service restarted last night". Section 0 prints how long the stats have
   been accumulating — if that is only a few hours, do NOT drop anything on
   the strength of it. A week of normal business, including a month-end
   close, is the minimum I would act on.

   Section 1 also lists only indexes that HAVE an entry in the DMV. An index
   that has never been touched since the last restart has no row at all,
   which is why section 2 re-lists everything from sys.indexes and marks the
   ones the DMV never saw.
   ===================================================================== */

SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
GO

/* ---------------------------------------------------------------------
   SECTION 0 — how much history do these numbers actually represent?
   --------------------------------------------------------------------- */
SELECT
    ServerStartTime   = sqlserver_start_time,
    StatsWindowHours  = DATEDIFF(hour, sqlserver_start_time, GETDATE()),
    StatsWindowDays   = DATEDIFF(day,  sqlserver_start_time, GETDATE()),
    Trustworthy       = CASE
        WHEN DATEDIFF(day, sqlserver_start_time, GETDATE()) >= 7
            THEN 'yes - a week or more of real traffic'
        WHEN DATEDIFF(day, sqlserver_start_time, GETDATE()) >= 2
            THEN 'partial - a few days; treat zero-use as unproven, not as evidence'
        ELSE 'NO - too short. Re-run after a week before dropping anything.' END
FROM sys.dm_os_sys_info;
GO


/* ---------------------------------------------------------------------
   SECTION 1 — usage stats, highest write cost / lowest read benefit first

   ReadsPerWrite is the number to scan: below ~0.1 an index is being
   maintained far more often than it is being used.
   --------------------------------------------------------------------- */
SELECT
    TableName     = OBJECT_NAME(s.object_id),
    IndexName     = i.name,
    IndexType     = i.type_desc,
    IsFiltered    = i.has_filter,
    Reads         = s.user_seeks + s.user_scans + s.user_lookups,
    user_seeks    = s.user_seeks,
    user_scans    = s.user_scans,
    user_lookups  = s.user_lookups,
    user_updates  = s.user_updates,
    ReadsPerWrite = CASE WHEN s.user_updates = 0 THEN NULL
                         ELSE CAST((s.user_seeks + s.user_scans + s.user_lookups) * 1.0
                                   / s.user_updates AS decimal(10,3)) END,
    last_user_seek = s.last_user_seek,
    last_user_scan = s.last_user_scan,
    Hint = CASE
        WHEN i.is_primary_key = 1 THEN 'primary key - never drop'
        WHEN (s.user_seeks + s.user_scans + s.user_lookups) = 0 AND s.user_updates > 1000
            THEN 'CANDIDATE: writes only, zero reads in this window'
        WHEN (s.user_seeks + s.user_scans + s.user_lookups) = 0
            THEN 'unused in this window (may just be a short window)'
        WHEN s.user_updates > 0
             AND (s.user_seeks + s.user_scans + s.user_lookups) * 1.0 / s.user_updates < 0.1
            THEN 'low benefit: under 0.1 reads per write'
        ELSE 'earning its keep' END
FROM sys.dm_db_index_usage_stats s
JOIN sys.indexes i
  ON i.object_id = s.object_id AND i.index_id = s.index_id
WHERE s.database_id = DB_ID('TechnicalServiceDB')
  AND OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1
ORDER BY s.user_updates DESC, Reads ASC;
GO


/* ---------------------------------------------------------------------
   SECTION 2 — every index, including ones the DMV has NEVER seen

   An index absent from section 1 is invisible there. This is where a
   genuinely dead index shows up, as NeverUsedSinceRestart = yes.
   --------------------------------------------------------------------- */
SELECT
    TableName  = OBJECT_NAME(i.object_id),
    IndexName  = i.name,
    IndexType  = i.type_desc,
    IsFiltered = i.has_filter,
    FilterText = ISNULL(i.filter_definition, ''),
    IsUnique   = i.is_unique,
    KeyColumns = STUFF((
        SELECT ', ' + c.name + CASE WHEN ic.is_descending_key = 1 THEN ' DESC' ELSE '' END
        FROM sys.index_columns ic
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.is_included_column = 0
        ORDER BY ic.key_ordinal
        FOR XML PATH('')), 1, 2, ''),
    IncludedColumns = ISNULL(STUFF((
        SELECT ', ' + c.name
        FROM sys.index_columns ic
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          AND ic.is_included_column = 1
        ORDER BY ic.index_column_id
        FOR XML PATH('')), 1, 2, ''), ''),
    SizeMB = CAST(SUM(ps.used_page_count) * 8.0 / 1024 AS decimal(10,2)),
    NeverUsedSinceRestart = CASE WHEN NOT EXISTS (
        SELECT 1 FROM sys.dm_db_index_usage_stats u
        WHERE u.database_id = DB_ID('TechnicalServiceDB')
          AND u.object_id = i.object_id AND u.index_id = i.index_id)
        THEN 'yes' ELSE 'no' END
FROM sys.indexes i
JOIN sys.dm_db_partition_stats ps
  ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
  AND i.name IS NOT NULL
GROUP BY i.object_id, i.index_id, i.name, i.type_desc, i.has_filter,
         i.filter_definition, i.is_unique
ORDER BY TableName, IndexName;
GO


/* ---------------------------------------------------------------------
   SECTION 3 — row counts and table sizes

   Context for every verdict: an index on a 3,000-row table rarely pays for
   itself, and "this query is slow" on a small table is usually not indexing.
   --------------------------------------------------------------------- */
SELECT
    TableName = t.name,
    NumRows   = SUM(CASE WHEN p.index_id IN (0,1) THEN p.rows ELSE 0 END),
    TotalMB   = CAST(SUM(a.total_pages) * 8.0 / 1024 AS decimal(10,2)),
    IndexMB   = CAST((SUM(a.used_pages) - SUM(CASE WHEN p.index_id IN (0,1)
                       THEN a.data_pages ELSE 0 END)) * 8.0 / 1024 AS decimal(10,2)),
    IndexCount = (SELECT COUNT(*) FROM sys.indexes x
                  WHERE x.object_id = t.object_id AND x.name IS NOT NULL)
FROM sys.tables t
JOIN sys.partitions p  ON p.object_id = t.object_id
JOIN sys.allocation_units a ON a.container_id = p.partition_id
GROUP BY t.name, t.object_id
ORDER BY NumRows DESC;
GO


/* ---------------------------------------------------------------------
   SECTION 4 — duplicate / overlapping indexes

   Pairs whose leading key column is the same. An exact key-list match is a
   true duplicate; a shared prefix means the narrower one is usually
   redundant, because an index on (A, B) also serves queries on (A) alone.
   This is the check that found IX_Services_ServiceStatusId redundant once
   the (ServiceStatusId, ReportNo) composite existed.
   --------------------------------------------------------------------- */
WITH k AS (
    SELECT i.object_id, i.index_id, i.name,
           Keys = STUFF((
               SELECT ',' + c.name
               FROM sys.index_columns ic
               JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                 AND ic.is_included_column = 0
               ORDER BY ic.key_ordinal
               FOR XML PATH('')), 1, 1, ''),
           LeadCol = (
               SELECT TOP 1 c.name
               FROM sys.index_columns ic
               JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                 AND ic.is_included_column = 0
               ORDER BY ic.key_ordinal)
    FROM sys.indexes i
    WHERE i.name IS NOT NULL AND OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
)
SELECT
    TableName = OBJECT_NAME(a.object_id),
    IndexA = a.name, KeysA = a.Keys,
    IndexB = b.name, KeysB = b.Keys,
    Relationship = CASE
        WHEN a.Keys = b.Keys THEN 'EXACT DUPLICATE - drop one'
        WHEN b.Keys LIKE a.Keys + ',%' THEN 'A is a prefix of B - A is probably redundant'
        ELSE 'same leading column only - review together' END
FROM k a
JOIN k b ON a.object_id = b.object_id AND a.index_id < b.index_id
        AND a.LeadCol = b.LeadCol
ORDER BY TableName, IndexA;
GO


/* ---------------------------------------------------------------------
   SECTION 5 — foreign keys with no supporting index

   An unindexed FK makes SQL Server scan the child table on every parent
   delete, and on some update paths.
   --------------------------------------------------------------------- */
SELECT
    ChildTable  = OBJECT_NAME(fk.parent_object_id),
    ForeignKey  = fk.name,
    ChildColumn = c.name,
    ParentTable = OBJECT_NAME(fk.referenced_object_id),
    Verdict     = 'no index leads with this column'
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc
  ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c
  ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE NOT EXISTS (
    SELECT 1
    FROM sys.index_columns ic
    WHERE ic.object_id = fkc.parent_object_id
      AND ic.column_id = fkc.parent_column_id
      AND ic.key_ordinal = 1
      AND ic.is_included_column = 0)
ORDER BY ChildTable, ChildColumn;
GO


/* ---------------------------------------------------------------------
   SECTION 6 — what the optimiser wishes it had

   Advisory only. These come from plans the optimiser compiled and are
   notoriously over-eager: it will ask for a wide INCLUDE list to avoid one
   lookup. Read them as "this column combination is being filtered often",
   not as DDL to paste. Never create one without checking it against
   section 4 first.
   --------------------------------------------------------------------- */
SELECT TOP 20
    TableName    = OBJECT_NAME(d.object_id),
    EqualityCols = ISNULL(d.equality_columns, ''),
    InequalityCols = ISNULL(d.inequality_columns, ''),
    IncludeCols  = ISNULL(d.included_columns, ''),
    UniqueCompiles = gs.unique_compiles,
    AvgImpactPct = CAST(gs.avg_user_impact AS decimal(6,2)),
    Seeks = gs.user_seeks,
    Scans = gs.user_scans
FROM sys.dm_db_missing_index_details d
JOIN sys.dm_db_missing_index_groups g  ON g.index_handle = d.index_handle
JOIN sys.dm_db_missing_index_group_stats gs ON gs.group_handle = g.index_group_handle
WHERE d.database_id = DB_ID('TechnicalServiceDB')
ORDER BY gs.avg_user_impact * (gs.user_seeks + gs.user_scans) DESC;
GO
