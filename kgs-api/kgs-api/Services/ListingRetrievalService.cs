using kgs_api.Domain.Entity;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    /// <summary>Tầng truy hồi tin đăng — nền của AI Agent tìm kiếm.
    ///
    /// Nguyên tắc lấy từ kiến trúc agentic NLQ đã khảo sát: TÁCH điều kiện cứng khỏi mong
    /// muốn mềm. Giá và nội quy đi vào WHERE của SQL, không bao giờ để cho độ tương đồng
    /// ngữ nghĩa quyết định — khách nói dưới 8 triệu thì căn 9 triệu là sai, dù mô tả có
    /// hay đến đâu. Chỉ phần "yên tĩnh, hợp làm việc tại nhà" mới đi qua xếp hạng.
    ///
    /// Nhánh Vector hiện chưa cắm model nên tự lùi về Keyword. Cố ý làm vậy thay vì ném
    /// lỗi: nếu dịch vụ embedding chết đúng hôm demo thì tìm kiếm vẫn chạy, chỉ kém tinh
    /// hơn — thà kém còn hơn trắng màn hình.</summary>
    public sealed class ListingRetrievalService : IListingRetrievalService
    {
        /// <summary>Hằng số k của Reciprocal Rank Fusion. 60 là giá trị chuẩn trong tài liệu
        /// gốc, làm mềm ảnh hưởng của những hạng đầu để một nhánh không áp đảo nhánh kia.</summary>
        private const double RrfK = 60.0;

        private readonly IRepository<Listing> _listings;

        public ListingRetrievalService(IRepository<Listing> listings) => _listings = listings;

        public async Task<IReadOnlyList<RetrievalHit>> SearchAsync(
            RetrievalQuery query, RetrievalMode mode, CancellationToken ct = default)
        {
            var limit = Math.Clamp(query.Limit, 1, 100);

            // Nhánh Vector và Hybrid cần embedding. Chưa có thì lùi về Keyword thay vì hỏng.
            if (mode is RetrievalMode.Vector or RetrievalMode.Hybrid)
                mode = RetrievalMode.Keyword;

            var filtered = ApplyHardFilters(_listings.Query().AsNoTracking(), query);

            return mode switch
            {
                RetrievalMode.FilterOnly => await FilterOnlyAsync(filtered, limit, ct),
                RetrievalMode.Keyword => await KeywordAsync(filtered, query.FreeText, limit, ct),
                _ => await FilterOnlyAsync(filtered, limit, ct)
            };
        }

        // ==================== Điều kiện CỨNG ====================

        private static IQueryable<Listing> ApplyHardFilters(IQueryable<Listing> q, RetrievalQuery f)
        {
            q = q.Where(l => l.Status == ListingStatus.Approved);

            if (f.Type is not null) q = q.Where(l => l.Type == f.Type);
            if (!string.IsNullOrWhiteSpace(f.City)) q = q.Where(l => l.Asset.Address.City == f.City);
            if (!string.IsNullOrWhiteSpace(f.District)) q = q.Where(l => l.Asset.Address.District == f.District);
            if (f.BedroomsMin is not null) q = q.Where(l => l.Asset.Bedrooms >= f.BedroomsMin);

            // Trần TỔNG chi phí cố định, không phải giá thuê trần trụi: phòng 7tr kèm 500k
            // phí dịch vụ đắt hơn phòng 7,2tr đã bao trọn gói.
            if (f.TotalCostMax is not null)
                q = q.Where(l => l.Price
                               + (l.Terms.ServiceFee ?? 0)
                               + (l.Terms.ParkingFee ?? 0)
                               + (l.Terms.InternetFee ?? 0) <= f.TotalCostMax);

            // Chỉ khớp khi chủ tin đã KHAI tường minh. Tin bỏ trống không được coi là "có" —
            // đây là lý do các cột này nullable thay vì bool thường.
            if (f.PetsAllowed is not null) q = q.Where(l => l.Terms.PetsAllowed == f.PetsAllowed);
            if (f.CurfewFree is not null) q = q.Where(l => l.Terms.CurfewFree == f.CurfewFree);
            if (f.SharedWithOwner is not null) q = q.Where(l => l.Terms.SharedWithOwner == f.SharedWithOwner);

            if (f.AvailableBy is not null)
            {
                var by = DateTime.SpecifyKind(f.AvailableBy.Value, DateTimeKind.Utc);
                q = q.Where(l => l.Terms.AvailableFrom == null || l.Terms.AvailableFrom <= by);
            }

            if (f.Amenities is { Count: > 0 })
            {
                var wanted = f.Amenities.ToList();
                q = q.Where(l => wanted.All(a => l.Amenities.Contains(a)));
            }

            return q;
        }

        // ==================== Nhánh 1 — chỉ lọc ====================

        /// <summary>Baseline. Không xếp hạng theo nội dung, chỉ lấy tin mới nhất — đúng
        /// những gì bộ lọc dropdown hiện nay làm được.</summary>
        private static async Task<IReadOnlyList<RetrievalHit>> FilterOnlyAsync(
            IQueryable<Listing> q, int limit, CancellationToken ct)
        {
            var rows = await q
                .OrderByDescending(l => l.PublishedAt ?? l.CreatedAt)
                .Take(limit)
                .Select(l => new
                {
                    l.Id,
                    l.Slug,
                    l.Title,
                    Total = l.Price + (l.Terms.ServiceFee ?? 0) + (l.Terms.ParkingFee ?? 0) + (l.Terms.InternetFee ?? 0)
                })
                .ToListAsync(ct);

            return rows
                .Select((r, i) => new RetrievalHit(r.Id, r.Slug ?? "", r.Title, r.Total, 1.0 / (i + 1), null, null))
                .ToList();
        }

        // ==================== Nhánh 2 — từ khoá ====================

        /// <summary>Xếp hạng bằng ts_rank trên cột SearchVector do PostgreSQL tự sinh.
        /// Câu truy vấn cũng được bỏ dấu qua f_unaccent nên "phong tro quan 7" khớp với
        /// "phòng trọ quận 7".</summary>
        private async Task<IReadOnlyList<RetrievalHit>> KeywordAsync(
            IQueryable<Listing> q, string? freeText, int limit, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(freeText))
                return await FilterOnlyAsync(q, limit, ct);

            // plainto_tsquery: mọi từ đều phải xuất hiện (phép AND) — quá chặt cho câu dài.
            // websearch_to_tsquery mềm hơn và chấp nhận cú pháp người dùng quen thuộc.
            var tsQuery = EF.Functions.WebSearchToTsQuery("simple", Unaccent(freeText));

            var rows = await q
                .Where(l => l.SearchVector!.Matches(tsQuery))
                .Select(l => new
                {
                    l.Id,
                    l.Slug,
                    l.Title,
                    Total = l.Price + (l.Terms.ServiceFee ?? 0) + (l.Terms.ParkingFee ?? 0) + (l.Terms.InternetFee ?? 0),
                    Rank = l.SearchVector!.Rank(tsQuery)
                })
                .OrderByDescending(x => x.Rank)
                .Take(limit)
                .ToListAsync(ct);

            return rows
                .Select((r, i) => new RetrievalHit(r.Id, r.Slug ?? "", r.Title, r.Total, r.Rank, i + 1, null))
                .ToList();
        }

        // ==================== Hợp nhất RRF ====================

        /// <summary>Reciprocal Rank Fusion: mỗi tin được cộng 1/(k + hạng) từ từng nhánh.
        ///
        /// Chọn RRF thay vì cộng điểm có trọng số vì điểm của ts_rank và điểm cosine nằm
        /// trên hai thang hoàn toàn khác nhau, không chuẩn hoá về chung được một cách
        /// đáng tin. RRF chỉ dùng THỨ HẠNG nên miễn nhiễm với chuyện đó.
        ///
        /// Sẽ được gọi khi nhánh Vector có model. Để sẵn ở đây kèm test được.</summary>
        public static List<RetrievalHit> FuseRrf(
            IReadOnlyList<RetrievalHit> keyword, IReadOnlyList<RetrievalHit> vector, int limit)
        {
            var scores = new Dictionary<Guid, (RetrievalHit Hit, double Score, int? KRank, int? VRank)>();

            for (var i = 0; i < keyword.Count; i++)
            {
                var h = keyword[i];
                scores[h.ListingId] = (h, 1.0 / (RrfK + i + 1), i + 1, null);
            }

            for (var i = 0; i < vector.Count; i++)
            {
                var h = vector[i];
                var add = 1.0 / (RrfK + i + 1);
                if (scores.TryGetValue(h.ListingId, out var cur))
                    scores[h.ListingId] = (cur.Hit, cur.Score + add, cur.KRank, i + 1);
                else
                    scores[h.ListingId] = (h, add, null, i + 1);
            }

            return scores.Values
                .OrderByDescending(x => x.Score)
                .Take(limit)
                .Select(x => x.Hit with { Score = x.Score, KeywordRank = x.KRank, VectorRank = x.VRank })
                .ToList();
        }

        /// <summary>Bỏ dấu phía C# cho câu truy vấn. Cột SearchVector đã bỏ dấu bằng
        /// f_unaccent phía CSDL, nên hai bên phải khớp nhau thì mới match được.</summary>
        public static string Unaccent(string input)
        {
            var normalized = input.Normalize(System.Text.NormalizationForm.FormD);
            var sb = new System.Text.StringBuilder(normalized.Length);

            foreach (var c in normalized)
            {
                if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)
                    != System.Globalization.UnicodeCategory.NonSpacingMark)
                    sb.Append(c);
            }

            return sb.ToString()
                .Normalize(System.Text.NormalizationForm.FormC)
                .Replace('đ', 'd').Replace('Đ', 'D');
        }
    }
}
