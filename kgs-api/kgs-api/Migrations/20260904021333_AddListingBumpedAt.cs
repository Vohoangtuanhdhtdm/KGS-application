using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddListingBumpedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "BumpedAt",
                table: "Listings",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BumpedAt",
                table: "Listings");
        }
    }
}
