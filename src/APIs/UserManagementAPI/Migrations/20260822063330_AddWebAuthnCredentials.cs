using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UserManagementAPI.Migrations
{
    /// <summary>
    /// Creates security.UserCredentials - the WebAuthn passkey table.
    ///
    /// EF also scaffolded AddColumn for AppSettings.AccentColor / LogoScale /
    /// SurfaceStyle into this migration, plus an UpdateData resetting the single
    /// settings row. All four were REMOVED by hand, deliberately:
    ///
    ///   * Those three columns are pre-existing drift, not part of this feature.
    ///     They are in Models/AppSetting.cs and are read and written by
    ///     AppSettingsController and the frontend's services/appSettings.ts, all
    ///     of it shipping code - so the columns already exist in the database,
    ///     added out-of-band exactly the way the Leave* tables were (see this
    ///     project's CLAUDE.md). Replaying them here would fail the whole
    ///     migration on "column already exists".
    ///   * The UpdateData was the "may result in the loss of data" warning EF
    ///     printed: it would have overwritten whatever branding the live
    ///     AppSettings row actually holds with the seed values.
    ///
    /// The regenerated ModelSnapshot DOES now describe those columns, which
    /// brings EF's bookkeeping back in line with the database rather than
    /// leaving the same three columns to be re-proposed by every future
    /// migration. Nothing about AppSettings is changed by running this.
    /// </summary>
    public partial class AddWebAuthnCredentials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserCredentials",
                schema: "security",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    CredentialId = table.Column<byte[]>(type: "varbinary(1024)", maxLength: 1024, nullable: false),
                    PublicKey = table.Column<byte[]>(type: "varbinary(1024)", maxLength: 1024, nullable: false),
                    UserHandle = table.Column<byte[]>(type: "varbinary(128)", maxLength: 128, nullable: false),
                    SignCount = table.Column<long>(type: "bigint", nullable: false),
                    CredType = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    AaGuid = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Transports = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    IsBackedUp = table.Column<bool>(type: "bit", nullable: false),
                    DeviceName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserCredentials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserCredentials_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "security",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserCredentials_CredentialId",
                schema: "security",
                table: "UserCredentials",
                column: "CredentialId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserCredentials_UserId",
                schema: "security",
                table: "UserCredentials",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserCredentials",
                schema: "security");

        }
    }
}
