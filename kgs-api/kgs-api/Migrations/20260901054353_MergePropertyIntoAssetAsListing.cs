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
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Migration nay CHUYEN du lieu chu khong vut di. Ban sinh tu dong cua EF pha
            // bang Properties truoc roi moi tao Listings, nen cac dong ListingInquiries va
            // SavedListings dang co bi gan ListingId rong va vi pham khoa ngoai ngay khi FK
            // duoc them vao. Thu tu dung la: dung bang moi -> chuyen du lieu -> go mo hinh cu.

            // ============================================================
            // GIAI DOAN 1 - Dung cau truc moi, chua dung gi toi bang cu
            // ============================================================

            migrationBuilder.AddColumn<double>(
                name: "Frontage",
                table: "Assets",
                type: "double precision",
                nullable: true);

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

            // ============================================================
            // GIAI DOAN 2 - Chuyen du lieu sang mo hinh moi
            // ============================================================

            migrationBuilder.Sql(@"
-- Bang anh xa tam: moi Property co mot Asset tro ve se tro thanh mot Listing.
-- Property mo coi (khong Asset nao lien ket) khong chuyen duoc vi Listing.AssetId la
-- bat buoc - chung bien mat cung bang Properties o Giai doan 3.
-- DISTINCT ON phong truong hop hiem hai Asset cung tro vao mot Property.
CREATE TEMP TABLE _property_to_listing AS
SELECT DISTINCT ON (p.""Id"")
       p.""Id""  AS old_property_id,
       a.""Id""  AS asset_id,
       (md5(random()::text || clock_timestamp()::text))::uuid AS new_listing_id
FROM ""Properties"" p
JOIN ""Assets"" a ON a.""LinkedPropertyId"" = p.""Id""
ORDER BY p.""Id"", a.""Id"";

-- Tin dang. Cac cot mo ta vat ly KHONG chuyen sang: nay doc tu Asset.
-- PropertyStatus va ListingStatus dung chung dai gia tri 1..4 nen copy thang.
INSERT INTO ""Listings"" (
    ""Id"", ""AssetId"", ""AssetUnitId"", ""Title"", ""Description"", ""Price"",
    ""Type"", ""RentPaymentCycle"", ""Status"", ""Slug"", ""ViewCount"",
    ""PublishedAt"", ""ModerationNote"", ""CreatedAt"", ""UpdatedAt"", ""CreatedBy"", ""UpdatedBy"")
SELECT m.new_listing_id, m.asset_id, NULL,
       p.""Title"", p.""Description"", p.""Price"",
       p.""Type"", p.""RentPaymentCycle"", p.""Status"", p.""Slug"", p.""ViewCount"",
       CASE WHEN p.""Status"" = 2 THEN p.""CreatedAt"" END,
       NULL,
       p.""CreatedAt"", NULL, p.""UserId"", NULL
FROM _property_to_listing m
JOIN ""Properties"" p ON p.""Id"" = m.old_property_id;

-- Anh tin dang giu nguyen khoa chinh de moi tham chieu cu van khop.
INSERT INTO ""ListingImages"" (
    ""Id"", ""ListingId"", ""File_Url"", ""File_PublicId"", ""File_FileName"",
    ""File_ContentType"", ""File_SizeBytes"", ""SortOrder"",
    ""CreatedAt"", ""UpdatedAt"", ""CreatedBy"", ""UpdatedBy"")
SELECT pi.""Id"", m.new_listing_id, pi.""File_Url"", pi.""File_PublicId"", pi.""File_FileName"",
       pi.""File_ContentType"", pi.""File_SizeBytes"", pi.""SortOrder"",
       pi.""CreatedAt"", pi.""UpdatedAt"", pi.""CreatedBy"", pi.""UpdatedBy""
FROM ""PropertyImages"" pi
JOIN _property_to_listing m ON m.old_property_id = pi.""PropertyId"";

-- Mat tien la thuoc tinh vat ly nen chuyen ve Asset.
UPDATE ""Assets"" a
SET ""Frontage"" = p.""Frontage""
FROM ""Properties"" p
WHERE a.""LinkedPropertyId"" = p.""Id"" AND p.""Frontage"" IS NOT NULL AND p.""Frontage"" <> 0;

-- Tro lai yeu cau xem nha va tin da luu. Them cot dang NULL truoc, anh xa, xoa nhung dong
-- khong anh xa duoc (chung tro vao Property mo coi sap bi xoa), roi moi siet NOT NULL.
ALTER TABLE ""ListingInquiries"" ADD COLUMN ""ListingId"" uuid NULL;
UPDATE ""ListingInquiries"" i
SET ""ListingId"" = m.new_listing_id
FROM _property_to_listing m
WHERE m.old_property_id = i.""PropertyId"";
DELETE FROM ""ListingInquiries"" WHERE ""ListingId"" IS NULL;
ALTER TABLE ""ListingInquiries"" ALTER COLUMN ""ListingId"" SET NOT NULL;

ALTER TABLE ""SavedListings"" ADD COLUMN ""ListingId"" uuid NULL;
UPDATE ""SavedListings"" s
SET ""ListingId"" = m.new_listing_id
FROM _property_to_listing m
WHERE m.old_property_id = s.""PropertyId"";
DELETE FROM ""SavedListings"" WHERE ""ListingId"" IS NULL;
ALTER TABLE ""SavedListings"" ALTER COLUMN ""ListingId"" SET NOT NULL;

DROP TABLE _property_to_listing;
");

            // ============================================================
            // GIAI DOAN 3 - Go mo hinh cu, nay da khong con ai tham chieu
            // ============================================================

            migrationBuilder.DropForeignKey(
                name: "FK_Assets_Properties_LinkedPropertyId",
                table: "Assets");

            migrationBuilder.DropForeignKey(
                name: "FK_ListingInquiries_Properties_PropertyId",
                table: "ListingInquiries");

            migrationBuilder.DropForeignKey(
                name: "FK_SavedListings_Properties_PropertyId",
                table: "SavedListings");

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

            migrationBuilder.DropTable(
                name: "PropertyImages");

            migrationBuilder.DropTable(
                name: "Properties");

            migrationBuilder.AddPrimaryKey(
                name: "PK_SavedListings",
                table: "SavedListings",
                columns: new[] { "UserId", "ListingId" });

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
