using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class CleanupAssetDomain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AssetMedia");

            migrationBuilder.DropIndex(
                name: "IX_Assets_UserId_Status",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "AcquisitionDate",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "CurrentValue",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "OwnershipType",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Thumbnail_ContentType",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Thumbnail_FileName",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Thumbnail_PublicId",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Thumbnail_SizeBytes",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "Thumbnail_Url",
                table: "Assets");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AcquisitionDate",
                table: "Assets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CurrentValue",
                table: "Assets",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OwnershipType",
                table: "Assets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Assets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Thumbnail_ContentType",
                table: "Assets",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Thumbnail_FileName",
                table: "Assets",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Thumbnail_PublicId",
                table: "Assets",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "Thumbnail_SizeBytes",
                table: "Assets",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Thumbnail_Url",
                table: "Assets",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AssetMedia",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Caption = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    TakenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    File_ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    File_FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    File_PublicId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    File_SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    File_Url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetMedia", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssetMedia_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Assets_UserId_Status",
                table: "Assets",
                columns: new[] { "UserId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_AssetMedia_AssetId_TakenAt",
                table: "AssetMedia",
                columns: new[] { "AssetId", "TakenAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AssetMedia_File_PublicId",
                table: "AssetMedia",
                column: "File_PublicId");
        }
    }
}
