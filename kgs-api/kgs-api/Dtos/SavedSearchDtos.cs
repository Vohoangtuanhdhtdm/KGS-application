using System.ComponentModel.DataAnnotations;

namespace kgs_api.Dtos
{
    /// <summary>Lưu bộ lọc hiện tại. Tiêu chí gửi lên đúng bằng thứ trang tìm kiếm đang
    /// dùng — client không phải dịch sang một hình dạng khác.</summary>
    public sealed record CreateSavedSearchRequest(
        [Required, MaxLength(120)] string Name,
        [Required] PublicListingSearchQuery Criteria,
        bool NotifyEnabled = true);

    public sealed record SavedSearchDto(
        Guid Id,
        string Name,
        PublicListingSearchQuery Criteria,
        bool NotifyEnabled,
        DateTime CreatedAt,
        DateTime? LastNotifiedAt,
        /// <summary>Số tin khớp bộ lọc và được duyệt SAU lần đối chiếu gần nhất.
        /// Đây là con số hiện trên huy hiệu "3 tin mới" cạnh bộ lọc đã lưu.</summary>
        int NewCount);
}
