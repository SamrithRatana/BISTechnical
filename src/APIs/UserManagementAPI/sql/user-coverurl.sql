BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827030138_AddUserCoverUrl'
)
BEGIN
    ALTER TABLE [security].[Users] ADD [CoverUrl] nvarchar(500) NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827030138_AddUserCoverUrl'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260827030138_AddUserCoverUrl', N'8.0.16');
END;
GO

COMMIT;
GO

