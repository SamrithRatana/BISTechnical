using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UserManagementAPI.Migrations
{
    /// <summary>
    /// Adds ApplicationUser.CoverUrl only. The scaffolder also proposed a
    /// CREATE TABLE for security.UserPreferences — that table already exists
    /// in the database (applied out-of-band, same story as AddLeaveManagement;
    /// see this project's CLAUDE.md) — so that part is deliberately removed
    /// here while the regenerated snapshot keeps the table in the model,
    /// which stops future migrations from re-proposing it.
    /// </summary>
    public partial class AddUserCoverUrl : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CoverUrl",
                schema: "security",
                table: "Users",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CoverUrl",
                schema: "security",
                table: "Users");
        }
    }
}
