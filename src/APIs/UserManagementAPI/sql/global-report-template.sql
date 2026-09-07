BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827034752_AddGlobalReportTemplate'
)
BEGIN
    ALTER TABLE [dbo].[AppSettings] ADD [ReportTemplateJson] nvarchar(max) NULL;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827034752_AddGlobalReportTemplate'
)
BEGIN
    EXEC(N'UPDATE [dbo].[AppSettings] SET [ReportTemplateJson] = NULL
    WHERE [Id] = 1;
    SELECT @@ROWCOUNT');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260827034752_AddGlobalReportTemplate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260827034752_AddGlobalReportTemplate', N'8.0.16');
END;
GO

COMMIT;
GO

