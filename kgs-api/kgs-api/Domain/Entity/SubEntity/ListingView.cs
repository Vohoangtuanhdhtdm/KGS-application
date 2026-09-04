using System.ComponentModel.DataAnnotations;

namespace kgs_api.Domain.Entity.SubEntity
{
    /// <summary>Một lượt xem tin đăng đã khử trùng.
    ///
    /// Bộ đếm <c>Listing.ViewCount</c> cộng một mỗi lần có request. Ai cũng thấy ngay điều
    /// đó nói dối: chủ tin bấm F5 mười lần là tin có mười lượt xem, và bot quét trang còn
    /// chăm hơn người thật. Một con số ai cũng biết là sai thì không ai dùng để quyết định
    /// gì — mà 1.8 lại dựng bảng phân tích ngay trên con số đó.
    ///
    /// Bảng này ghi TỪNG lượt xem kèm dấu vân người xem, nhờ đó vừa khử được trùng vừa
    /// dựng được biểu đồ theo ngày. <c>Listing.ViewCount</c> vẫn giữ, giờ chỉ tăng khi lượt
    /// xem thực sự mới, nên nó khớp với số dòng ở đây.</summary>
    public class ListingView
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ListingId { get; set; }
        public Listing Listing { get; set; } = null!;

        /// <summary>SHA-256 của (IP + user agent + muối theo ngày), cắt lấy 32 ký tự hex.
        ///
        /// KHÔNG lưu IP thô. Địa chỉ IP là dữ liệu cá nhân, và thứ ta cần chỉ là trả lời
        /// "có phải người này vừa xem không" — băm là đủ. Muối đổi theo ngày nên không thể
        /// lần ngược một người qua nhiều ngày kể cả khi có cả bảng này.</summary>
        [Required, MaxLength(32)] public string ViewerHash { get; set; } = string.Empty;

        /// <summary>Có giá trị khi người xem đã đăng nhập. Dùng để khử trùng chính xác hơn
        /// dấu vân IP — cùng một người dùng trên hai mạng khác nhau vẫn là một lượt.</summary>
        public string? ViewerUserId { get; set; }

        public DateTime ViewedAt { get; set; }

        /// <summary>Ngày (UTC) của lượt xem, tách sẵn thành cột.
        ///
        /// Khử trùng là "một người, một tin, một NGÀY". Ép kiểu ViewedAt sang date ngay
        /// trong mệnh đề WHERE thì PostgreSQL không dùng được index; có cột riêng thì khoá
        /// duy nhất chạy thẳng trên index, và biểu đồ theo ngày cũng gom nhóm trên chính
        /// cột đó.</summary>
        public DateOnly ViewedOn { get; set; }
    }
}
