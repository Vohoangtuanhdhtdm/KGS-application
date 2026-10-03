using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddBuildingModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BuildingModelPublished",
                table: "Assets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "FloorHeightMeters",
                table: "Assets",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FootprintJson",
                table: "Assets",
                type: "jsonb",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BuildingModelPublished",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "FloorHeightMeters",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "FootprintJson",
                table: "Assets");
        }
    }
}
