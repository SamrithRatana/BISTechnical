/* =====================================================================
   Read-only verification: did the index work actually land?
   =====================================================================

   Run this in DBeaver against TechnicalServiceDB and read the Verdict column.
   It reads catalogue views only — no data, no writes, no locks.

   EXPECTED after running fix-all-missing-indexes.sql AND
   bound-services-string-columns.sql:

     ReportNo type ........ nvarchar(50)          not -1 / MAX
     Index count .......... 8                     PK + 7
     Composite present .... IX_Services_Status_ReportNo
     Narrow index gone .... IX_Services_ServiceStatusId   (superseded)
     Filtered index ....... IX_Services_FinishedDate      has_filter = 1
   ===================================================================== */

SET NOCOUNT ON;

/* ---- 1. the column that gates everything ---- */
SELECT
    Check_ = '1. ReportNo type',
    Actual = t.name + '(' + CASE WHEN c.max_length = -1
                                 THEN 'MAX' ELSE CAST(c.max_length / 2 AS varchar(10)) END + ')',
    Verdict = CASE WHEN c.max_length = -1
                   THEN 'NOT DONE - still MAX, the two ReportNo indexes cannot exist'
                   ELSE 'OK - bounded, indexable' END
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.Services') AND c.name = 'ReportNo';

/* ---- 2. every index now on dbo.Services ---- */
SELECT
    Check_     = '2. index',
    IndexName  = i.name,
    IsFiltered = i.has_filter,
    KeyColumns = STUFF((
        SELECT ', ' + c.name
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
        FOR XML PATH('')), 1, 2, ''), '')
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.Services') AND i.name IS NOT NULL
ORDER BY i.name;

/* ---- 3. the specific ones that matter, as a pass/fail list ---- */
SELECT Check_ = '3. expected set', IndexName = v.name,
       Present = CASE WHEN EXISTS (SELECT 1 FROM sys.indexes
                                   WHERE object_id = OBJECT_ID('dbo.Services') AND name = v.name)
                      THEN 'yes' ELSE 'MISSING' END,
       ShouldBe = v.expected
FROM (VALUES
    ('IX_Services_ServiceDate',       'present'),
    ('IX_Services_FinishedDate',      'present'),
    ('IX_Services_ItemId',            'present'),
    ('IX_Services_ServiceTypeId',     'present'),
    ('IX_Services_ServicePriorityId', 'present'),
    ('IX_Services_Status_ReportNo',   'present  (needs bounded ReportNo)'),
    ('IX_Services_ReportNo',          'present  (needs bounded ReportNo)'),
    ('IX_Services_ServiceStatusId',   'ABSENT   (dropped, superseded by the composite)')
) AS v(name, expected);

/* ---- 4. data sanity: nothing should have changed ---- */
SELECT
    Check_          = '4. data',
    TotalRows       = COUNT(*),
    NullOrEmptyRepNo= SUM(CASE WHEN ReportNo IS NULL OR ReportNo = '' THEN 1 ELSE 0 END),
    LongestReportNo = MAX(LEN(ReportNo)),
    DistinctReportNo= COUNT(DISTINCT ReportNo)
FROM dbo.Services;

/* ---- 5. does the queue query avoid a Sort now?  (the whole point)
        Run the query, then read the plan. A Sort here means the composite
        is not being used the way it should be. ---- */
SET STATISTICS XML ON;
SELECT s.Id, s.ReportNo, s.ServiceDate
FROM dbo.Services s
WHERE s.ServiceStatusId = (SELECT TOP 1 Id FROM dbo.ServiceStatuses WHERE Name = 'Finished')
ORDER BY s.ReportNo DESC
OFFSET 0 ROWS FETCH NEXT 25 ROWS ONLY;
SET STATISTICS XML OFF;
