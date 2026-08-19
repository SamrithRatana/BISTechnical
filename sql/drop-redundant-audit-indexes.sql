/* =====================================================================
   Remove three redundant indexes on dbo.SparepartStockAuditLog
   =====================================================================

   These three were created on TechnicalServiceDB on 2026-08-18 by a
   validation step that was supposed to be parse-only and was not
   (`SET PARSEONLY ON` applies to SUBSEQUENT batches; the batch it appears
   in has already been compiled, so it executes normally).

   They duplicate the key columns of indexes that were already there:

     created (redundant)                            duplicates
     ------------------------------------------     -------------------------------
     IX_SparepartStockAuditLog_Timestamp             IX_AuditLog_Timestamp
     IX_SparepartStockAuditLog_SparepartId_Timestamp IX_AuditLog_SparepartId_Timestamp
     IX_SparepartStockAuditLog_ServiceId             IX_AuditLog_ServiceId

   Key columns match exactly in each pair; only the INCLUDE lists differ
   slightly, and the surviving indexes cover every column the ledger
   queries read. Dropping these costs no query plan and returns the write
   overhead and space.

   No data is touched. Indexes only.
   ===================================================================== */

SET NOCOUNT ON;

/* ---- Before ---- */
SELECT Stage = 'before', IndexName = name
FROM sys.indexes
WHERE object_id = OBJECT_ID('dbo.SparepartStockAuditLog') AND name IS NOT NULL
ORDER BY name;
GO

DROP INDEX IF EXISTS IX_SparepartStockAuditLog_Timestamp
    ON dbo.SparepartStockAuditLog;
GO

DROP INDEX IF EXISTS IX_SparepartStockAuditLog_SparepartId_Timestamp
    ON dbo.SparepartStockAuditLog;
GO

DROP INDEX IF EXISTS IX_SparepartStockAuditLog_ServiceId
    ON dbo.SparepartStockAuditLog;
GO

/* ---- After: expect PK + the four IX_AuditLog_* only ---- */
SELECT Stage = 'after', IndexName = name
FROM sys.indexes
WHERE object_id = OBJECT_ID('dbo.SparepartStockAuditLog') AND name IS NOT NULL
ORDER BY name;
GO
