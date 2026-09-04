using System.ComponentModel.DataAnnotations;
using kgs_api.Common;

namespace kgs_api.Domain.Entity.SubEntity
{
    /// <summary>Một bộ lọc người dùng đã lưu, kèm tuỳ chọn báo khi có tin mới khớp.
    ///
    /// Người đi tìm thuê hiếm khi tìm được nhà trong một buổi. Họ lọc ra đúng thứ mình cần,
    /// không thấy gì vừa ý, rồi hôm sau phải gõ lại toàn bộ từ đầu — và đa số thì không
    /// quay lại. Lưu bộ lọc biến việc tìm nhà từ một lần tra cứu thành một cuộc theo dõi
    /// kéo dài, và đó cũng là lý do thứ hai để họ tạo tài khoản (lý do thứ nhất là
    /// <see cref="SavedListing"/>).</summary>
    public class SavedSearch : BaseAuditableEntity
    {
        [Required] public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        /// <summary>Tên do người dùng đặt, hoặc do client tóm tắt từ chính bộ lọc
        /// ("Phòng trọ · Quận 1 · dưới 8 triệu").</summary>
        [Required, MaxLength(120)] public string Name { get; set; } = string.Empty;

        /// <summary>Toàn bộ tiêu chí, lưu dạng jsonb của <c>PublicListingSearchQuery</c>.
        ///
        /// Cố tình KHÔNG tách thành từng cột. Tiêu chí tìm kiếm còn phải mọc thêm nhiều —
        /// mỗi bộ lọc mới sẽ là một cột mới, một migration mới, và một chỗ nữa để quên cập
        /// nhật. Đánh đổi là không lọc ngược được "bộ lọc nào khớp tin này" bằng SQL; job
        /// đối chiếu vì thế duyệt theo từng bộ lọc đã lưu, đủ rẻ vì nó chạy mỗi ngày một
        /// lần chứ không phải mỗi lần có tin mới.</summary>
        [Required] public string CriteriaJson { get; set; } = "{}";

        public bool NotifyEnabled { get; set; } = true;

        /// <summary>Mốc "tin mới" tính từ đây. Tin được duyệt sau mốc này mà khớp bộ lọc thì
        /// được coi là mới với người dùng.</summary>
        public DateTime LastCheckedAt { get; set; }

        /// <summary>Lần gần nhất thực sự gửi được thông báo. Null = chưa từng có tin nào
        /// khớp kể từ lúc lưu.</summary>
        public DateTime? LastNotifiedAt { get; set; }
    }
}
