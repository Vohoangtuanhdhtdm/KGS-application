using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddListingModerationEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ListingModerationEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ListingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<int>(type: "integer", nullable: false),
                    Reasons = table.Column<int[]>(type: "integer[]", nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ModeratorUserId = table.Column<string>(type: "text", nullable: true),
                    Round = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingModerationEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingModerationEvents_AspNetUsers_ModeratorUserId",
                        column: x => x.ModeratorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ListingModerationEvents_Listings_ListingId",
                        column: x => x.ListingId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListingModerationEvents_ListingId_CreatedAt",
                table: "ListingModerationEvents",
                columns: new[] { "ListingId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ListingModerationEvents_ModeratorUserId",
                table: "ListingModerationEvents",
                column: "ModeratorUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListingModerationEvents");
        }
    }
}
