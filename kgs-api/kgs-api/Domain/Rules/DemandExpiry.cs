using System.Linq.Expressions;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Dtos;

namespace kgs_api.Domain.Rules
{
    public enum ExpiryAction { None, Remind, Close }

    /// <summary>Hạn của chế độ "cho chủ nhà phù hợp mời tôi".
    ///
    /// Nhu cầu tìm nhà cũ đi rất nhanh: người ta tìm được nhà rồi thì hiếm ai quay lại tắt. Để
    /// mở mãi thì chủ nhà mời những người đã thôi tìm, và Nhịp cầu đếm cả họ. Mở 30 ngày, nhắc
    /// một lần khi còn 3 ngày, hết hạn thì CHỈ tắt chế độ mở — bộ lọc và báo tin mới giữ nguyên.</summary>
    public static class DemandExpiry
    {
        public static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);
        public static readonly TimeSpan RemindBefore = TimeSpan.FromDays(3);

        /// <summary>Hạn khi bật hoặc gia hạn: tính từ lúc bấm, không cộng dồn hạn cũ.</summary>
        public static DateTime UntilFrom(DateTime now) => now + Lifetime;

        /// <summary>Hạn trống (dữ liệu trước khi có hạn) vẫn coi là mở — migration đã đặt hạn
        /// cho chúng, đây chỉ là lưới an toàn.</summary>
        public static bool IsOpen(bool discoverable, DateTime? until, DateTime now)
            => discoverable && (until is null || until > now);

        /// <summary>Cùng điều kiện với <see cref="IsOpen"/>, dạng EF dịch được sang SQL. Mọi chỗ
        /// đọc "nhu cầu đang mở" phải đi qua đây: job tắt nhu cầu hết hạn chỉ chạy mỗi sáng,
        /// trong lúc chờ thì cờ vẫn bật dù đã quá hạn.</summary>
        public static Expression<Func<SavedSearch, bool>> OpenAt(DateTime now)
            => s => s.DiscoverableByOwners && (s.DiscoverableUntil == null || s.DiscoverableUntil > now);

        /// <summary>Nhu cầu chỉ được mở cho chủ nhà khi có KHU VỰC (tỉnh/thành, mã tỉnh mới, hoặc
        /// vòng bán kính quanh một điểm). Không có thì nó khớp mọi tin cả nước: mọi chủ nhà đều thấy
        /// và được báo về một người không hề tìm ở chỗ họ.</summary>
        public static bool HasArea(PublicListingSearchQuery q)
            => !string.IsNullOrWhiteSpace(q.City)
               || !string.IsNullOrWhiteSpace(q.NewProvinceCode)
               || (q.Latitude is not null && q.Longitude is not null && q.RadiusMeters is not null);

        public static ExpiryAction Decide(bool discoverable, DateTime? until, DateTime? remindedAt, DateTime now)
        {
            if (!discoverable || until is null) return ExpiryAction.None;
            if (until <= now) return ExpiryAction.Close;
            if (remindedAt is null && until - now <= RemindBefore) return ExpiryAction.Remind;
            return ExpiryAction.None;
        }
    }
}
