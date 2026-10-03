using Microsoft.AspNetCore.Identity;

namespace kgs_api.Domain.Entity
{
    public class ApplicationUser : IdentityUser
    {
        public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
        public string Name { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
        public string? Bio { get; set; } 
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // ---- Khoá tài khoản bởi quản trị viên ----
        // Tách khỏi cơ chế khoá tạm của Identity (đăng nhập sai 5 lần → 15 phút): cả hai cùng
        // dùng LockoutEnd, nhưng chỉ khoá do admin mới có lý do, người khoá và hiệu lực tức thì
        // với cả phiên đang mở (xem UserAccessGuard).

        /// <summary>Lý do admin khoá — hiện cho chính người bị khoá khi họ đăng nhập.</summary>
        [System.ComponentModel.DataAnnotations.MaxLength(500)]
        public string? AdminLockReason { get; set; }
        public DateTime? AdminLockedAt { get; set; }
        public string? AdminLockedByUserId { get; set; }
    }
}
