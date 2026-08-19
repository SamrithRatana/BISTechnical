/* =====================================================================
   Sparepart stock ledger — historical backfill
   =====================================================================

   The stock triggers were installed around March 2026. Every service-sourced
   part fitted before that moved stock without leaving an audit row, so the
   corrected usage report (which now reads `SparepartStockAuditLog.Timestamp`)
   reports ZERO for those months. Measured on 2026-08-18:

       2025-09 .. 2026-02   old query 55/118/63/122/94/87   ledger 0
       2026-03 onward       ledger present and correct

   This script reconstructs the missing rows from `Services` x
   `SparepartItems` so the whole history answers to one rule.

   ── Read this before running ──────────────────────────────────────────

   1. IT DOES NOT TOUCH STOCK, AND IT CANNOT FIRE A TRIGGER.

      Verified against the live database on 2026-08-18, not assumed:

          SELECT COUNT(*) FROM sys.triggers
          WHERE parent_id = OBJECT_ID('dbo.SparepartStockAuditLog');   -- 0

      All seven triggers in this database sit on other tables — `Services`
      (`trg_AutoGenerateReportNo`, `trg_Services_AfterUpdate_StatusToRepairing`),
      `SparepartItems` (the three stock ones), `SparepartManualStockOut`, and
      `Spareparts` (`trg_Spareparts_AuditQuantity`). This script INSERTs into
      `SparepartStockAuditLog` and nothing else, so none of them can fire.

      `Spareparts.Quantity` is never read and never written, so no stock level
      moves and the `SkipDirectQuantityAudit` session-context guard is not
      involved at all — that flag only matters to code paths that update
      `Spareparts`, which this is not. Re-run the query above yourself if you
      want to confirm it before committing.

   2. THE ROWS ARE MARKED — VIA REMARKS, NOT OperationType.

      `OperationType` cannot carry a new value. The table has a CHECK
      constraint that this script's first draft ran headlong into:

          CK_AuditLog_OperationType:
              OperationType IN ('STOCK_ADJUSTED', 'STOCK_OUT', 'STOCK_IN')

      So reconstructed rows use the legitimate `'STOCK_OUT'` and are
      identified by a `Remarks` prefix instead — `BACKFILL:` — which the
      queries below match on. Every such row is also recognisable
      structurally: it is the only kind with `OldQuantity = NewQuantity = 0`
      (see point 4), and the triggers never write that pair.

      If you would rather have a first-class marker, extend the constraint
      first and switch `@BackfillOp` below:

          ALTER TABLE dbo.SparepartStockAuditLog
              DROP CONSTRAINT CK_AuditLog_OperationType;
          ALTER TABLE dbo.SparepartStockAuditLog
              ADD CONSTRAINT CK_AuditLog_OperationType CHECK
              (OperationType IN ('STOCK_ADJUSTED','STOCK_OUT','STOCK_IN',
                                 'STOCK_OUT_BACKFILL'));

      That is a schema change and is deliberately NOT done here. Note the
      report counts these rows either way — it keys on `QuantityChange <> 0`,
      never on the operation name.

      Two sibling constraints also apply and this script satisfies both:
      `CK_AuditLog_OldQuantity` and `CK_AuditLog_NewQuantity` require >= 0.

   3. THE DATE IS AN ESTIMATE, AND AN INFORMED ONE. Spare parts are attached
      to a ticket by `InspectItemCommand` / `UpdateInspectItemCommand`, which
      call `Service.SetInspection(inspectBy, inspectDate, ...)` in the same
      unit of work as `AddSparepartItem`. So `Services.InspectDate` is the
      moment the `SparepartItems` row was written — precisely when the
      trigger would have fired had it existed. `ServiceDate` is the fallback
      when a ticket has no InspectDate.

   4. OldQuantity / NewQuantity ARE ZERO, ON PURPOSE. The running balance at
      a past moment cannot be recovered without replaying every movement,
      and inventing one would corrupt the reconciliation check. Zero here
      means "not known", and section 4 keeps these rows out of the identity
      that reads those columns. `QuantityChange` and `Timestamp` — the two
      fields the report actually uses — are the two this script can state
      truthfully.

   5. IT IS IDEMPOTENT. Rows are skipped where an audit row already exists
      for that (ServiceId, SparepartId). Re-running adds nothing.

   Run sections 1 and 2 and read them. Only then run section 3.
   ===================================================================== */

SET NOCOUNT ON;

/* ---------------------------------------------------------------------
   1. WHERE DOES THE REAL LEDGER START?

   Everything before this is the gap being filled. Sanity-check the date
   against when you know the triggers were deployed.
   --------------------------------------------------------------------- */

SELECT
    LedgerStart      = MIN(Timestamp),
    LedgerEnd        = MAX(Timestamp),
    TriggerRows      = COUNT(*),
    ServiceRows      = SUM(CASE WHEN ServiceId IS NOT NULL THEN 1 ELSE 0 END),
    ManualRows       = SUM(CASE WHEN ServiceId IS NULL     THEN 1 ELSE 0 END),
    AlreadyBackfilled= SUM(CASE WHEN Remarks LIKE 'BACKFILL:%' THEN 1 ELSE 0 END)
FROM dbo.SparepartStockAuditLog;
GO


/* ---------------------------------------------------------------------
   2. PREVIEW — exactly what section 3 would insert, and nothing else.

   The two queries share one definition, kept in a view-like CTE so the
   preview cannot drift from the insert. Read the monthly rollup first,
   then spot-check the detail.

   Excluded, matching what the triggers themselves would have done:
     - IsHoldStatus = 1  (a hold reserves stock, it does not move it; the
                          triggers log these with QuantityChange = 0)
     - Quantity <= 0     (nothing moved)
     - SparepartId empty (no part to attribute it to)
     - any (ServiceId, SparepartId) that already has an audit row
   --------------------------------------------------------------------- */

WITH LedgerStart AS (
    SELECT StartsAt = MIN(Timestamp) FROM dbo.SparepartStockAuditLog
),
Candidates AS (
    SELECT
        si.ServiceId,
        si.SparepartId,
        si.Quantity,
        MovedAt     = COALESCE(svc.InspectDate, svc.ServiceDate),
        PerformedBy = COALESCE(svc.InspectBy, svc.CreateBy),
        svc.ReportNo,
        DateSource  = CASE WHEN svc.InspectDate IS NOT NULL
                           THEN 'InspectDate' ELSE 'ServiceDate' END,
        /* 'gap' = the history this script exists to fill.
           'LIVE-TRIGGER-MISS' = a part that moved while the triggers were
           already running and left no row. Expect none. Any row here is a
           finding: investigate before committing. */
        Era         = CASE WHEN COALESCE(svc.InspectDate, svc.ServiceDate) < ls.StartsAt
                           THEN 'gap' ELSE 'LIVE-TRIGGER-MISS' END
    FROM dbo.SparepartItems si
    JOIN dbo.Services svc ON svc.Id = si.ServiceId
    CROSS JOIN LedgerStart ls
    WHERE si.IsHoldStatus = 0
      AND si.Quantity > 0
      AND si.SparepartId <> '00000000-0000-0000-0000-000000000000'
      /* The spare part must still exist. `FK_AuditLog_Spareparts` points
         SparepartId at `Spareparts.Id`, and 33 SparepartItems rows (measured
         2026-08-18) reference a part that has since been deleted from the
         catalogue. Without this guard the FK rejects those rows, and because
         the backfill is ONE insert statement, all 1,433 rows roll back — the
         whole script fails on 2% of its input. Those 33 are reported
         separately in section 5 rather than silently dropped. */
      AND EXISTS (SELECT 1 FROM dbo.Spareparts sp WHERE sp.Id = si.SparepartId)
      /* The ONLY exclusion that matters: never write a second row for a
         movement a trigger already recorded.

         Deliberately not also filtered to `MovedAt < ls.StartsAt`. A ticket
         inspected in February and edited again in April carries an April
         InspectDate (`UpdateInspectItemCommand` re-stamps it), so a date
         cutoff would silently skip its February parts even though they have
         no audit row at all. Absence of a trigger row is the precise test;
         the date is not.

         The flip side is worth watching rather than hiding: any candidate
         dated AFTER `LedgerStart` means a part moved while the triggers were
         live and no row was written. The preview groups by month so those
         stand out — investigate them before committing rather than papering
         over a trigger that is not firing. */
      AND NOT EXISTS (
            SELECT 1 FROM dbo.SparepartStockAuditLog l
            WHERE l.ServiceId = si.ServiceId
              AND l.SparepartId = si.SparepartId)
)
SELECT
    Period      = FORMAT(MovedAt, 'yyyy-MM'),
    Era,
    DateSource,
    Movements   = COUNT(*),
    UnitsOut    = SUM(Quantity),
    Parts       = COUNT(DISTINCT SparepartId),
    Tickets     = COUNT(DISTINCT ServiceId),
    Earliest    = MIN(MovedAt),
    Latest      = MAX(MovedAt)
FROM Candidates
GROUP BY FORMAT(MovedAt, 'yyyy-MM'), Era, DateSource
ORDER BY Period, Era, DateSource;
GO


/* ---------------------------------------------------------------------
   3. THE INSERT

   Wrapped in an explicit transaction that ROLLS BACK by default. Run it,
   read the row count and the post-insert monthly rollup it prints, and only
   then change the last line to COMMIT and run it again.
   --------------------------------------------------------------------- */

BEGIN TRANSACTION;

WITH Candidates AS (
    SELECT
        si.ServiceId,
        si.SparepartId,
        si.Quantity,
        MovedAt     = COALESCE(svc.InspectDate, svc.ServiceDate),
        PerformedBy = COALESCE(svc.InspectBy, svc.CreateBy),
        svc.ReportNo
    FROM dbo.SparepartItems si
    JOIN dbo.Services svc ON svc.Id = si.ServiceId
    WHERE si.IsHoldStatus = 0
      AND si.Quantity > 0
      AND si.SparepartId <> '00000000-0000-0000-0000-000000000000'
      /* The spare part must still exist. `FK_AuditLog_Spareparts` points
         SparepartId at `Spareparts.Id`, and 33 SparepartItems rows (measured
         2026-08-18) reference a part that has since been deleted from the
         catalogue. Without this guard the FK rejects those rows, and because
         the backfill is ONE insert statement, all 1,433 rows roll back — the
         whole script fails on 2% of its input. Those 33 are reported
         separately in section 5 rather than silently dropped. */
      AND EXISTS (SELECT 1 FROM dbo.Spareparts sp WHERE sp.Id = si.SparepartId)
      /* Same single test as the preview — absence of a trigger row. Keep
         these two WHERE clauses identical or the preview stops predicting
         the insert. */
      AND NOT EXISTS (
            SELECT 1 FROM dbo.SparepartStockAuditLog l
            WHERE l.ServiceId = si.ServiceId
              AND l.SparepartId = si.SparepartId)
)
INSERT INTO dbo.SparepartStockAuditLog
    (Id, SparepartId, ServiceId, OperationType,
     QuantityChange, OldQuantity, NewQuantity, Timestamp, PerformedBy, Remarks)
SELECT
    NEWID(),
    c.SparepartId,
    c.ServiceId,
    'STOCK_OUT',     -- CK_AuditLog_OperationType allows only three values;
                     -- the BACKFILL: prefix on Remarks is the marker.
    -c.Quantity,     -- the log stores an outflow as negative
    0,               -- balance at that moment is unrecoverable; see header (4)
    0,
    c.MovedAt,
    c.PerformedBy,
    CONCAT('BACKFILL: reconstructed from SparepartItems on ',
           CONVERT(varchar(10), GETDATE(), 120),
           ' for ticket ', COALESCE(c.ReportNo, '(no report no)'),
           '. Predates the stock triggers; date taken from the ticket''s ',
           'inspection stamp. Balances not reconstructable.')
FROM Candidates c;

SELECT RowsInserted = @@ROWCOUNT;

/* Post-insert view of the whole ledger, so the gap can be seen to have
   closed before anything is committed. */
SELECT
    Period    = FORMAT(Timestamp, 'yyyy-MM'),
    Source    = CASE WHEN Remarks LIKE 'BACKFILL:%'
                     THEN 'backfilled' ELSE 'trigger' END,
    Movements = COUNT(*),
    UnitsOut  = -SUM(CASE WHEN QuantityChange < 0 THEN QuantityChange ELSE 0 END),
    UnitsIn   =  SUM(CASE WHEN QuantityChange > 0 THEN QuantityChange ELSE 0 END)
FROM dbo.SparepartStockAuditLog
WHERE QuantityChange <> 0
GROUP BY FORMAT(Timestamp, 'yyyy-MM'),
         CASE WHEN Remarks LIKE 'BACKFILL:%'
              THEN 'backfilled' ELSE 'trigger' END
ORDER BY Period, Source;

/* ── Change to COMMIT TRANSACTION once the numbers above look right. ── */
ROLLBACK TRANSACTION;
GO


/* ---------------------------------------------------------------------
   4. RECONCILIATION AFTER BACKFILL

   `sparepart-stock-ledger.sql` section 2 checks that a part's ledger agrees
   with its stock, by reading `OldQuantity` on the first movement and
   `NewQuantity` on the last. Backfilled rows carry zeros in both — they are
   the one thing this script could not recover — so they must be excluded
   from that identity or every part would report a false mismatch.

   This is the same check, scoped to the period the triggers actually
   governed. A clean result is ZERO ROWS. Use this one instead of the
   original section 2 once a backfill has been committed.
   --------------------------------------------------------------------- */

WITH Real AS (
    SELECT *
    FROM dbo.SparepartStockAuditLog
    WHERE QuantityChange <> 0
      AND (Remarks IS NULL OR Remarks NOT LIKE 'BACKFILL:%')
),
Bounds AS (
    SELECT SparepartId,
           NetChange    = SUM(CAST(QuantityChange AS BIGINT)),
           MovementRows = COUNT(*)
    FROM Real GROUP BY SparepartId
),
Edges AS (
    SELECT b.SparepartId, b.NetChange, b.MovementRows,
           Opening = (SELECT TOP 1 r.OldQuantity FROM Real r
                      WHERE r.SparepartId = b.SparepartId
                      ORDER BY r.Timestamp ASC, r.Id ASC),
           Closing = (SELECT TOP 1 r.NewQuantity FROM Real r
                      WHERE r.SparepartId = b.SparepartId
                      ORDER BY r.Timestamp DESC, r.Id DESC)
    FROM Bounds b
)
SELECT
    sp.Id, sp.ItemName, sp.SerialNumber,
    CurrentQuantity = sp.Quantity,
    e.Opening, e.Closing, e.NetChange, e.MovementRows,
    LedgerInternallyInconsistent =
        CASE WHEN e.Closing - e.Opening <> e.NetChange THEN 1 ELSE 0 END,
    LedgerDisagreesWithStock =
        CASE WHEN e.Closing <> sp.Quantity THEN 1 ELSE 0 END
FROM Edges e
JOIN dbo.Spareparts sp ON sp.Id = e.SparepartId
WHERE e.Closing - e.Opening <> e.NetChange
   OR e.Closing <> sp.Quantity
ORDER BY ABS(e.Closing - sp.Quantity) DESC;
GO

/* ---------------------------------------------------------------------
   5. WHAT THE BACKFILL DELIBERATELY LEAVES OUT

   Spare parts that were used on a ticket and have since been deleted from
   the `Spareparts` catalogue. `FK_AuditLog_Spareparts` will not accept a
   ledger row pointing at a part that no longer exists, so these cannot be
   reconstructed — the stock movement is real but there is no longer a part
   to attribute it to.

   Measured 2026-08-18: 33 rows / 33 units, all between 2025-01-20 and
   2025-04-03, i.e. entirely inside the pre-trigger gap. They are 2% of the
   1,433 candidates and they are the reason the guard exists: without it the
   FK rejects them and the single INSERT rolls back ALL 1,433.

   Listed here so the shortfall is visible and explainable rather than a
   number that quietly does not add up. If these matter, the fix is to
   restore the missing catalogue rows first, then re-run section 3 — it is
   idempotent, so already-backfilled movements are skipped.
   --------------------------------------------------------------------- */

SELECT
    si.SparepartId,
    MissingFromCatalogue = 'yes',
    Movements = COUNT(*),
    Units     = SUM(si.Quantity),
    Earliest  = MIN(COALESCE(svc.InspectDate, svc.ServiceDate)),
    Latest    = MAX(COALESCE(svc.InspectDate, svc.ServiceDate)),
    Tickets   = STUFF((SELECT TOP 5 ', ' + s2.ReportNo
                       FROM dbo.SparepartItems si2
                       JOIN dbo.Services s2 ON s2.Id = si2.ServiceId
                       WHERE si2.SparepartId = si.SparepartId
                       FOR XML PATH('')), 1, 2, '')
FROM dbo.SparepartItems si
JOIN dbo.Services svc ON svc.Id = si.ServiceId
WHERE si.IsHoldStatus = 0
  AND si.Quantity > 0
  AND si.SparepartId <> '00000000-0000-0000-0000-000000000000'
  AND NOT EXISTS (SELECT 1 FROM dbo.SparepartStockAuditLog l
                  WHERE l.ServiceId = si.ServiceId AND l.SparepartId = si.SparepartId)
  AND NOT EXISTS (SELECT 1 FROM dbo.Spareparts sp WHERE sp.Id = si.SparepartId)
GROUP BY si.SparepartId
ORDER BY SUM(si.Quantity) DESC;
GO
