using CloudinaryDotNet.Actions;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Dtos
{
    // ============================================================
    // SHARED
    // ============================================================
    public sealed record AddressDto(
        [Required, MaxLength(100)] string City,
        [Required, MaxLength(100)] string District,
        [Required, MaxLength(100)] string Ward,
        [MaxLength(500)] string Detail);

    public sealed record AssetMapPinDto(
        Guid Id,
        string Name,
        AssetDomainType Type,
        AssetOwnershipType OwnershipType,
        AssetStatus Status,
        string City,
        string District,
        decimal? CurrentValue,
        string? ThumbnailUrl,
        int? LinkedPropertyId,
        double? Latitude,    // null nếu tài sản chưa gắn vị trí — KHÔNG loại tài sản này khỏi kết quả
        double? Longitude);  // null nếu tài sản chưa gắn vị trí


    /// <summary>Client luôn gửi/nhận lat-lng; chuyển đổi sang NTS Point nằm trong service.</summary>
    public sealed record GeoPointDto(
        [Range(-90, 90)] double Latitude,
        [Range(-180, 180)] double Longitude);

    public sealed record StoredFileDto(string Url, string? FileName, string? ContentType, long? SizeBytes);

    // ============================================================
    // A. ASSET
    // ============================================================
    public sealed record AssetCreateRequest(
        [Required, MaxLength(255)] string Name,
        AssetDomainType TypeProperty,
        AssetOwnershipType OwnershipType,
        [Required] AddressDto Address,
        GeoPointDto? Location,
        [Range(0, double.MaxValue)] double? Area,
        [Range(0, (double)decimal.MaxValue)] decimal? CurrentValue,
        DateTime? AcquisitionDate,
        string? Notes,
        [Range(0, 200)] int? Floors,
        [Range(0, 100)] int? Bedrooms,
        [Range(0, 100)] int? Bathrooms,
        [MaxLength(50)] string? HouseDirection,
        [MaxLength(100)] string? LegalStatus,
        [MaxLength(100)] string? FurnitureState);

    public sealed record AssetUpdateRequest(
        [Required, MaxLength(255)] string Name,
        AssetDomainType TypeProperty,
        AssetStatus Status,
        [Required] AddressDto Address,
        GeoPointDto? Location,
        double? Area,
        decimal? CurrentValue,
        DateTime? AcquisitionDate,
        string? Notes,
        [Range(0, 200)] int? Floors,
        [Range(0, 100)] int? Bedrooms,
        [Range(0, 100)] int? Bathrooms,
        [MaxLength(50)] string? HouseDirection,
        [MaxLength(100)] string? LegalStatus,
        [MaxLength(100)] string? FurnitureState
        );

    public sealed record AssetSearchQuery(
        string? Keyword,
        AssetDomainType? TypeProperty,
        AssetStatus? Status,
        AssetOwnershipType? OwnershipType,
        string? City,
        int Page = 1,
        int PageSize = 20);

    public sealed record NearbyQuery(
        [Range(-90, 90)] double Latitude,
        [Range(-180, 180)] double Longitude,
        [Range(1, 50_000)] double RadiusMeters = 2000,
        [Range(1, 100)] int Limit = 20);

    public sealed record AssetSummaryDto(
        Guid Id, string Name, AssetDomainType TypeProperty, AssetOwnershipType OwnershipType, AssetStatus Status,
        string City, string District, decimal? CurrentValue, string? ThumbnailUrl, int? LinkedPropertyId);

    public sealed record AssetNearbyDto(
        Guid Id, string Name, AssetDomainType TypeProperty, AssetStatus Status,
        double Latitude, double Longitude, double DistanceMeters);

    public sealed record AssetDetailDto(
        Guid Id, string Name, AssetDomainType TypeProperty, AssetOwnershipType OwnershipType, AssetStatus Status,
        AddressDto Address, GeoPointDto? Location, double? Area,
        decimal? CurrentValue, DateTime? AcquisitionDate, string? Notes,
        StoredFileDto? Thumbnail, int? LinkedPropertyId,
        int UnitCount, int ActiveContractCount, DateTime CreatedAt, DateTime? UpdatedAt, int? Floors, int? Bedrooms, int? Bathrooms,
        string? HouseDirection, string? LegalStatus, string? FurnitureState);

    // ============================================================
    // A4–A5. MEDIA & DOCUMENTS
    // ============================================================
    public sealed record AssetMediaUploadRequest(IFormFileCollection Files, string? Caption, DateTime? TakenAt);
    public sealed record AssetMediaDto(Guid Id, StoredFileDto File, string? Caption, DateTime TakenAt, int SortOrder);

    public sealed record AssetDocumentUploadRequest(
        [Required] IFormFile File,
        DocumentType Type,
        [Required, MaxLength(255)] string Title,
        DateTime? IssueDate,
        DateTime? ExpiryDate,
        Guid? LeaseContractId,
        string? Notes);

    public sealed record AssetDocumentDto(
        Guid Id, DocumentType Type, string Title, StoredFileDto File,
        DateTime? IssueDate, DateTime? ExpiryDate, Guid? LeaseContractId, string? Notes);

    public sealed record ExpiringDocumentDto(
        Guid Id, Guid AssetId, string AssetName, DocumentType Type, string Title, DateTime ExpiryDate);

    // ============================================================
    // A6. ASSET UNIT
    // ============================================================
    public sealed record AssetUnitRequest(
        [Required, MaxLength(100)] string Name,
        int? FloorNumber,
        double? Area,
        string? Notes);

    public sealed record AssetUnitDto(
        Guid Id, string Name, int? FloorNumber, double? Area, UnitStatus Status, string? Notes);

    // ============================================================
    // B1. CONTACT PARTY
    // ============================================================
    public sealed record ContactPartyRequest(
        ContactType Type,
        [Required, MaxLength(255)] string FullName,
        [MaxLength(20)] string? Phone,
        [EmailAddress, MaxLength(255)] string? Email,
        [MaxLength(20)] string? IdNumber,
        string? Notes);

    public sealed record ContactPartyDto(
        Guid Id, ContactType Type, string FullName, string? Phone, string? Email, string? IdNumber, string? Notes);

    // ============================================================
    // B2–B5. LEASE CONTRACT
    // ============================================================
    public sealed record LeaseContractCreateRequest(
        [Required] Guid AssetId,
        Guid? AssetUnitId,
        ContractDirection Direction,
        [Required] Guid CounterpartyId,
        DateTime StartDate,
        DateTime EndDate,
        [Range(0, (double)decimal.MaxValue)] decimal RentAmount,
        PaymentCycle PaymentCycle,
        [Range(1, 31)] int PaymentDueDay,
        decimal? DepositAmount,
        DateTime? NextRentIncreaseDate,
        TaxResponsibility TaxResponsibility,
        string? Notes,
        bool ActivateImmediately = true);

    public sealed record LeaseContractRenewRequest(
        DateTime NewStartDate,
        DateTime NewEndDate,
        [Range(0, (double)decimal.MaxValue)] decimal NewRentAmount,
        DateTime? NextRentIncreaseDate,
        string? Notes);

    public sealed record LeaseContractTerminateRequest(DateTime TerminatedAt, string? Reason);

    public sealed record LeaseContractSearchQuery(
        Guid? AssetId, Guid? AssetUnitId, ContractDirection? Direction, ContractStatus? Status,
        int Page = 1, int PageSize = 20);

    public sealed record LeaseContractDto(
        Guid Id, Guid AssetId, string AssetName, Guid? AssetUnitId, string? AssetUnitName,
        ContractDirection Direction, ContractStatus Status,
        Guid CounterpartyId, string CounterpartyName, string? CounterpartyPhone,
        DateTime StartDate, DateTime EndDate, decimal RentAmount,
        PaymentCycle PaymentCycle, int PaymentDueDay, decimal? DepositAmount,
        DateTime? NextRentIncreaseDate, TaxResponsibility TaxResponsibility,
        Guid? ParentContractId, string? Notes);

    public sealed record ExpiringContractDto(
        Guid Id, Guid AssetId, string AssetName, string? AssetUnitName,
        ContractDirection Direction, string CounterpartyName, DateTime EndDate, int DaysLeft);

    // ============================================================
    // C. CASH FLOW & REPORTS
    // ============================================================
    public sealed record CashFlowCreateRequest(
        [Required] Guid AssetId,
        Guid? AssetUnitId,
        Guid? LeaseContractId,
        CashFlowDirection Direction,
        CashFlowCategory Category,
        [Range(0.01, (double)decimal.MaxValue)] decimal Amount,
        DateTime OccurredAt,
        DateTime? PeriodStart,
        DateTime? PeriodEnd,
        [MaxLength(500)] string? Description,
        IFormFile? Receipt);

    public sealed record CashFlowQuery(
        Guid? AssetId,
        CashFlowDirection? Direction,
        CashFlowCategory? Category,
        DateTime? From,
        DateTime? To,
        string? Cursor,
        [Range(1, 100)] int PageSize = 30);

    public sealed record CashFlowDto(
        Guid Id, Guid AssetId, string AssetName, Guid? AssetUnitId, Guid? LeaseContractId,
        CashFlowDirection Direction, CashFlowCategory Category, decimal Amount,
        DateTime OccurredAt, DateTime? PeriodStart, DateTime? PeriodEnd,
        string? Description, StoredFileDto? Receipt);

    public sealed record IncomeReportQuery(DateTime From, DateTime To, Guid? AssetId);
    public sealed record MonthlyAmountDto(int Year, int Month, decimal Amount);
    public sealed record IncomeReportDto(
        DateTime From, DateTime To, decimal TotalIncome, IReadOnlyList<MonthlyAmountDto> ByMonth);

    public sealed record ProfitReportQuery([Required] Guid AssetId, DateTime From, DateTime To);
    public sealed record CategoryAmountDto(CashFlowCategory Category, decimal Amount);
    public sealed record ProfitReportDto(
        Guid AssetId, string AssetName, DateTime From, DateTime To,
        decimal TotalIncome, decimal TotalExpense, decimal Profit,
        IReadOnlyList<CategoryAmountDto> IncomeBreakdown,
        IReadOnlyList<CategoryAmountDto> ExpenseBreakdown,
        // Tiền cọc KHÔNG phải doanh thu/chi phí — là khoản phải trả lại. Tách khỏi
        // Profit và báo riêng. Tham số mới BẮT BUỘC đặt ở CUỐI record positional.
        decimal DepositHeld);

    public sealed record TaxReportDto(
        int Year, decimal TotalTax, IReadOnlyList<CategoryAmountDto> ByTaxType);

    // ============================================================
    // D1. REMINDER
    // ============================================================
    public sealed record ReminderCreateRequest(
        Guid? AssetId,
        Guid? LeaseContractId,
        ReminderType Type,
        [Required, MaxLength(255)] string Title,
        DateTime DueDate,
        RecurrenceCycle Cycle,
        [Range(0, 90)] int NotifyDaysBefore);

    public sealed record ReminderUpdateRequest(
        [Required, MaxLength(255)] string Title,
        DateTime DueDate,
        RecurrenceCycle Cycle,
        [Range(0, 90)] int NotifyDaysBefore,
        bool IsActive);

    public sealed record ReminderDto(
        Guid Id, Guid? AssetId, string? AssetName, Guid? LeaseContractId,
        ReminderType Type, string Title, DateTime DueDate,
        RecurrenceCycle Cycle, int NotifyDaysBefore, bool IsActive, DateTime? LastNotifiedAt);

    // ============================================================
    // D3. MAINTENANCE
    // ============================================================
    public sealed record MaintenanceRequest(
        Guid? AssetUnitId,
        [Required, MaxLength(255)] string Title,
        string? Description,
        DateTime StartDate,
        DateTime? CompletedDate,
        [Range(0, (double)decimal.MaxValue)] decimal? Cost,
        Guid? VendorId,
        string? Notes,
        /// <summary>true → tự ghi một CashFlowEntry (MaintenanceCost) khi có Cost.</summary>
        bool RecordAsExpense = true);

    public sealed record MaintenanceDto(
        Guid Id, Guid? AssetUnitId, string Title, string? Description,
        DateTime StartDate, DateTime? CompletedDate, decimal? Cost,
        Guid? VendorId, string? VendorName, string? Notes);

    // ============================================================
    // D4. EQUIPMENT
    // ============================================================
    public sealed record EquipmentRequest(
        Guid? AssetUnitId,
        [Required, MaxLength(255)] string Name,
        [Range(1, int.MaxValue)] int Quantity,
        EquipmentCondition Condition,
        EquipmentSource Source,
        string? Notes);

    public sealed record EquipmentDto(
        Guid Id, Guid? AssetUnitId, string Name, int Quantity,
        EquipmentCondition Condition, EquipmentSource Source, string? Notes);
}
