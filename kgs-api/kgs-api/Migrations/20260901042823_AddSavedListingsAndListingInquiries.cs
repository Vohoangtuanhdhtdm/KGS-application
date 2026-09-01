using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedListingsAndListingInquiries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ListingInquiries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<int>(type: "integer", nullable: false),
                    FromUserId = table.Column<string>(type: "text", nullable: false),
                    ToUserId = table.Column<string>(type: "text", nullable: false),
                    Message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PreferredViewingAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ConvertedContactPartyId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingInquiries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingInquiries_AspNetUsers_FromUserId",
                        column: x => x.FromUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ListingInquiries_ContactParties_ConvertedContactPartyId",
                        column: x => x.ConvertedContactPartyId,
                        principalTable: "ContactParties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ListingInquiries_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SavedListings",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    PropertyId = table.Column<int>(type: "integer", nullable: false),
                    SavedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedListings", x => new { x.UserId, x.PropertyId });
                    table.ForeignKey(
                        name: "FK_SavedListings_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SavedListings_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListingInquiries_ConvertedContactPartyId",
                table: "ListingInquiries",
                column: "ConvertedContactPartyId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingInquiries_FromUserId_CreatedAt",
                table: "ListingInquiries",
                columns: new[] { "FromUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ListingInquiries_ToUserId_CreatedAt",
                table: "ListingInquiries",
                columns: new[] { "ToUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "UX_ListingInquiries_OpenPerUser",
                table: "ListingInquiries",
                columns: new[] { "PropertyId", "FromUserId" },
                unique: true,
                filter: "\"Status\" IN (1, 2, 3)");

            migrationBuilder.CreateIndex(
                name: "IX_SavedListings_PropertyId",
                table: "SavedListings",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_SavedListings_UserId_SavedAt",
                table: "SavedListings",
                columns: new[] { "UserId", "SavedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListingInquiries");

            migrationBuilder.DropTable(
                name: "SavedListings");
        }
    }
}
