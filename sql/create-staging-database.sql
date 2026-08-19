/* =====================================================================
   Create TechnicalServiceDB_Staging as a copy of TechnicalServiceDB
   =====================================================================

   WHY
   ---
   Right now "local" is not isolated. `TestingReact/.env.local` points at
   http://localhost:8000, and that API's appsettings.json points at the
   SAME database the production site uses. Verified 2026-08-19: the local API
   and https://technicalservicesapi.camprotec.com.kh both report
   totalCount 3666 and the same newest ticket (20260819-1699,
   id a415b87c-73e3-4e0e-6ab5-08defce523a4).

   So today, testing a write path locally writes to production, and any DDL
   rehearsal lands under the live site. This script makes a real copy to work
   against.

   METHOD: BACKUP then RESTORE, on the same instance.
   Chosen over scripting the schema because it carries **everything** —
   the seven triggers (which live only in the database, not in this repo),
   the SparepartStockAuditLog constraints and indexes, identity seeds and all
   data. A hand-scripted copy would silently miss the triggers, which is
   exactly what makes stock behaviour interesting to test.

   The database is ~144 MB, so this takes seconds, not minutes.

   IMPACT ON PRODUCTION
   --------------------
   - BACKUP DATABASE is an ONLINE operation. It does not lock tables and does
     not block readers or writers. It does consume disk I/O for its duration.
   - COPY_ONLY is used so this backup does NOT disturb any existing backup
     chain (differential or log backups keep working as if it never ran).
   - Nothing is written to the source database at any point.

   BEFORE YOU RUN
   --------------
   1. You need sysadmin or dbcreator + the ability to write to the backup
      path. You are connecting as SA, so this is fine.
   2. Check the paths in @BackupPath and the MOVE clauses below actually
      exist on the SERVER (159.65.6.57), not on your laptop — SQL Server
      writes these files itself. Section 0 prints the server's own defaults;
      run it first and paste them in if the defaults below are wrong.
   3. Disk: needs ~150 MB free for the backup plus ~150 MB for the restored
      files.

   AFTER YOU RUN — point the API at it
   -----------------------------------
   In src/APIs/TechnicalService.API/appsettings.json change Database=
   TechnicalServiceDB to TechnicalServiceDB_Staging. That file is gitignored,
   so the change stays local. Restart the API on :8000 and confirm with
   section 5 below that you are talking to the copy.

   ⚠ ONE THING TO CHECK BEFORE WRITING TEST DATA
   ---------------------------------------------
   dbo.StockNotificationOutbox is written by the stock triggers and drained by
   something OUTSIDE this repo (a Telegram notifier — nothing in src/ reads
   the table). The restored copy will contain the same rows and the same
   trigger logic. If that notifier is pointed at the SERVER rather than at a
   specific database, staging writes could send real Telegram messages.
   Confirm where the drainer connects before exercising stock movements.
   Section 6 gives you a switch to neuter the outbox on staging only.
   ===================================================================== */

SET NOCOUNT ON;
GO

/* ---------------------------------------------------------------------
   SECTION 0 — what paths does this server actually use?
   Run this FIRST. If the defaults differ from the literals used below,
   substitute them.
   --------------------------------------------------------------------- */
SELECT
    DefaultDataPath   = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400)),
    DefaultLogPath    = CAST(SERVERPROPERTY('InstanceDefaultLogPath')  AS nvarchar(400)),
    DefaultBackupPath = CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(400)),
    Edition           = CAST(SERVERPROPERTY('Edition') AS nvarchar(200)),
    ProductVersion    = CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(50));

SELECT
    LogicalName  = name,
    FileType     = type_desc,
    CurrentPath  = physical_name,
    SizeMB       = size * 8 / 1024
FROM sys.master_files
WHERE database_id = DB_ID('TechnicalServiceDB');
GO


/* ---------------------------------------------------------------------
   SECTION 1 — refuse to run if the target already exists

   Prevents silently clobbering a staging database someone is already using.
   To intentionally REPLACE it, drop it first (section 7).
   --------------------------------------------------------------------- */
IF DB_ID('TechnicalServiceDB_Staging') IS NOT NULL
BEGIN
    RAISERROR('TechnicalServiceDB_Staging already exists. Drop it first (section 7) if you really mean to replace it.', 16, 1);
END
ELSE
    PRINT 'OK - TechnicalServiceDB_Staging does not exist yet.';
GO


/* ---------------------------------------------------------------------
   SECTION 2 — COPY_ONLY backup of production

   COPY_ONLY matters: without it, a FULL backup resets the differential base
   and breaks any existing differential/log backup chain. With it, your real
   backup schedule is completely unaffected.
   --------------------------------------------------------------------- */
DECLARE @BackupPath nvarchar(400) =
    CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(400))
    + N'TechnicalServiceDB_forstaging.bak';

BACKUP DATABASE TechnicalServiceDB
TO DISK = @BackupPath
WITH COPY_ONLY,
     INIT,                      -- overwrite this file if rerun
     COMPRESSION,               -- comment out if your edition rejects it
     NAME = N'TechnicalServiceDB copy-only for staging',
     STATS = 25;

PRINT 'backup written to: ' + @BackupPath;
GO


/* ---------------------------------------------------------------------
   SECTION 3 — inspect the backup's logical file names

   You need these for the MOVE clauses. They are usually
   'TechnicalServiceDB' and 'TechnicalServiceDB_log', but confirm rather
   than assume — a database restored from elsewhere often keeps an unrelated
   logical name.
   --------------------------------------------------------------------- */
DECLARE @BackupPath nvarchar(400) =
    CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(400))
    + N'TechnicalServiceDB_forstaging.bak';

RESTORE FILELISTONLY FROM DISK = @BackupPath;
GO


/* ---------------------------------------------------------------------
   SECTION 4 — restore as the staging database

   MOVE is mandatory: without it the restore tries to write to production's
   own .mdf/.ldf paths and fails (correctly) because they are in use.

   If section 3 showed different logical names, change the two MOVE sources.
   --------------------------------------------------------------------- */
DECLARE @BackupPath nvarchar(400) =
    CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(400))
    + N'TechnicalServiceDB_forstaging.bak';
DECLARE @DataPath nvarchar(400) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400));
DECLARE @LogPath  nvarchar(400) = CAST(SERVERPROPERTY('InstanceDefaultLogPath')  AS nvarchar(400));

DECLARE @sql nvarchar(max) = N'
RESTORE DATABASE TechnicalServiceDB_Staging
FROM DISK = ' + QUOTENAME(@BackupPath, '''') + N'
WITH
    MOVE ''TechnicalServiceDB''     TO ' + QUOTENAME(@DataPath + N'TechnicalServiceDB_Staging.mdf', '''') + N',
    MOVE ''TechnicalServiceDB_log'' TO ' + QUOTENAME(@LogPath  + N'TechnicalServiceDB_Staging_log.ldf', '''') + N',
    RECOVERY,
    STATS = 25;';

PRINT @sql;
EXEC sp_executesql @sql;
GO

/* Staging does not need full recovery — it is disposable. SIMPLE keeps the
   log from growing and means you never have to manage log backups for it. */
ALTER DATABASE TechnicalServiceDB_Staging SET RECOVERY SIMPLE;
GO


/* ---------------------------------------------------------------------
   SECTION 5 — verify the copy is real and complete

   Row counts should MATCH production exactly at the moment of backup, and
   the trigger count must be 7 — that is the thing a hand-scripted copy
   would have lost.
   --------------------------------------------------------------------- */
SELECT DatabaseName = 'PRODUCTION', TableName = t.name, NumRows = SUM(p.rows)
FROM TechnicalServiceDB.sys.tables t
JOIN TechnicalServiceDB.sys.partitions p
  ON p.object_id = t.object_id AND p.index_id IN (0,1)
GROUP BY t.name
UNION ALL
SELECT 'STAGING', t.name, SUM(p.rows)
FROM TechnicalServiceDB_Staging.sys.tables t
JOIN TechnicalServiceDB_Staging.sys.partitions p
  ON p.object_id = t.object_id AND p.index_id IN (0,1)
GROUP BY t.name
ORDER BY TableName, DatabaseName;

SELECT
    ProdTriggers    = (SELECT COUNT(*) FROM TechnicalServiceDB.sys.triggers),
    StagingTriggers = (SELECT COUNT(*) FROM TechnicalServiceDB_Staging.sys.triggers);
GO


/* ---------------------------------------------------------------------
   SECTION 6 — OPTIONAL: stop staging from feeding the Telegram notifier

   Only run this if you confirmed the outbox drainer could reach staging.
   Clearing the table stops the copied backlog being re-sent; it does not
   stop the triggers writing NEW rows, but those stay in staging where an
   instance-wide drainer is the only thing that could pick them up.

   Read the count first and decide.
   --------------------------------------------------------------------- */
-- SELECT ExistingOutboxRows = COUNT(*) FROM TechnicalServiceDB_Staging.dbo.StockNotificationOutbox;
-- DELETE FROM TechnicalServiceDB_Staging.dbo.StockNotificationOutbox;


/* ---------------------------------------------------------------------
   SECTION 7 — teardown, when you want to refresh or remove staging

   SINGLE_USER WITH ROLLBACK IMMEDIATE kicks off any connection still holding
   the database (your API will be one) so the DROP can proceed. It only ever
   touches the staging copy — the name is spelled out in full deliberately.
   --------------------------------------------------------------------- */
-- ALTER DATABASE TechnicalServiceDB_Staging SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
-- DROP DATABASE TechnicalServiceDB_Staging;
