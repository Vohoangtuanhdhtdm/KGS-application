using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAddress2025 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NewProvince",
                table: "Assets",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NewProvinceCode",
                table: "Assets",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NewWard",
                table: "Assets",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NewWardCode",
                table: "Assets",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Assets_NewProvinceCode",
                table: "Assets",
                column: "NewProvinceCode");

            migrationBuilder.CreateIndex(
                name: "IX_Assets_NewWardCode",
                table: "Assets",
                column: "NewWardCode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Assets_NewProvinceCode",
                table: "Assets");

            migrationBuilder.DropIndex(
                name: "IX_Assets_NewWardCode",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "NewProvince",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "NewProvinceCode",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "NewWard",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "NewWardCode",
                table: "Assets");
        }
    }
}
