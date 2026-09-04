using System.ComponentModel.DataAnnotations;

using static kgs_api.Domain.Enums;

namespace kgs_api.Dtos.Auth
{
    // ==================== ĐĂNG KÝ / ĐĂNG NHẬP ====================

    public sealed record RegisterRequest(
        [Required(ErrorMessage = "Email không được để trống")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ")]
        [MaxLength(255)]
        string Email,

        [Required(ErrorMessage = "Họ tên không được để trống")]
        [MaxLength(255)]
        string Name,

        [Required(ErrorMessage = "Mật khẩu không được để trống")]
        [MinLength(8, ErrorMessage = "Mật khẩu tối thiểu 8 ký tự")]
        [MaxLength(100)]
        string Password,

        [Phone(ErrorMessage = "Số điện thoại không hợp lệ")]
        [MaxLength(20)]
        string? PhoneNumber);

    public sealed record LoginRequest(
        [Required(ErrorMessage = "Email không được để trống")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ")]
        string Email,

        [Required(ErrorMessage = "Mật khẩu không được để trống")]
        string Password);

    public sealed record ExternalLoginRequest(
         [Required] string Provider,
         [Required] string Token);

    /// <summary>Trả về sau register/login/refresh. RefreshToken KHÔNG nằm trong body
    /// nếu bạn chọn cách gửi qua HttpOnly cookie (xem ghi chú trong AccountController).</summary>
    public sealed record AuthResponse(
        string UserId,
        string Email,
        string Name,
        string? AvatarUrl,
        IList<string> Roles,
        bool EmailConfirmed,
        string AccessToken,
        DateTime AccessTokenExpiresAt,
        string RefreshToken,
        DateTime RefreshTokenExpiresAt);

    // ==================== REFRESH / LOGOUT ====================

    public sealed record RefreshTokenRequest(
        [Required] string RefreshToken);

    // ==================== XÁC THỰC EMAIL ====================

    public sealed record ConfirmEmailRequest(
        [Required] string UserId,
        [Required] string Token);

    public sealed record ResendConfirmationRequest(
        [Required, EmailAddress] string Email);

    // ==================== QUÊN / ĐỔI / ĐẶT LẠI MẬT KHẨU ====================

    public sealed record ForgotPasswordRequest(
        [Required, EmailAddress] string Email);

    public sealed record ResetPasswordRequest(
        [Required] string UserId,
        [Required] string Token,

        [Required]
        [MinLength(8, ErrorMessage = "Mật khẩu tối thiểu 8 ký tự")]
        [MaxLength(100)]
        string NewPassword);

    public sealed record ChangePasswordRequest(
        [Required] string CurrentPassword,

        [Required]
        [MinLength(8, ErrorMessage = "Mật khẩu tối thiểu 8 ký tự")]
        [MaxLength(100)]
        string NewPassword);

    // ==================== THÔNG TIN TÀI KHOẢN ====================

    public sealed record CurrentUserDto(
        string UserId,
        string Email,
        string Name,
        string? AvatarUrl,
        string? Bio,
        string? PhoneNumber,
        bool EmailConfirmed,
        IList<string> Roles,
        DateTime CreatedAt);

    public sealed record UpdateProfileRequest(
        [Required, MaxLength(255)] string Name,
        [MaxLength(1000)] string? Bio,
        [Phone, MaxLength(20)] string? PhoneNumber);

    // ==================== ADMIN — DUYỆT TIN ĐĂNG ====================

    public sealed record ApproveListingRequest(
        [MaxLength(500)] string? Note);

    public sealed record RejectListingRequest(
        [Required(ErrorMessage = "Phải nêu lý do từ chối")]
        [MaxLength(500)]
        string Reason);

    public sealed record PendingListingDto(
        Guid Id,
        string Title,
        decimal Price,
        string City,
        string District,
        string? UnitName,
        string OwnerName,
        string OwnerEmail,
        DateTime CreatedAt,
        int ImageCount);

    /// <summary>Toàn bộ nội dung admin cần để RA QUYẾT ĐỊNH, trong một lời gọi.
    ///
    /// Trước đây trang duyệt chỉ có một bảng danh sách và admin phải bấm duyệt mà không
    /// xem được nội dung tin — đó là kiểm duyệt hình thức, không dùng thật được.</summary>
    public sealed record AdminListingDetailDto(
        Guid Id,
        string Title,
        string Description,
        ListingType Type,
        ListingStatus Status,
        decimal Price,
        PaymentCycle? RentPaymentCycle,
        decimal TotalMonthlyCost,

        // Địa chỉ và đặc điểm — đọc từ Asset
        string City, string District, string Ward, string AddressDetail,
        double? Latitude, double? Longitude,
        AssetDomainType AssetType, string AssetTypeLabel, string? UnitName,
        double? Area, int? Bedrooms, int? Bathrooms, int? Floors,
        string? HouseDirection, string? LegalStatus, string? FurnitureState,

        IReadOnlyList<string> ImageUrls,
        IReadOnlyList<string> Amenities,
        int CompletenessPercent,

        // Người đăng — để nhận ra tài khoản đăng hàng loạt tin rác
        string OwnerId, string OwnerName, string OwnerEmail, string? OwnerPhone,
        int OwnerListingCount,

        DateTime CreatedAt,
        string? ModerationNote);

    /// <summary>Duyệt hoặc từ chối nhiều tin cùng lúc. Hàng đợi kiểm duyệt thật luôn có
    /// những cụm tin rõ ràng cùng loại; bắt bấm từng cái là bắt làm việc thừa.</summary>
    public sealed record BulkModerateRequest(
        [Required] List<Guid> ListingIds,
        bool Approve,
        [MaxLength(500)] string? Reason);

    public sealed record BulkModerateResultDto(int Succeeded, int Skipped, IReadOnlyList<string> Messages);
}
