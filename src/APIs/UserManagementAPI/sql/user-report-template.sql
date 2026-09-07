BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827034455_AddReportTemplateJson'
)
BEGIN
    ALTER TABLE [security].[UserPreferences] ADD [ReportTemplateJson] nvarchar(max) NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827034455_AddReportTemplateJson'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260827034455_AddReportTemplateJson', N'8.0.16');
END;
GO

COMMIT;
GO

