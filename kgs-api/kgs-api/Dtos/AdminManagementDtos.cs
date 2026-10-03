using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Dtos
{
    // ============================================================
    // QUẢN TRỊ — mọi tin đăng (A2) và người dùng (A3)
    // ============================================================

    public sealed record AdminListingRowDto(
        Guid Id,
        string? Slug,
        string Title,
        ListingType Type,
        ListingStatus Status,
        decimal Price,
        PaymentCycle? RentPaymentCycle,
        AssetDomainType AssetType,
        string City,
        string District,
        string? UnitName,
        string OwnerId,
        string OwnerName,
        string OwnerEmail,
        bool OwnerLocked,
        DateTime CreatedAt,
        DateTime? PublishedAt,
        int ViewCount,
        int PendingReports,
        int ConfirmedReports,
        string? ModerationNote,
        /// <summary>Tin do quản trị gỡ/đóng — khôi phục được (AdminRules.CanRestore).</summary>
        bool CanRestore);

    public sealed record PagedAdminResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

    public sealed record AdminTakeDownRequest(
        [Required, MinLength(1)] List<ModerationReason> Reasons,
        [MaxLength(500)] string? Note);

    public sealed record AdminRestoreRequest([MaxLength(500)] string? Note);

    public sealed record AdminUserRowDto(
        string Id,
        string Name,
        string Email,
        string? Phone,
        DateTime CreatedAt,
        bool EmailConfirmed,
        bool IsAdmin,
        bool IsLocked,
        DateTimeOffset? LockedUntil,
        string? LockReason,
        int ListingCount,
        int LiveListingCount,
        /// <summary>Số báo vi phạm đã được XÁC NHẬN trên tin của người này.</summary>
        int ConfirmedViolations,
        int PendingReports);

    public sealed record AdminUserDetailDto(
        AdminUserRowDto User,
        DateTime? LockedAt,
        string? LockedByName,
        IReadOnlyList<AdminListingRowDto> Listings);

    public sealed record AdminLockUserRequest(
        [Required, MinLength(5), MaxLength(500)] string Reason,
        /// <summary>Số ngày khoá; null = vô thời hạn.</summary>
        [Range(1, 3650)] int? Days,
        /// <summary>Gỡ luôn mọi tin đang hiển thị và đang chờ duyệt của người này.</summary>
        bool HideListings = true);

    public sealed record AdminUnlockUserRequest(
        /// <summary>Khôi phục những tin đã bị gỡ CÙNG lúc khoá (không đụng tin bị gỡ vì lý do khác).</summary>
        bool RestoreListings = true);

    public sealed record AdminSetRoleRequest(bool Admin);

    public sealed record AdminActionResultDto(string Message, int AffectedListings);
}
