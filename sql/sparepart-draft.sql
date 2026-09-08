/*
  sql/sparepart-draft.sql — Spare-part Draft / Hidden feature

  Adds the IsDraft column to dbo.Spareparts and indexes it.

  When a spare part is marked IsDraft = 1:
    - It is hidden from all general search and selection dropdowns across the system (tickets, reports, inspections).
    - Historical ticket data and existing SparepartItems referencing it continue to display normally.
    - It can be viewed and restored (undrafted) from the Catalogue (/spareparts) page using the Draft badge filter.

  Idempotent: safe to run more than once. Wrapped in one transaction.
*/

SET XACT_ABORT ON;
SET NOCOUNT ON;
GO

BEGIN TRANSACTION;
GO

-- ── 1. Column IsDraft ───────────────────────────────────────────────────────
IF COL_LENGTH(N'dbo.Spareparts', N'IsDraft') IS NULL
BEGIN
    ALTER TABLE dbo.Spareparts
        ADD IsDraft BIT NOT NULL
            CONSTRAINT DF_Spareparts_IsDraft DEFAULT 0;
END;
GO

-- ── 2. Index for filtering ──────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Spareparts_IsDraft'
      AND object_id = OBJECT_ID(N'dbo.Spareparts', N'U')
)
BEGIN
    CREATE INDEX IX_Spareparts_IsDraft
        ON dbo.Spareparts (IsDraft);
END;
GO

COMMIT TRANSACTION;
GO
