namespace kgs_api.Dtos
{
    /// <summary>Một ngày trên biểu đồ lượt xem.</summary>
    public sealed record DailyViewPoint(DateOnly Date, int Views);

    /// <summary>Bảng phân tích của MỘT tin đăng (nhiệm vụ 1.8).
    ///
    /// Câu hỏi thật sự của người đăng tin không phải "tin tôi có bao nhiêu lượt xem" mà
    /// "vì sao chưa ai gọi". Nên mọi con số ở đây đều nhằm tách ra một trong ba nguyên
    /// nhân: không ai nhìn thấy tin, có nhìn nhưng không đủ hấp dẫn, hay giá lệch mặt bằng.</summary>
    public sealed record ListingAnalyticsDto(
        Guid ListingId,
        string Title,
        string? Slug,

        // ---- Mức độ tiếp cận ----
        int TotalViews,
        int Views7Days,
        int Views30Days,
        /// <summary>Lượt xem từng ngày trong 30 ngày gần nhất, kể cả ngày 0 lượt.
        /// Bỏ ngày rỗng đi thì đường biểu đồ tự nối liền qua khoảng trống và trông như tin
        /// vẫn đều đặn có người xem.</summary>
        IReadOnlyList<DailyViewPoint> DailyViews,

        // ---- Mức độ quan tâm ----
        int SavedCount,
        int InquiryCount,
        /// <summary>Tỉ lệ người xem rồi gửi yêu cầu xem nhà, tính theo phần trăm.
        /// Xem nhiều mà không ai liên hệ nghĩa là tin lên được kết quả tìm kiếm nhưng nội
        /// dung chưa đủ thuyết phục — thiếu ảnh, thiếu điều kiện thuê, hoặc giá cao.</summary>
        double InquiryRatePercent,

        // ---- So với mặt bằng khu vực ----
        /// <summary>Giá trung vị của các tin đang hiển thị cùng loại, cùng quận.
        /// Dùng trung vị chứ không phải trung bình: một biệt thự trong danh sách phòng trọ
        /// đủ kéo trung bình lên tới mức vô nghĩa.</summary>
        decimal? AreaMedianPrice,
        /// <summary>Số tin cùng loại, cùng quận đang cạnh tranh trực tiếp với tin này.</summary>
        int AreaListingCount,
        /// <summary>Chênh lệch giá của tin so với trung vị khu vực, theo phần trăm.
        /// Dương = đắt hơn mặt bằng. Null khi khu vực chưa đủ tin để so.</summary>
        double? PriceDiffPercent,

        // ---- Chất lượng tin ----
        int CompletenessPercent,
        int ImageCount,
        /// <summary>Gợi ý cụ thể để tin dễ được tìm thấy hơn. Rỗng nghĩa là tin đã đủ.</summary>
        IReadOnlyList<string> Suggestions);

    /// <summary>Tổng quan mọi tin của một người đăng — màn hình đầu tiên họ thấy.</summary>
    public sealed record OwnerAnalyticsSummaryDto(
        int TotalListings,
        int ApprovedListings,
        int TotalViews30Days,
        int TotalInquiries,
        int TotalSaved,
        IReadOnlyList<DailyViewPoint> DailyViews,
        /// <summary>Các tin xếp theo lượt xem 30 ngày, nhiều nhất trước.</summary>
        IReadOnlyList<ListingPerformanceRow> Listings);

    public sealed record ListingPerformanceRow(
        Guid ListingId,
        string Title,
        string? Slug,
        int Views30Days,
        int SavedCount,
        int InquiryCount,
        int CompletenessPercent);
}
