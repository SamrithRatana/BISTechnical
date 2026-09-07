BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822080340_AddFaceTemplates'
)
BEGIN
    CREATE TABLE [security].[UserFaceTemplates] (
        [Id] int NOT NULL IDENTITY,
        [UserId] nvarchar(450) NOT NULL,
        [Embedding] varbinary(2048) NOT NULL,
        [Dimensions] int NOT NULL,
        [SampleIndex] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_UserFaceTemplates] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_UserFaceTemplates_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [security].[Users] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822080340_AddFaceTemplates'
)
BEGIN
    CREATE INDEX [IX_UserFaceTemplates_UserId] ON [security].[UserFaceTemplates] ([UserId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822080340_AddFaceTemplates'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260822080340_AddFaceTemplates', N'8.0.16');
END;
GO

COMMIT;
GO

