/*
  sql/sparepart-taxonomy.sql — Spare-part Category / Type / Brand

  Adds the three lookup tables and links Spareparts to them.

    SparepartCategories  (Printer part, Photocopy part, …)
      └─ SparepartTypes  (ADF, PrintHead, Cable, …)   one category each
    SparepartBrands      (HP, CANON, …)                 name stored UPPER-CASE

    Spareparts.CategoryId / TypeId / BrandId  — nullable FKs, ON DELETE NO ACTION

  Idempotent: safe to run more than once. Wrapped in one transaction; note that with XACT_ABORT ON a failing batch rolls back and aborts only that batch, so later GO batches still run in autocommit and the final COMMIT then errors — re-run the script (it is idempotent) after fixing the cause.

  Why a hand-written script and not an EF migration: the model snapshot in
  TechnicalService.Infrastructure/Migrations is already behind the live schema
  (Spareparts.DefaultPrice exists in the database but not in the snapshot), and
  MigrationHostedService runs Database.MigrateAsync() at API start-up. A generated
  migration would try to re-add DefaultPrice and the API would fail to boot.
  The EF entity configurations mirror this script exactly; keep them in step.

  Verified before writing: trg_Spareparts_AuditQuantity (the only trigger on
  Spareparts) uses explicit column lists and only reacts to Quantity, so the
  new columns do not affect it.
*/

SET XACT_ABORT ON;
SET NOCOUNT ON;
GO

BEGIN TRANSACTION;
GO

-- ── 1. SparepartCategories ────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.SparepartCategories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SparepartCategories (
        Id          UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT DF_SparepartCategories_Id DEFAULT NEWSEQUENTIALID(),
        Name        NVARCHAR(100)    NOT NULL,
        Description NVARCHAR(500)    NULL,
        SortOrder   INT              NOT NULL
                    CONSTRAINT DF_SparepartCategories_SortOrder DEFAULT 0,
        CreatedAt   DATETIME2        NOT NULL
                    CONSTRAINT DF_SparepartCategories_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt   DATETIME2        NULL,
        CONSTRAINT PK_SparepartCategories PRIMARY KEY (Id)
    );

    CREATE UNIQUE INDEX UX_SparepartCategories_Name
        ON dbo.SparepartCategories (Name);

    CREATE INDEX IX_SparepartCategories_SortOrder
        ON dbo.SparepartCategories (SortOrder);
END;
GO

-- ── 2. SparepartTypes (child of a category) ───────────────────────────────
IF OBJECT_ID(N'dbo.SparepartTypes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SparepartTypes (
        Id          UNIQUEIDENTIFIER NOT NULL
                    CONSTRAINT DF_SparepartTypes_Id DEFAULT NEWSEQUENTIALID(),
        CategoryId  UNIQUEIDENTIFIER NOT NULL,
        Name        NVARCHAR(100)    NOT NULL,
        Description NVARCHAR(500)    NULL,
        SortOrder   INT              NOT NULL
                    CONSTRAINT DF_SparepartTypes_SortOrder DEFAULT 0,
        CreatedAt   DATETIME2        NOT NULL
                    CONSTRAINT DF_SparepartTypes_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt   DATETIME2        NULL,
        CONSTRAINT PK_SparepartTypes PRIMARY KEY (Id),
        CONSTRAINT FK_SparepartTypes_SparepartCategories_CategoryId
            FOREIGN KEY (CategoryId) REFERENCES dbo.SparepartCategories (Id)
            ON DELETE NO ACTION
    );

    -- Unique within a category; leading column also serves "types of category X".
    CREATE UNIQUE INDEX UX_SparepartTypes_CategoryId_Name
        ON dbo.SparepartTypes (CategoryId, Name);
END;
GO

-- ── 3. SparepartBrands ────────────────────────────────────────────────────
IF OBJECT_ID(N'dbo.SparepartBrands', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SparepartBrands (
        Id        UNIQUEIDENTIFIER NOT NULL
                  CONSTRAINT DF_SparepartBrands_Id DEFAULT NEWSEQUENTIALID(),
        Name      NVARCHAR(100)    NOT NULL,
        LogoUrl   NVARCHAR(1000)   NULL,
        CreatedAt DATETIME2        NOT NULL
                  CONSTRAINT DF_SparepartBrands_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2        NULL,
        CONSTRAINT PK_SparepartBrands PRIMARY KEY (Id),
        -- Brand names are upper-case by rule. A binary collation makes the
        -- comparison case-sensitive, so 'hp' is rejected and 'HP' accepted;
        -- scripts without case (Khmer) are unaffected by UPPER().
        CONSTRAINT CK_SparepartBrands_Name_Upper
            CHECK (Name COLLATE Latin1_General_BIN2 = UPPER(Name) COLLATE Latin1_General_BIN2)
    );

    CREATE UNIQUE INDEX UX_SparepartBrands_Name
        ON dbo.SparepartBrands (Name);
END;
GO

-- ── 4. Spareparts: nullable classification columns ────────────────────────
-- Nullable because the existing catalogue (695 rows at the time of writing)
-- has no classification yet; it is filled in from the UI over time.
IF COL_LENGTH(N'dbo.Spareparts', N'CategoryId') IS NULL
    ALTER TABLE dbo.Spareparts ADD CategoryId UNIQUEIDENTIFIER NULL;
IF COL_LENGTH(N'dbo.Spareparts', N'TypeId') IS NULL
    ALTER TABLE dbo.Spareparts ADD TypeId UNIQUEIDENTIFIER NULL;
IF COL_LENGTH(N'dbo.Spareparts', N'BrandId') IS NULL
    ALTER TABLE dbo.Spareparts ADD BrandId UNIQUEIDENTIFIER NULL;
GO

-- ── 5. Spareparts: foreign keys (a lookup in use cannot be deleted) ───────
IF OBJECT_ID(N'dbo.FK_Spareparts_SparepartCategories_CategoryId', N'F') IS NULL
    ALTER TABLE dbo.Spareparts
        ADD CONSTRAINT FK_Spareparts_SparepartCategories_CategoryId
        FOREIGN KEY (CategoryId) REFERENCES dbo.SparepartCategories (Id)
        ON DELETE NO ACTION;

IF OBJECT_ID(N'dbo.FK_Spareparts_SparepartTypes_TypeId', N'F') IS NULL
    ALTER TABLE dbo.Spareparts
        ADD CONSTRAINT FK_Spareparts_SparepartTypes_TypeId
        FOREIGN KEY (TypeId) REFERENCES dbo.SparepartTypes (Id)
        ON DELETE NO ACTION;

IF OBJECT_ID(N'dbo.FK_Spareparts_SparepartBrands_BrandId', N'F') IS NULL
    ALTER TABLE dbo.Spareparts
        ADD CONSTRAINT FK_Spareparts_SparepartBrands_BrandId
        FOREIGN KEY (BrandId) REFERENCES dbo.SparepartBrands (Id)
        ON DELETE NO ACTION;
GO

-- ── 6. Spareparts: filter indexes (every list-filter column is indexed) ───
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Spareparts_CategoryId' AND object_id = OBJECT_ID(N'dbo.Spareparts'))
    CREATE INDEX IX_Spareparts_CategoryId ON dbo.Spareparts (CategoryId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Spareparts_TypeId' AND object_id = OBJECT_ID(N'dbo.Spareparts'))
    CREATE INDEX IX_Spareparts_TypeId ON dbo.Spareparts (TypeId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = N'IX_Spareparts_BrandId' AND object_id = OBJECT_ID(N'dbo.Spareparts'))
    CREATE INDEX IX_Spareparts_BrandId ON dbo.Spareparts (BrandId);
GO

COMMIT TRANSACTION;
GO

-- ── Verification ──────────────────────────────────────────────────────────
SELECT 'tables' AS what, COUNT(*) AS n
  FROM sys.tables WHERE name IN (N'SparepartCategories', N'SparepartTypes', N'SparepartBrands')
UNION ALL
SELECT 'spareparts columns',
       (CASE WHEN COL_LENGTH(N'dbo.Spareparts', N'CategoryId') IS NULL THEN 0 ELSE 1 END)
     + (CASE WHEN COL_LENGTH(N'dbo.Spareparts', N'TypeId')     IS NULL THEN 0 ELSE 1 END)
     + (CASE WHEN COL_LENGTH(N'dbo.Spareparts', N'BrandId')    IS NULL THEN 0 ELSE 1 END)
UNION ALL
SELECT 'spareparts fks', COUNT(*)
  FROM sys.foreign_keys
 WHERE parent_object_id = OBJECT_ID(N'dbo.Spareparts')
   AND name IN (N'FK_Spareparts_SparepartCategories_CategoryId',
                N'FK_Spareparts_SparepartTypes_TypeId',
                N'FK_Spareparts_SparepartBrands_BrandId')
UNION ALL
SELECT 'spareparts indexes', COUNT(*)
  FROM sys.indexes
 WHERE object_id = OBJECT_ID(N'dbo.Spareparts')
   AND name IN (N'IX_Spareparts_CategoryId', N'IX_Spareparts_TypeId', N'IX_Spareparts_BrandId');
GO
