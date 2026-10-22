using System.ComponentModel.DataAnnotations;

namespace kgs_api.Dtos
{
    /// <summary>Lưu bộ lọc hiện tại. Tiêu chí gửi lên đúng bằng thứ trang tìm kiếm đang
    /// dùng — client không phải dịch sang một hình dạng khác.</summary>
    public sealed record CreateSavedSearchRequest(
        [Required, MaxLength(120)] string Name,
        [Required] PublicListingSearchQuery Criteria,
        bool NotifyEnabled = true,
        /// <summary>Mở luôn cho chủ nhà phù hợp mời — "Đăng nhu cầu".</summary>
        bool Discoverable = false,
        [MaxLength(300)] string? DemandNote = null);

    public sealed record SavedSearchDto(
        Guid Id,
        string Name,
        PublicListingSearchQuery Criteria,
        bool NotifyEnabled,
        DateTime CreatedAt,
        DateTime? LastNotifiedAt,
        /// <summary>Số tin khớp bộ lọc và được duyệt SAU lần đối chiếu gần nhất.
        /// Đây là con số hiện trên huy hiệu "3 tin mới" cạnh bộ lọc đã lưu.</summary>
        int NewCount,
        /// <summary>Đang cho chủ tin phù hợp thấy nhu cầu này (ẩn danh).</summary>
        bool DiscoverableByOwners,
        string? DemandNote,
        /// <summary>Hạn của chế độ mở. Cờ tắt mà hạn đã qua = "Đã hết hạn".</summary>
        DateTime? DiscoverableUntil,
        /// <summary>Số tin đang hiển thị khớp nhu cầu, và số chủ nhà khác nhau của chúng.</summary>
        int MatchingListings,
        int MatchingOwners);
}
