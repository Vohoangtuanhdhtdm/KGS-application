using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddDemandMarketplace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DiscoverableUntil",
                table: "SavedSearches",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiryRemindedAt",
                table: "SavedSearches",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OfferNote",
                table: "ListingInvitations",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OfferPrice",
                table: "ListingInvitations",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OfferNote",
                table: "ListingInquiries",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OfferPrice",
                table: "ListingInquiries",
                type: "numeric",
                nullable: true);

            // Nhu cầu đang mở từ trước khi có hạn: cho chúng 30 ngày kể từ hôm nay.
            migrationBuilder.Sql(
                "UPDATE \"SavedSearches\" SET \"DiscoverableUntil\" = now() + interval '30 days' " +
                "WHERE \"DiscoverableByOwners\" = true;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DiscoverableUntil",
                table: "SavedSearches");

            migrationBuilder.DropColumn(
                name: "ExpiryRemindedAt",
                table: "SavedSearches");

            migrationBuilder.DropColumn(
                name: "OfferNote",
                table: "ListingInvitations");

            migrationBuilder.DropColumn(
                name: "OfferPrice",
                table: "ListingInvitations");

            migrationBuilder.DropColumn(
                name: "OfferNote",
                table: "ListingInquiries");

            migrationBuilder.DropColumn(
                name: "OfferPrice",
                table: "ListingInquiries");
        }
    }
}
