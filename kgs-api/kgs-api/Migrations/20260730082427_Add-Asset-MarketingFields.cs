using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetMarketingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Bathrooms",
                table: "Assets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Bedrooms",
                table: "Assets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Floors",
                table: "Assets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FurnitureState",
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HouseDirection",
                table: "Assets",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LegalStatus",
                table: "Assets",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Bathrooms",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Bedrooms",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Floors",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "FurnitureState",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "HouseDirection",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "LegalStatus",
                table: "Assets");
        }
    }
}
