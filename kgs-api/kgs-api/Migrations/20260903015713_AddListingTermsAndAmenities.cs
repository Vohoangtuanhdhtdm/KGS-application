using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class AddListingTermsAndAmenities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<string>>(
                name: "Amenities",
                table: "Listings",
                type: "text[]",
                nullable: false,
                // Bat buoc co default: bang Listings luc nay DA CO du lieu chuyen sang tu
                // Properties, nen ALTER TABLE ADD COLUMN NOT NULL khong co default se do
                // voi loi "column contains null values".
                defaultValueSql: "'{}'");

            migrationBuilder.AddColumn<DateTime>(
                name: "Terms_AvailableFrom",
                table: "Listings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Terms_CookingAllowed",
                table: "Listings",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Terms_CurfewFree",
                table: "Listings",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Terms_DepositMonths",
                table: "Listings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Terms_ElectricityPrice",
                table: "Listings",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Terms_InternetFee",
                table: "Listings",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Terms_MaxOccupants",
                table: "Listings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Terms_MinLeaseMonths",
                table: "Listings",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Terms_ParkingFee",
                table: "Listings",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Terms_PetsAllowed",
                table: "Listings",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Terms_ServiceFee",
                table: "Listings",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Terms_SharedWithOwner",
                table: "Listings",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Terms_WaterPrice",
                table: "Listings",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Terms_WaterPricing",
                table: "Listings",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Listings_Amenities",
                table: "Listings",
                column: "Amenities")
                .Annotation("Npgsql:IndexMethod", "gin");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Listings_Amenities",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Amenities",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_AvailableFrom",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_CookingAllowed",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_CurfewFree",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_DepositMonths",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_ElectricityPrice",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_InternetFee",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_MaxOccupants",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_MinLeaseMonths",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_ParkingFee",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_PetsAllowed",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_ServiceFee",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_SharedWithOwner",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_WaterPrice",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "Terms_WaterPricing",
                table: "Listings");
        }
    }
}
