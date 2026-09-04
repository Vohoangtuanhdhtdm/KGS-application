using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddListingReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ListingReports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ListingId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReporterUserId = table.Column<string>(type: "text", nullable: false),
                    Reason = table.Column<int>(type: "integer", nullable: false),
                    Detail = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    HandledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    HandledByUserId = table.Column<string>(type: "text", nullable: true),
                    HandlerNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingReports_AspNetUsers_ReporterUserId",
                        column: x => x.ReporterUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ListingReports_Listings_ListingId",
                        column: x => x.ListingId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListingReports_ReporterUserId",
                table: "ListingReports",
                column: "ReporterUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingReports_Status_CreatedAt",
                table: "ListingReports",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "UX_ListingReports_OnePendingPerReporter",
                table: "ListingReports",
                columns: new[] { "ListingId", "ReporterUserId" },
                unique: true,
                filter: "\"Status\" = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListingReports");
        }
    }
}
