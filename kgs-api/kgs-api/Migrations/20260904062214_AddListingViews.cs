using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddListingViews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ListingViews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ListingId = table.Column<Guid>(type: "uuid", nullable: false),
                    ViewerHash = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    ViewerUserId = table.Column<string>(type: "text", nullable: true),
                    ViewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ViewedOn = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingViews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingViews_Listings_ListingId",
                        column: x => x.ListingId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListingViews_ListingId_ViewedOn",
                table: "ListingViews",
                columns: new[] { "ListingId", "ViewedOn" });

            migrationBuilder.CreateIndex(
                name: "UX_ListingViews_OnePerViewerPerDay",
                table: "ListingViews",
                columns: new[] { "ListingId", "ViewerHash", "ViewedOn" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListingViews");
        }
    }
}
