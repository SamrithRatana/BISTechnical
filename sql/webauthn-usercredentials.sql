BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822063330_AddWebAuthnCredentials'
)
BEGIN
    CREATE TABLE [security].[UserCredentials] (
        [Id] int NOT NULL IDENTITY,
        [UserId] nvarchar(450) NOT NULL,
        [CredentialId] varbinary(1024) NOT NULL,
        [PublicKey] varbinary(1024) NOT NULL,
        [UserHandle] varbinary(128) NOT NULL,
        [SignCount] bigint NOT NULL,
        [CredType] nvarchar(32) NULL,
        [AaGuid] uniqueidentifier NOT NULL,
        [Transports] nvarchar(256) NULL,
        [IsBackedUp] bit NOT NULL,
        [DeviceName] nvarchar(120) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [LastUsedAt] datetime2 NULL,
        CONSTRAINT [PK_UserCredentials] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_UserCredentials_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [security].[Users] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822063330_AddWebAuthnCredentials'
)
BEGIN
    CREATE UNIQUE INDEX [IX_UserCredentials_CredentialId] ON [security].[UserCredentials] ([CredentialId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822063330_AddWebAuthnCredentials'
)
BEGIN
    CREATE INDEX [IX_UserCredentials_UserId] ON [security].[UserCredentials] ([UserId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260822063330_AddWebAuthnCredentials'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260822063330_AddWebAuthnCredentials', N'8.0.16');
END;
GO

COMMIT;
GO

