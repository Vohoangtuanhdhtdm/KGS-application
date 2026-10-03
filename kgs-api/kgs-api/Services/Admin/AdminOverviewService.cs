using kgs_api.Data;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services.Admin
{
    public sealed record CountDto(string Key, int Count);
    public sealed record DailyPointDto(DateOnly Date, int NewListings, int NewUsers, int Inquiries);

    public sealed record AdminKpisDto(
        int UsersTotal, int UsersNew, int ListingsLive, int ListingsNew, int PendingQueue,
        int PendingReports, int LockedUsers, int InquiriesNew, int InvitationsNew,
        /// <summary>Tin chờ duyệt lâu nhất đã đợi bao nhiêu giờ — null khi hàng đợi trống.</summary>
        double? OldestPendingHours);

    public sealed record ModerationStatsDto(
        int Decisions, int Approved, int ChangesRequested, int Rejected, int TakenDown,
        /// <summary>% tin được duyệt ngay ở lần quyết định đầu tiên.</summary>
        double? FirstRoundApprovalPercent,
        double? MedianHoursToDecision, double? P90HoursToDecision,
        /// <summary>Lý do trả về / từ chối / gỡ, mã ModerationReason dạng chuỗi số.</summary>
        IReadOnlyList<CountDto> TopReasons);

    public sealed record ReportStatsDto(
        int Received, int Pending, int Resolved, int Dismissed, double? MedianHoursToHandle,
        /// <summary>Theo lý do báo, mã ListingReportReason dạng chuỗi số.</summary>
        IReadOnlyList<CountDto> ByReason);

    public sealed record AdminOverviewDto(
        int Days, AdminKpisDto Kpis, IReadOnlyList<DailyPointDto> Daily, ModerationStatsDto Moderation,
        ReportStatsDto Reports,
        /// <summary>Tin đang hiển thị theo loại hình (mã AssetDomainType) và theo tỉnh/thành.</summary>
        IReadOnlyList<CountDto> LiveByType, IReadOnlyList<CountDto> LiveByCity);

    /// <summary>Số liệu cho trang tổng quan quản trị — trả lời "hệ thống đang khoẻ không": hàng
    /// đợi có dồn không, duyệt nhanh hay chậm, người đăng hay sai ở đâu, báo vi phạm có được
    /// xử lý kịp không. Tính trên CSDL hiện tại, theo giờ Việt Nam.</summary>
    public sealed class AdminOverviewService
    {
        private static readonly TimeSpan Vn = TimeSpan.FromHours(7);
        private readonly ApplicationDbContext _db;
        public AdminOverviewService(ApplicationDbContext db) => _db = db;

        public async Task<AdminOverviewDto> GetAsync(int days, CancellationToken ct)
        {
            days = Math.Clamp(days, 7, 180);
            var nowUtc = DateTime.UtcNow;
            var nowOff = DateTimeOffset.UtcNow;
            var since = nowUtc.AddDays(-days);

            // ---- Chuỗi ngày (theo ngày giờ Việt Nam) ----
            var listingDates = await _db.Listings.AsNoTracking().Where(l => l.CreatedAt >= since).Select(l => l.CreatedAt).ToListAsync(ct);
            var userDates = await _db.Users.AsNoTracking().Where(u => u.CreatedAt >= since).Select(u => u.CreatedAt).ToListAsync(ct);
            var inquiryDates = await _db.ListingInquiries.AsNoTracking().Where(i => i.CreatedAt >= since).Select(i => i.CreatedAt).ToListAsync(ct);
            DateOnly Day(DateTime utc) => DateOnly.FromDateTime(utc + Vn);
            var today = Day(nowUtc);
            var byDay = (List<DateTime> xs) => xs.GroupBy(Day).ToDictionary(g => g.Key, g => g.Count());
            var (dl, du, di) = (byDay(listingDates), byDay(userDates), byDay(inquiryDates));
            var daily = Enumerable.Range(0, days).Select(i => today.AddDays(i - days + 1))
                .Select(d => new DailyPointDto(d, dl.GetValueOrDefault(d), du.GetValueOrDefault(d), di.GetValueOrDefault(d)))
                .ToList();

            // ---- Chỉ số chính ----
            var pendingCreated = await _db.Listings.AsNoTracking().Where(l => l.Status == ListingStatus.Pending)
                .Select(l => l.CreatedAt).ToListAsync(ct);
            var kpis = new AdminKpisDto(
                await _db.Users.CountAsync(ct),
                userDates.Count,
                await _db.Listings.CountAsync(l => l.Status == ListingStatus.Approved, ct),
                listingDates.Count,
                pendingCreated.Count,
                await _db.ListingReports.CountAsync(r => r.Status == ListingReportStatus.Pending, ct),
                await _db.Users.CountAsync(u => u.AdminLockedAt != null && u.LockoutEnd > nowOff, ct),
                inquiryDates.Count,
                await _db.ListingInvitations.CountAsync(i => i.CreatedAt >= since, ct),
                pendingCreated.Count == 0 ? null : Math.Round((nowUtc - pendingCreated.Min()).TotalHours, 1));

            // ---- Kiểm duyệt ----
            var events = await _db.ListingModerationEvents.AsNoTracking()
                .Where(e => e.CreatedAt >= since.AddDays(-days))   // lùi thêm một kỳ để bắt cặp gửi→quyết định vắt qua mốc
                .Select(e => new { e.ListingId, e.Action, e.CreatedAt, e.Reasons })
                .ToListAsync(ct);
            static bool IsDecision(ModerationAction a) => a is ModerationAction.Approved or ModerationAction.ChangesRequested
                or ModerationAction.Rejected or ModerationAction.TakenDown or ModerationAction.ClosedByReport;
            var decisions = events.Where(e => e.CreatedAt >= since && IsDecision(e.Action)).ToList();

            var waits = new List<double>();
            var firstRound = new List<bool>();
            foreach (var g in events.GroupBy(e => e.ListingId))
            {
                var seq = g.OrderBy(e => e.CreatedAt).ToList();
                for (var i = 0; i < seq.Count; i++)
                {
                    if (seq[i].Action != ModerationAction.Submitted) continue;
                    var next = seq.Skip(i + 1).FirstOrDefault(e => e.Action is ModerationAction.Approved
                        or ModerationAction.ChangesRequested or ModerationAction.Rejected);
                    if (next is not null && next.CreatedAt >= since) waits.Add((next.CreatedAt - seq[i].CreatedAt).TotalHours);
                }
                var first = seq.FirstOrDefault(e => e.Action is ModerationAction.Approved
                    or ModerationAction.ChangesRequested or ModerationAction.Rejected);
                if (first is not null && first.CreatedAt >= since) firstRound.Add(first.Action == ModerationAction.Approved);
            }

            var moderation = new ModerationStatsDto(
                decisions.Count,
                decisions.Count(e => e.Action == ModerationAction.Approved),
                decisions.Count(e => e.Action == ModerationAction.ChangesRequested),
                decisions.Count(e => e.Action == ModerationAction.Rejected),
                decisions.Count(e => e.Action is ModerationAction.TakenDown or ModerationAction.ClosedByReport),
                firstRound.Count == 0 ? null : Math.Round(100.0 * firstRound.Count(x => x) / firstRound.Count, 1),
                Percentile(waits, 0.5), Percentile(waits, 0.9),
                decisions.Where(e => e.Action != ModerationAction.Approved)
                    .SelectMany(e => e.Reasons).GroupBy(r => r)
                    .Select(g => new CountDto(((int)g.Key).ToString(), g.Count()))
                    .OrderByDescending(c => c.Count).Take(8).ToList());

            // ---- Báo vi phạm ----
            var reports = await _db.ListingReports.AsNoTracking().Where(r => r.CreatedAt >= since)
                .Select(r => new { r.Reason, r.Status, r.CreatedAt, r.HandledAt }).ToListAsync(ct);
            var reportStats = new ReportStatsDto(
                reports.Count,
                reports.Count(r => r.Status == ListingReportStatus.Pending),
                reports.Count(r => r.Status == ListingReportStatus.Resolved),
                reports.Count(r => r.Status == ListingReportStatus.Dismissed),
                Percentile(reports.Where(r => r.HandledAt != null).Select(r => (r.HandledAt!.Value - r.CreatedAt).TotalHours).ToList(), 0.5),
                reports.GroupBy(r => r.Reason).Select(g => new CountDto(((int)g.Key).ToString(), g.Count()))
                    .OrderByDescending(c => c.Count).ToList());

            // ---- Thị trường đang hiển thị ----
            var live = _db.Listings.AsNoTracking().Where(l => l.Status == ListingStatus.Approved);
            var byType = (await live.GroupBy(l => l.Asset.TypeProperty).Select(g => new { g.Key, C = g.Count() }).ToListAsync(ct))
                .Select(x => new CountDto(((int)x.Key).ToString(), x.C)).OrderByDescending(c => c.Count).ToList();
            var byCity = (await live.GroupBy(l => l.Asset.Address.City).Select(g => new { g.Key, C = g.Count() }).ToListAsync(ct))
                .Select(x => new CountDto(x.Key, x.C)).OrderByDescending(c => c.Count).ToList();

            return new AdminOverviewDto(days, kpis, daily, moderation, reportStats, byType, byCity);
        }

        /// <summary>Phân vị theo cách "gần nhất" — đủ cho số liệu hiển thị; null khi rỗng.</summary>
        public static double? Percentile(IReadOnlyList<double> xs, double p)
        {
            if (xs.Count == 0) return null;
            var s = xs.Order().ToList();
            var i = (int)Math.Clamp(Math.Ceiling(p * s.Count) - 1, 0, s.Count - 1);
            return Math.Round(s[i], 1);
        }
    }
}
