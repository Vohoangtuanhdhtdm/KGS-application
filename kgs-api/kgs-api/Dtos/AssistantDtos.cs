using System.ComponentModel.DataAnnotations;

namespace kgs_api.Dtos
{
    /// <summary>Điểm người dùng muốn ở gần ("làm ở đường Hàm Nghi"), kèm thời gian đi lại
    /// hoặc bán kính. Giao diện tìm điểm này trên bản đồ — LLM không quyết định toạ độ.</summary>
    public sealed record AssistantAnchorDto(
        [Required, MaxLength(120)] string Text,
        int? TravelMinutes,
        /// <summary>walking | cycling | driving</summary>
        string? TravelMode,
        double? RadiusKm);

    /// <summary>Một câu gửi cho trợ lý. Current/CurrentPreferences/CurrentAnchor = trạng thái
    /// sau câu trước, để câu sau là điều chỉnh ("rẻ hơn chút", "bỏ điều kiện thú cưng").</summary>
    public sealed record AssistantSearchRequest(
        [Required, MinLength(2), MaxLength(500)] string Message,
        PublicListingSearchQuery? Current,
        List<string>? CurrentPreferences,
        AssistantAnchorDto? CurrentAnchor);

    public sealed record AssistantSearchResult(
        /// <summary>Bộ lọc CỨNG — đi thẳng vào /api/listings/search.</summary>
        PublicListingSearchQuery Criteria,
        /// <summary>Mong muốn MỀM — gửi kèm dưới dạng Prefer, chỉ ảnh hưởng thứ tự.</summary>
        List<string> Preferences,
        AssistantAnchorDto? Anchor,
        /// <summary>Phần trợ lý không biểu diễn được thành bộ lọc — nói thật với người dùng.</summary>
        List<string> Unrecognized,
        string Model,
        long LatencyMs,
        int TotalTokens);
}
