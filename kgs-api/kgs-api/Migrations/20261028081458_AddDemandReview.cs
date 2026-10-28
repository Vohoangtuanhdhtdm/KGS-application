using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddDemandReview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DemandReview",
                table: "SavedSearches",
                type: "integer",
                nullable: false,
                // 1 = Approved: nhu cầu đã mở từ trước khi có kiểm duyệt coi như đã duyệt.
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "DemandReviewReason",
                table: "SavedSearches",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DemandReviewedAt",
                table: "SavedSearches",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DemandReview",
                table: "SavedSearches");

            migrationBuilder.DropColumn(
                name: "DemandReviewReason",
                table: "SavedSearches");

            migrationBuilder.DropColumn(
                name: "DemandReviewedAt",
                table: "SavedSearches");
        }
    }
}
