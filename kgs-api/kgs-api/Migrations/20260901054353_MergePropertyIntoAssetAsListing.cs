using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class MergePropertyIntoAssetAsListing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Assets_Properties_LinkedPropertyId",
                table: "Assets");

            migrationBuilder.DropForeignKey(
                name: "FK_ListingInquiries_Properties_PropertyId",
                table: "ListingInquiries");

            migrationBuilder.DropForeignKey(
                name: "FK_SavedListings_Properties_PropertyId",
                table: "SavedListings");

            migrationBuilder.DropTable(
                name: "PropertyImages");

            migrationBuilder.DropTable(
                name: "Properties");

            migrationBuilder.DropPrimaryKey(
                name: "PK_SavedListings",
                table: "SavedListings");

            migrationBuilder.DropIndex(
                name: "IX_SavedListings_PropertyId",
                table: "SavedListings");

            migrationBuilder.DropIndex(
                name: "UX_ListingInquiries_OpenPerUser",
                table: "ListingInquiries");

            migrationBuilder.DropIndex(
                name: "IX_Assets_LinkedPropertyId",
                table: "Assets");

            migrationBuilder.DropColumn(
                name: "PropertyId",
                table: "SavedListings");

            migrationBuilder.DropColumn(
                name: "PropertyId",
                table: "ListingInquiries");

            migrationBuilder.DropColumn(
                name: "LinkedPropertyId",
                table: "Assets");

            migrationBuilder.AddColumn<Guid>(
                name: "ListingId",
                table: "SavedListings",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "ListingId",
                table: "ListingInquiries",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<double>(
                name: "Frontage",
                table: "Assets",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_SavedListings",
                table: "SavedListings",
                columns: new[] { "UserId", "ListingId" });

            migrationBuilder.CreateTable(
                name: "Listings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    RentPaymentCycle = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Slug = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ViewCount = table.Column<int>(type: "integer", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModerationNote = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Listings", x => x.Id);
                    table.CheckConstraint("CK_Listing_Price", "\"Price\" >= 0");
                    table.ForeignKey(
                        name: "FK_Listings_AssetUnits_AssetUnitId",
                        column: x => x.AssetUnitId,
                        principalTable: "AssetUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Listings_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ListingImages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ListingId = table.Column<Guid>(type: "uuid", nullable: false),
                    File_Url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    File_PublicId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    File_FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    File_ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    File_SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ListingImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ListingImages_Listings_ListingId",
                        column: x => x.ListingId,
                        principalTable: "Listings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SavedListings_ListingId",
                table: "SavedListings",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "UX_ListingInquiries_OpenPerUser",
                table: "ListingInquiries",
                columns: new[] { "ListingId", "FromUserId" },
                unique: true,
                filter: "\"Status\" IN (1, 2, 3)");

            migrationBuilder.CreateIndex(
                name: "IX_ListingImages_ListingId",
                table: "ListingImages",
                column: "ListingId");

            migrationBuilder.CreateIndex(
                name: "IX_Listings_AssetId",
                table: "Listings",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_Listings_AssetUnitId",
                table: "Listings",
                column: "AssetUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_Listings_Slug",
                table: "Listings",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Listings_Status_Type",
                table: "Listings",
                columns: new[] { "Status", "Type" });

            migrationBuilder.CreateIndex(
                name: "UX_Listings_OneLivePerSlot",
                table: "Listings",
                columns: new[] { "AssetId", "AssetUnitId" },
                unique: true,
                filter: "\"Status\" IN (1, 2)");

            migrationBuilder.AddForeignKey(
                name: "FK_ListingInquiries_Listings_ListingId",
                table: "ListingInquiries",
                column: "ListingId",
                principalTable: "Listings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SavedListings_Listings_ListingId",
                table: "SavedListings",
                column: "ListingId",
                principalTable: "Listings",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ListingInquiries_Listings_ListingId",
                table: "ListingInquiries");

            migrationBuilder.DropForeignKey(
                name: "FK_SavedListings_Listings_ListingId",
                table: "SavedListings");

            migrationBuilder.DropTable(
                name: "ListingImages");

            migrationBuilder.DropTable(
                name: "Listings");

            migrationBuilder.DropPrimaryKey(
                name: "PK_SavedListings",
                table: "SavedListings");

            migrationBuilder.DropIndex(
                name: "IX_SavedListings_ListingId",
                table: "SavedListings");

            migrationBuilder.DropIndex(
                name: "UX_ListingInquiries_OpenPerUser",
                table: "ListingInquiries");

            migrationBuilder.DropColumn(
                name: "ListingId",
                table: "SavedListings");

            migrationBuilder.DropColumn(
                name: "ListingId",
                table: "ListingInquiries");

            migrationBuilder.DropColumn(
                name: "Frontage",
                table: "Assets");

            migrationBuilder.AddColumn<int>(
                name: "PropertyId",
                table: "SavedListings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PropertyId",
                table: "ListingInquiries",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LinkedPropertyId",
                table: "Assets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_SavedListings",
                table: "SavedListings",
                columns: new[] { "UserId", "PropertyId" });

            migrationBuilder.CreateTable(
                name: "Properties",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    AddressDetail = table.Column<string>(type: "text", nullable: false),
                    Area = table.Column<double>(type: "double precision", nullable: false),
                    Bathrooms = table.Column<int>(type: "integer", nullable: false),
                    Bedrooms = table.Column<int>(type: "integer", nullable: false),
                    City = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    District = table.Column<string>(type: "text", nullable: false),
                    Floors = table.Column<int>(type: "integer", nullable: false),
                    Frontage = table.Column<double>(type: "double precision", nullable: false),
                    FurnitureState = table.Column<string>(type: "text", nullable: false),
                    HouseDirection = table.Column<string>(type: "text", nullable: false),
                    LegalStatus = table.Column<string>(type: "text", nullable: false),
                    Location = table.Column<Point>(type: "geography (point, 4326)", nullable: true),
                    Price = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PropertyType = table.Column<string>(type: "text", nullable: false),
                    RentPaymentCycle = table.Column<int>(type: "integer", nullable: true),
                    Slug = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    ViewCount = table.Column<int>(type: "integer", nullable: false),
                    Ward = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Properties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Properties_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PropertyImages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_PropertyImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PropertyImages_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SavedListings_PropertyId",
                table: "SavedListings",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "UX_ListingInquiries_OpenPerUser",
                table: "ListingInquiries",
                columns: new[] { "PropertyId", "FromUserId" },
                unique: true,
                filter: "\"Status\" IN (1, 2, 3)");

            migrationBuilder.CreateIndex(
                name: "IX_Assets_LinkedPropertyId",
                table: "Assets",
                column: "LinkedPropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_Properties_Location",
                table: "Properties",
                column: "Location")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "IX_Properties_Slug",
                table: "Properties",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Properties_Status_Type",
                table: "Properties",
                columns: new[] { "Status", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_Properties_UserId",
                table: "Properties",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PropertyImages_PropertyId",
                table: "PropertyImages",
                column: "PropertyId");

            migrationBuilder.AddForeignKey(
                name: "FK_Assets_Properties_LinkedPropertyId",
                table: "Assets",
                column: "LinkedPropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ListingInquiries_Properties_PropertyId",
                table: "ListingInquiries",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SavedListings_Properties_PropertyId",
                table: "SavedListings",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
