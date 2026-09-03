using System.ComponentModel.DataAnnotations;

namespace kgs_api.Domain.Entity.SubEntity
{
    /// <summary>Tin đăng người dùng đã lưu.
    ///
    /// Lý do đầu tiên để người ĐI TÌM THUÊ tạo tài khoản: trước đây mọi thứ họ làm được
    /// trên marketplace đều là [AllowAnonymous], nên không có động cơ nào để đăng ký.
    ///
    /// Khoá chính tổ hợp (UserId, ListingId) — lưu hai lần không nhân bản bản ghi.</summary>
    public class SavedListing
    {
        [Required] public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        public Guid ListingId { get; set; }
        public Listing Listing { get; set; } = null!;

        public DateTime SavedAt { get; set; }
    }
}
