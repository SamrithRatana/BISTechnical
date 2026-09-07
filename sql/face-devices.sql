BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822085527_AddFaceDevices'
)
BEGIN
    CREATE TABLE [security].[UserFaceDevices] (
        [Id] int NOT NULL IDENTITY,
        [UserId] nvarchar(450) NOT NULL,
        [TokenHash] varbinary(32) NOT NULL,
        [DeviceName] nvarchar(120) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [LastUsedAt] datetime2 NULL,
        [IsRevoked] bit NOT NULL,
        CONSTRAINT [PK_UserFaceDevices] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_UserFaceDevices_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [security].[Users] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822085527_AddFaceDevices'
)
BEGIN
    CREATE UNIQUE INDEX [IX_UserFaceDevices_TokenHash] ON [security].[UserFaceDevices] ([TokenHash]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822085527_AddFaceDevices'
)
BEGIN
    CREATE INDEX [IX_UserFaceDevices_UserId] ON [security].[UserFaceDevices] ([UserId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822085527_AddFaceDevices'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260822085527_AddFaceDevices', N'8.0.16');
END;
GO

COMMIT;
GO

