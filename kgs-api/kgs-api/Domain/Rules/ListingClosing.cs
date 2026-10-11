using kgs_api.Domain.Entity;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Rules
{
    /// <summary>Thống kê kết quả các tin đã đóng.</summary>
    /// <param name="ViaKgsShare">Trong các tin đóng vì đã có khách (qua KGS hoặc kênh khác), phần
    /// nào là qua KGS — "tỷ lệ kết nối thành công". Null khi chưa có tin nào như vậy.</param>
    public sealed record CloseOutcomeStatsDto(
        int ViaKgs, int Elsewhere, int Withdrawn, int Expired, int ReportedTaken, int Unknown,
        double? ViaKgsShare);

    /// <summary>Đóng tin và ghi lại VÌ SAO đóng — điểm cuối của chuỗi "kết nối".
    ///
    /// Không có lý do, hệ thống chỉ biết một tin đã biến mất khỏi trang tìm kiếm; không phân biệt
    /// được "cho thuê được nhờ nền tảng" với "chủ nhà chán, gỡ tin". Lý do đóng là thước đo trực
    /// tiếp nhất cho câu hỏi đề tài đặt ra: nền tảng có kết nối được người tìm nhà với người đăng
    /// tin hay không.</summary>
    public static class ListingClosing
    {
        /// <summary>Những lý do người đăng tin được tự chọn. Hết hạn và đóng theo báo vi phạm do hệ
        /// thống ghi — để người đăng tin chọn thì số liệu "qua KGS" có thể bị làm đẹp bằng tay.</summary>
        public static readonly IReadOnlySet<ListingCloseReason> OwnerReasons = new HashSet<ListingCloseReason>
        {
            ListingCloseReason.TakenViaKgs,
            ListingCloseReason.TakenElsewhere,
            ListingCloseReason.Withdrawn,
        };

        public static void Close(Listing listing, ListingCloseReason reason, DateTime nowUtc)
        {
            listing.Status = ListingStatus.Closed;
            listing.CloseReason = reason;
            listing.ClosedAt = nowUtc;
        }

        /// <summary>Mở lại: tin quay về vòng đời bình thường, lý do đóng cũ không còn đúng nữa.</summary>
        public static void ClearClose(Listing listing)
        {
            listing.CloseReason = null;
            listing.ClosedAt = null;
        }

        public static CloseOutcomeStatsDto Summarize(IEnumerable<ListingCloseReason?> reasons)
        {
            int via = 0, elsewhere = 0, withdrawn = 0, expired = 0, reported = 0, unknown = 0;
            foreach (var r in reasons)
            {
                switch (r)
                {
                    case ListingCloseReason.TakenViaKgs: via++; break;
                    case ListingCloseReason.TakenElsewhere: elsewhere++; break;
                    case ListingCloseReason.Withdrawn: withdrawn++; break;
                    case ListingCloseReason.Expired: expired++; break;
                    case ListingCloseReason.ReportedTaken: reported++; break;
                    default: unknown++; break;
                }
            }
            var deals = via + elsewhere;
            return new CloseOutcomeStatsDto(via, elsewhere, withdrawn, expired, reported, unknown,
                deals == 0 ? null : Math.Round((double)via / deals, 3));
        }
    }
}
