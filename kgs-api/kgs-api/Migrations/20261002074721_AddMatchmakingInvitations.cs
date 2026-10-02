using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchmakingInvitations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DemandNote",
                table: "SavedSearches",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "DiscoverableByOwners",
                table: "SavedSearches",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DiscoverableSince",
                table: "SavedSearches",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ListingInvitations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ListingId = table.Column<Guid>(type: "uuid", nullable: false),
                    SavedSearchId = table.Column<Guid>(type: "uuid", nullable: true),
                    OwnerUserId = table.Column<string>(type: "text", nullable: false),
                    SeekerUserId = table.Column<string>(type: "text", nullable: false),
                    Message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    InquiryId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingInvitations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingInvitations_AspNetUsers_SeekerUserId",
                        column: x => x.SeekerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ListingInvitations_ListingInquiries_InquiryId",
                        column: x => x.InquiryId,
                        principalTable: "ListingInquiries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ListingInvitations_Listings_ListingId",
                        column: x => x.ListingId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ListingInvitations_SavedSearches_SavedSearchId",
                        column: x => x.SavedSearchId,
                        principalTable: "SavedSearches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListingInvitations_InquiryId",
                table: "ListingInvitations",
                column: "InquiryId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingInvitations_ListingId_SavedSearchId",
                table: "ListingInvitations",
                columns: new[] { "ListingId", "SavedSearchId" },
                unique: true,
                filter: "\"SavedSearchId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ListingInvitations_OwnerUserId_CreatedAt",
                table: "ListingInvitations",
                columns: new[] { "OwnerUserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ListingInvitations_SavedSearchId",
                table: "ListingInvitations",
                column: "SavedSearchId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingInvitations_SeekerUserId_CreatedAt",
                table: "ListingInvitations",
                columns: new[] { "SeekerUserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ListingInvitations");

            migrationBuilder.DropColumn(
                name: "DemandNote",
                table: "SavedSearches");

            migrationBuilder.DropColumn(
                name: "DiscoverableByOwners",
                table: "SavedSearches");

            migrationBuilder.DropColumn(
                name: "DiscoverableSince",
                table: "SavedSearches");
        }
    }
}
