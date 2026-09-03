using static kgs_api.Domain.Enums;

namespace kgs_api.Interfaces
{
    /// <summary>Ba nhánh truy hồi. Cố tình để lộ ra thành tham số thay vì giấu trong cấu
    /// hình: chương Đánh giá của đồ án cần chạy CÙNG một bộ truy vấn qua cả ba nhánh rồi
    /// so Precision@5, nên chúng phải gọi được độc lập từ bên ngoài.</summary>
    public enum RetrievalMode
    {
        /// <summary>Chỉ lọc cứng bằng SQL. Đây là baseline — hệ thống lọc dropdown hiện nay.</summary>
        FilterOnly = 1,

        /// <summary>Lọc cứng + xếp hạng bằng full-text tiếng Việt (tsvector, đã bỏ dấu).</summary>
        Keyword = 2,

        /// <summary>Lọc cứng + xếp hạng bằng độ tương đồng vector (ngữ nghĩa).</summary>
        Vector = 3,

        /// <summary>Lọc cứng + hợp nhất Keyword và Vector bằng Reciprocal Rank Fusion.</summary>
        Hybrid = 4
    }

    /// <summary>Điều kiện tìm kiếm đã được tách sẵn. AI Agent sinh ra đúng object này ở
    /// Bước 1 (Claude đọc câu hỏi tự nhiên) rồi truyền thẳng xuống đây.</summary>
    public sealed record RetrievalQuery(
        /// <summary>Nguyên văn câu người dùng gõ. Dùng cho nhánh Keyword và Vector.</summary>
        string? FreeText,

        // ---- Điều kiện cứng ----
        ListingType? Type = null,
        string? City = null,
        string? District = null,
        decimal? TotalCostMax = null,
        int? BedroomsMin = null,
        bool? PetsAllowed = null,
        bool? CurfewFree = null,
        bool? SharedWithOwner = null,
        DateTime? AvailableBy = null,
        IReadOnlyList<string>? Amenities = null,

        int Limit = 20);

    public sealed record RetrievalHit(
        Guid ListingId,
        string Slug,
        string Title,
        decimal TotalMonthlyCost,
        /// <summary>Điểm của nhánh đang chạy. Không so sánh được giữa các nhánh khác nhau —
        /// chỉ dùng để xếp thứ tự trong cùng một nhánh.</summary>
        double Score,
        /// <summary>Hạng ở nhánh từ khoá, null nếu nhánh đó không trả về tin này.</summary>
        int? KeywordRank,
        int? VectorRank);

    public interface IListingRetrievalService
    {
        Task<IReadOnlyList<RetrievalHit>> SearchAsync(
            RetrievalQuery query, RetrievalMode mode, CancellationToken ct = default);
    }
}
