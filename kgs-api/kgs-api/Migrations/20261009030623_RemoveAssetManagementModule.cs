using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace kgs_api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveAssetManagementModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ListingInquiries_ContactParties_ConvertedContactPartyId",
                table: "ListingInquiries");

            migrationBuilder.DropTable(
                name: "AssetDocuments");

            migrationBuilder.DropTable(
                name: "CashFlowEntries");

            migrationBuilder.DropTable(
                name: "Reminders");

            migrationBuilder.DropTable(
                name: "LeaseContracts");

            migrationBuilder.DropTable(
                name: "ContactParties");

            migrationBuilder.DropIndex(
                name: "IX_ListingInquiries_ConvertedContactPartyId",
                table: "ListingInquiries");

            migrationBuilder.DropColumn(
                name: "ConvertedContactPartyId",
                table: "ListingInquiries");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ConvertedContactPartyId",
                table: "ListingInquiries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ContactParties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    FullName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    IdNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContactParties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContactParties_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LeaseContracts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    CounterpartyId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentContractId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    DepositAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    Direction = table.Column<int>(type: "integer", nullable: false),
                    EndDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextRentIncreaseDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    PaymentCycle = table.Column<int>(type: "integer", nullable: false),
                    PaymentDueDay = table.Column<int>(type: "integer", nullable: false),
                    RentAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    StartDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    TaxResponsibility = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeaseContracts", x => x.Id);
                    table.CheckConstraint("CK_LeaseContract_Dates", "\"EndDate\" > \"StartDate\"");
                    table.CheckConstraint("CK_LeaseContract_DueDay", "\"PaymentDueDay\" BETWEEN 1 AND 31");
                    table.CheckConstraint("CK_LeaseContract_Rent", "\"RentAmount\" >= 0");
                    table.ForeignKey(
                        name: "FK_LeaseContracts_AssetUnits_AssetUnitId",
                        column: x => x.AssetUnitId,
                        principalTable: "AssetUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LeaseContracts_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeaseContracts_ContactParties_CounterpartyId",
                        column: x => x.CounterpartyId,
                        principalTable: "ContactParties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LeaseContracts_LeaseContracts_ParentContractId",
                        column: x => x.ParentContractId,
                        principalTable: "LeaseContracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssetDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    LeaseContractId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    ExpiryDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IssueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
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
                    table.PrimaryKey("PK_AssetDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssetDocuments_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AssetDocuments_LeaseContracts_LeaseContractId",
                        column: x => x.LeaseContractId,
                        principalTable: "LeaseContracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "CashFlowEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetUnitId = table.Column<Guid>(type: "uuid", nullable: true),
                    LeaseContractId = table.Column<Guid>(type: "uuid", nullable: true),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Direction = table.Column<int>(type: "integer", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PeriodEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PeriodStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Receipt_ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Receipt_FileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Receipt_PublicId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Receipt_SizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    Receipt_Url = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashFlowEntries", x => x.Id);
                    table.CheckConstraint("CK_CashFlow_Amount", "\"Amount\" > 0");
                    table.ForeignKey(
                        name: "FK_CashFlowEntries_AssetUnits_AssetUnitId",
                        column: x => x.AssetUnitId,
                        principalTable: "AssetUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CashFlowEntries_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CashFlowEntries_LeaseContracts_LeaseContractId",
                        column: x => x.LeaseContractId,
                        principalTable: "LeaseContracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Reminders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: true),
                    LeaseContractId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    Cycle = table.Column<int>(type: "integer", nullable: false),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    LastNotifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NotifyDaysBefore = table.Column<int>(type: "integer", nullable: false),
                    Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reminders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Reminders_Assets_AssetId",
                        column: x => x.AssetId,
                        principalTable: "Assets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Reminders_LeaseContracts_LeaseContractId",
                        column: x => x.LeaseContractId,
                        principalTable: "LeaseContracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ListingInquiries_ConvertedContactPartyId",
                table: "ListingInquiries",
                column: "ConvertedContactPartyId");

            migrationBuilder.CreateIndex(
                name: "IX_AssetDocuments_AssetId_Type",
                table: "AssetDocuments",
                columns: new[] { "AssetId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_AssetDocuments_ExpiryDate",
                table: "AssetDocuments",
                column: "ExpiryDate");

            migrationBuilder.CreateIndex(
                name: "IX_AssetDocuments_LeaseContractId",
                table: "AssetDocuments",
                column: "LeaseContractId");

            migrationBuilder.CreateIndex(
                name: "IX_CashFlowEntries_AssetId_OccurredAt",
                table: "CashFlowEntries",
                columns: new[] { "AssetId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CashFlowEntries_AssetUnitId",
                table: "CashFlowEntries",
                column: "AssetUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_CashFlowEntries_LeaseContractId",
                table: "CashFlowEntries",
                column: "LeaseContractId");

            migrationBuilder.CreateIndex(
                name: "IX_CashFlowEntries_UserId_Category_OccurredAt",
                table: "CashFlowEntries",
                columns: new[] { "UserId", "Category", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CashFlowEntries_UserId_OccurredAt",
                table: "CashFlowEntries",
                columns: new[] { "UserId", "OccurredAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ContactParties_UserId_Type",
                table: "ContactParties",
                columns: new[] { "UserId", "Type" });

            migrationBuilder.CreateIndex(
                name: "IX_LeaseContracts_Active_EndDate",
                table: "LeaseContracts",
                column: "EndDate",
                filter: "\"Status\" = 2");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseContracts_AssetId",
                table: "LeaseContracts",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseContracts_AssetUnitId",
                table: "LeaseContracts",
                column: "AssetUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseContracts_CounterpartyId",
                table: "LeaseContracts",
                column: "CounterpartyId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseContracts_ParentContractId",
                table: "LeaseContracts",
                column: "ParentContractId");

            migrationBuilder.CreateIndex(
                name: "IX_LeaseContracts_Status_EndDate",
                table: "LeaseContracts",
                columns: new[] { "Status", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_Active_DueDate",
                table: "Reminders",
                column: "DueDate",
                filter: "\"IsActive\" = TRUE");

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_AssetId",
                table: "Reminders",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_LeaseContractId",
                table: "Reminders",
                column: "LeaseContractId");

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_UserId_IsActive",
                table: "Reminders",
                columns: new[] { "UserId", "IsActive" });

            migrationBuilder.AddForeignKey(
                name: "FK_ListingInquiries_ContactParties_ConvertedContactPartyId",
                table: "ListingInquiries",
                column: "ConvertedContactPartyId",
                principalTable: "ContactParties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
