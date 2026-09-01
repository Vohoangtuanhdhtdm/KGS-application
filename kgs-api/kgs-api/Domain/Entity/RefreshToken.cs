using kgs_api.Common;

namespace kgs_api.Domain.Entity
{
    /// <summary>
    /// Refresh token lưu DB — cho phép thu hồi (revoke) khi đăng xuất hoặc phát hiện token bị đánh cắp.
    /// Một user có nhiều refresh token đồng thời (nhiều thiết bị).
    /// </summary>
    public class RefreshToken : BaseAuditableEntity
    {
        public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        /// <summary>Chuỗi token (base64 32 byte ngẫu nhiên từ TokenService.GenerateRefreshToken()).</summary>
        public string Token { get; set; } = string.Empty;

        public DateTime ExpiresAt { get; set; }

        /// <summary>Thời điểm bị thu hồi. null = còn hiệu lực.</summary>
        public DateTime? RevokedAt { get; set; }

        /// <summary>Token thay thế khi rotate — phục vụ phát hiện tái sử dụng token cũ (token reuse detection).</summary>
        public string? ReplacedByToken { get; set; }

        /// <summary>IP của lần tạo — hỗ trợ audit khi có nghi vấn.</summary>
        public string? CreatedByIp { get; set; }

        // Computed — không map vào DB
        public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
        public bool IsActive => RevokedAt is null && !IsExpired;
    }
}

