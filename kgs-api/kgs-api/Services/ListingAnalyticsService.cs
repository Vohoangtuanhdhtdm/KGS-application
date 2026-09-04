using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    public sealed class ListingAnalyticsService : IListingAnalyticsService
    {
        /// <summary>Cửa sổ của biểu đồ. 30 ngày đủ thấy xu hướng mà vẫn đọc được trên
        /// màn hình điện thoại.</summary>
        private const int WindowDays = 30;

        /// <summary>Dưới ngưỡng này thì "mặt bằng giá khu vực" chỉ là vài con số lẻ, và một
        /// so sánh dựa trên ba tin đăng còn nguy hiểm hơn là không so sánh gì.</summary>
        private const int MinAreaListingsForComparison = 5;

        private readonly IRepository<Listing> _listings;
        private readonly IRepository<ListingView> _views;
        private readonly IRepository<SavedListing> _saved;
        private readonly IRepository<ListingInquiry> _inquiries;
        private readonly ICurrentUserService _currentUser;

        public ListingAnalyticsService(
            IRepository<Listing> listings,
            IRepository<ListingView> views,
            IRepository<SavedListing> saved,
            IRepository<ListingInquiry> inquiries,
            ICurrentUserService currentUser)
        {
            _listings = listings; _views = views; _saved = saved;
            _inquiries = inquiries; _currentUser = currentUser;
        }

        public async Task<OwnerAnalyticsSummaryDto> GetOwnerSummaryAsync(CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;
            var from = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-(WindowDays - 1));

            var mine = _listings.Query().AsNoTracking().Where(l => l.Asset.UserId == userId);

            var listings = await mine
                .Select(l => new { l.Id, l.Title, l.Slug, l.Status, l.Terms, l.Amenities })
                .ToListAsync(ct);

            if (listings.Count == 0)
                return new OwnerAnalyticsSummaryDto(
                    0, 0, 0, 0, 0, ZeroFill(new Dictionary<DateOnly, int>(), from), []);

            var ids = listings.Select(l => l.Id).ToList();

            // Bốn truy vấn gom, không phải bốn truy vấn MỖI TIN. Người đăng nhiều tin là
            // người dùng ta muốn giữ nhất — màn hình của họ không được phép chậm dần theo
            // số tin họ đăng.
            var viewsByListing = await _views.Query().AsNoTracking()
                .Where(v => ids.Contains(v.ListingId) && v.ViewedOn >= from)
                .GroupBy(v => v.ListingId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

            var viewsByDay = await _views.Query().AsNoTracking()
                .Where(v => ids.Contains(v.ListingId) && v.ViewedOn >= from)
                .GroupBy(v => v.ViewedOn)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

            var savedByListing = await _saved.Query().AsNoTracking()
                .Where(s => ids.Contains(s.ListingId))
                .GroupBy(s => s.ListingId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

            var inquiriesByListing = await _inquiries.Query().AsNoTracking()
                .Where(i => ids.Contains(i.ListingId))
                .GroupBy(i => i.ListingId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

            var rows = listings
                .Select(l => new ListingPerformanceRow(
                    l.Id, l.Title, l.Slug,
                    viewsByListing.GetValueOrDefault(l.Id),
                    savedByListing.GetValueOrDefault(l.Id),
                    inquiriesByListing.GetValueOrDefault(l.Id),
                    Completeness(l.Terms, l.Amenities)))
                .OrderByDescending(r => r.Views30Days)
                .ThenBy(r => r.Title)
                .ToList();

            return new OwnerAnalyticsSummaryDto(
                TotalListings: listings.Count,
                ApprovedListings: listings.Count(l => l.Status == ListingStatus.Approved),
                TotalViews30Days: viewsByListing.Values.Sum(),
                TotalInquiries: inquiriesByListing.Values.Sum(),
                TotalSaved: savedByListing.Values.Sum(),
                DailyViews: ZeroFill(viewsByDay, from),
                Listings: rows);
        }

        public async Task<ListingAnalyticsDto> GetForListingAsync(Guid listingId, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var from30 = today.AddDays(-(WindowDays - 1));
            var from7 = today.AddDays(-6);

            var l = await _listings.Query().AsNoTracking()
                .Where(x => x.Id == listingId)
                .Select(x => new
                {
                    x.Id,
                    x.Title,
                    x.Slug,
                    x.Price,
                    x.Type,
                    x.Terms,
                    x.Amenities,
                    OwnerId = x.Asset.UserId,
                    x.Asset.Address.City,
                    x.Asset.Address.District,
                    ImageCount = x.Images.Count
                })
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            // 404 chứ không phải 403 — xem ghi chú tương tự ở SavedSearchService.
            if (l.OwnerId != userId)
                throw new NotFoundException("Không tìm thấy tin đăng.");

            var allViews = _views.Query().AsNoTracking().Where(v => v.ListingId == listingId);

            var totalViews = await allViews.CountAsync(ct);
            var views7 = await allViews.CountAsync(v => v.ViewedOn >= from7, ct);

            var byDay = await allViews
                .Where(v => v.ViewedOn >= from30)
                .GroupBy(v => v.ViewedOn)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

            var views30 = byDay.Values.Sum();

            var savedCount = await _saved.Query().AsNoTracking()
                .CountAsync(s => s.ListingId == listingId, ct);
            var inquiryCount = await _inquiries.Query().AsNoTracking()
                .CountAsync(i => i.ListingId == listingId, ct);

            var (areaMedian, areaCount) = await AreaPriceAsync(l.Type, l.City, l.District, l.Id, ct);

            double? priceDiff = areaMedian is > 0
                ? (double)((l.Price - areaMedian.Value) / areaMedian.Value) * 100
                : null;

            var completeness = Completeness(l.Terms, l.Amenities);

            return new ListingAnalyticsDto(
                ListingId: l.Id,
                Title: l.Title,
                Slug: l.Slug,
                TotalViews: totalViews,
                Views7Days: views7,
                Views30Days: views30,
                DailyViews: ZeroFill(byDay, from30),
                SavedCount: savedCount,
                InquiryCount: inquiryCount,
                InquiryRatePercent: totalViews > 0
                    ? Math.Round(inquiryCount * 100.0 / totalViews, 1)
                    : 0,
                AreaMedianPrice: areaMedian,
                AreaListingCount: areaCount,
                PriceDiffPercent: priceDiff is null ? null : Math.Round(priceDiff.Value, 1),
                CompletenessPercent: completeness,
                ImageCount: l.ImageCount,
                Suggestions: BuildSuggestions(l.ImageCount, completeness, l.Terms, priceDiff, totalViews, inquiryCount));
        }

        // ==================== Nội bộ ====================

        /// <summary>Giá trung vị và số tin cạnh tranh cùng loại, cùng quận.
        ///
        /// Trung vị chứ không phải trung bình: một biệt thự lọt vào danh sách phòng trọ đủ
        /// kéo trung bình lên tới mức vô nghĩa, còn trung vị thì không nhúc nhích.
        ///
        /// Lấy phần tử giữa bằng Skip/Take thay vì tải hết giá về rồi sắp xếp trong bộ nhớ —
        /// một quận đông tin sẽ có hàng nghìn dòng, và ta chỉ cần đúng một con số.</summary>
        private async Task<(decimal? Median, int Count)> AreaPriceAsync(
            ListingType type, string city, string district, Guid excludeId, CancellationToken ct)
        {
            var peers = _listings.Query().AsNoTracking()
                .Where(x => x.Status == ListingStatus.Approved
                         && x.Id != excludeId
                         && x.Type == type
                         && x.Asset.Address.City == city
                         && x.Asset.Address.District == district);

            var count = await peers.CountAsync(ct);
            if (count < MinAreaListingsForComparison) return (null, count);

            // Số lượng chẵn thì lấy phần tử giữa dưới thay vì trung bình hai phần tử giữa.
            // Chênh lệch không đáng kể ở đây, và đổi lại là một truy vấn thay vì hai.
            var median = await peers
                .OrderBy(x => x.Price).ThenBy(x => x.Id)
                .Skip((count - 1) / 2).Take(1)
                .Select(x => x.Price)
                .FirstAsync(ct);

            return (median, count);
        }

        /// <summary>Điền đủ mọi ngày trong cửa sổ, kể cả ngày không có lượt xem nào.
        ///
        /// Bỏ ngày rỗng đi thì đường biểu đồ tự nối liền qua khoảng trống, và một tin chết
        /// hẳn nửa tháng trông y như một tin đều đặn có người xem.</summary>
        private static List<DailyViewPoint> ZeroFill(Dictionary<DateOnly, int> byDay, DateOnly from)
            => Enumerable.Range(0, WindowDays)
                .Select(i => from.AddDays(i))
                .Select(d => new DailyViewPoint(d, byDay.GetValueOrDefault(d)))
                .ToList();

        /// <summary>Cùng công thức độ đầy đủ mà danh sách "tin của tôi" đang hiện.
        /// Hai con số khác nhau cho cùng một tin trên hai màn hình thì cả hai đều mất tin cậy.</summary>
        private static int Completeness(ListingTerms t, List<string> amenities)
            => (t.DepositMonths != null ? 15 : 0)
             + (t.ElectricityPrice != null ? 15 : 0)
             + (t.WaterPrice != null ? 15 : 0)
             + (t.AvailableFrom != null ? 10 : 0)
             + (t.MinLeaseMonths != null ? 10 : 0)
             + (t.MaxOccupants != null ? 10 : 0)
             + (t.PetsAllowed != null ? 5 : 0)
             + (t.CurfewFree != null ? 5 : 0)
             + (t.SharedWithOwner != null ? 5 : 0)
             + (amenities.Count > 0 ? 10 : 0);

        /// <summary>Gợi ý cụ thể, xếp theo thứ tự việc nào đáng làm trước.
        ///
        /// Cố ý không liệt kê mọi thứ còn thiếu: một danh sách mười gạch đầu dòng thì không
        /// ai làm cái nào. Mỗi lần chỉ nêu vài việc lớn nhất.</summary>
        private static List<string> BuildSuggestions(
            int imageCount, int completeness, ListingTerms terms,
            double? priceDiff, int views, int inquiries)
        {
            var s = new List<string>();

            // Ảnh trước hết. Đây là thứ quyết định người ta có bấm vào tin từ danh sách hay
            // không — mọi thứ khác chỉ có tác dụng SAU khi họ đã bấm vào.
            if (imageCount == 0)
                s.Add("Tin chưa có ảnh nào. Ảnh là thứ quyết định người tìm nhà có bấm vào tin hay không.");
            else if (imageCount < 4)
                s.Add($"Mới có {imageCount} ảnh. Thêm ảnh phòng tắm, bếp và lối vào — đây là ba thứ người thuê hay hỏi nhất.");

            if (terms.ElectricityPrice == null || terms.WaterPrice == null)
                s.Add("Chưa khai giá điện nước. Người thuê so sánh tổng chi phí, không so giá thuê trần trụi.");

            if (terms.AvailableFrom == null)
                s.Add("Chưa khai ngày dọn vào được. Người đang cần chỗ gấp sẽ bỏ qua tin không rõ thời điểm.");

            if (completeness < 60)
                s.Add("Tin còn thiếu nhiều dữ kiện nên ít khớp với bộ lọc — mỗi mục khai thêm là thêm một cách để người tìm thấy tin.");

            if (priceDiff is > 20)
                s.Add($"Giá đang cao hơn mặt bằng cùng khu vực khoảng {Math.Round(priceDiff.Value)}%.");

            // Chỉ nói khi đã đủ lượt xem để câu này có nghĩa. Nói với một tin mới có 5 lượt
            // xem rằng "không ai liên hệ" thì vừa sai vừa làm nản.
            if (views >= 50 && inquiries == 0)
                s.Add("Tin có lượt xem nhưng chưa ai liên hệ — thường là do thiếu ảnh, thiếu điều kiện thuê, hoặc giá lệch mặt bằng.");

            return s.Take(4).ToList();
        }
    }
}
