using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    public sealed class ListingReportService : IListingReportService
    {
        private readonly IRepository<ListingReport> _reports;
        private readonly IRepository<Listing> _listings;
        private readonly IRepository<ListingModerationEvent> _events;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;
        private readonly INotificationSender _notifier;
        private readonly ILogger<ListingReportService> _logger;

        public ListingReportService(
            IRepository<ListingReport> reports,
            IRepository<Listing> listings,
            IRepository<ListingModerationEvent> events,
            IUnitOfWork uow,
            ICurrentUserService currentUser,
            INotificationSender notifier,
            ILogger<ListingReportService> logger)
        {
            _reports = reports; _listings = listings; _events = events; _uow = uow; _currentUser = currentUser;
            _notifier = notifier; _logger = logger;
        }

        public async Task ReportAsync(string slug, CreateListingReportRequest request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            var listing = await _listings.Query().AsNoTracking()
                .Where(l => l.Slug == slug)
                .Select(l => new { l.Id, OwnerId = l.Asset.UserId })
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            // Chủ tin muốn gỡ tin của mình thì đã có nút đóng tin. Cho phép họ tự báo chỉ
            // tạo thêm việc cho người kiểm duyệt mà không giải quyết gì.
            if (listing.OwnerId == userId)
                throw new InvalidOperationException(
                    "Đây là tin của bạn. Dùng nút đóng tin nếu muốn gỡ tin xuống.");

            var already = await _reports.Query().AnyAsync(
                r => r.ListingId == listing.Id
                  && r.ReporterUserId == userId
                  && r.Status == ListingReportStatus.Pending, ct);

            // Im lặng coi như thành công thay vì báo lỗi: người dùng bấm báo lần nữa vì họ
            // không chắc lần đầu đã ăn chưa, và câu trả lời đúng với họ là "đã ghi nhận".
            if (already) return;

            await _reports.AddAsync(new ListingReport
            {
                ListingId = listing.Id,
                ReporterUserId = userId,
                Reason = request.Reason,
                Detail = string.IsNullOrWhiteSpace(request.Detail) ? null : request.Detail.Trim(),
                Status = ListingReportStatus.Pending
            }, ct);

            await _uow.SaveChangesAsync(ct);
        }

        public async Task<IReadOnlyList<ListingReportDto>> GetForModerationAsync(
            ListingReportStatus? status, CancellationToken ct = default)
        {
            var q = _reports.Query().AsNoTracking();
            if (status is not null) q = q.Where(r => r.Status == status);

            var rows = await q
                // Cũ nhất trước: hàng đợi kiểm duyệt là hàng đợi thật, không phải bảng tin.
                .OrderBy(r => r.CreatedAt)
                .Select(r => new
                {
                    r.Id,
                    r.ListingId,
                    ListingTitle = r.Listing.Title,
                    ListingSlug = r.Listing.Slug,
                    ListingStatus = r.Listing.Status,
                    r.Reason,
                    r.Detail,
                    r.Status,
                    ReporterName = r.Reporter.Name,
                    r.CreatedAt,
                    r.HandledAt,
                    r.HandlerNote
                })
                .ToListAsync(ct);

            if (rows.Count == 0) return Array.Empty<ListingReportDto>();

            // Đếm số báo cáo đang chờ trên mỗi tin bằng một truy vấn gom riêng, thay vì một
            // truy vấn con lồng trong projection. Truy vấn con ở đó đi qua lớp bọc
            // IRepository nên chỉ nổ lúc chạy nếu EF không dịch được — một màn hình quản trị
            // không đáng để đánh cược vào chuyện đó.
            var listingIds = rows.Select(r => r.ListingId).Distinct().ToList();
            var pendingCounts = await _reports.Query().AsNoTracking()
                .Where(r => listingIds.Contains(r.ListingId) && r.Status == ListingReportStatus.Pending)
                .GroupBy(r => r.ListingId)
                .Select(g => new { ListingId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ListingId, x => x.Count, ct);

            return rows.Select(r => new ListingReportDto(
                r.Id, r.ListingId, r.ListingTitle, r.ListingSlug, r.ListingStatus,
                r.Reason, r.Detail, r.Status, r.ReporterName,
                r.CreatedAt, r.HandledAt, r.HandlerNote,
                pendingCounts.GetValueOrDefault(r.ListingId))).ToList();
        }

        public async Task<ResolveListingReportResultDto> ResolveAsync(
            Guid reportId, ResolveListingReportRequest request, CancellationToken ct = default)
        {
            var report = await _reports.Query().FirstOrDefaultAsync(r => r.Id == reportId, ct)
                ?? throw new NotFoundException("Không tìm thấy báo cáo.");

            if (report.Status != ListingReportStatus.Pending)
                throw new InvalidOperationException("Báo cáo này đã được xử lý.");

            var newStatus = request.Confirmed
                ? ListingReportStatus.Resolved
                : ListingReportStatus.Dismissed;

            // Đóng mọi báo cáo đang chờ trên cùng tin, không riêng cái được bấm. Người kiểm
            // duyệt vừa xem xong chính tin đó; bắt họ bấm lại từng cái cho năm người cùng
            // báo một tin là bắt họ làm lại đúng một việc đã làm.
            var siblings = await _reports.Query()
                .Where(r => r.ListingId == report.ListingId && r.Status == ListingReportStatus.Pending)
                .ToListAsync(ct);

            var now = DateTime.UtcNow;
            var handler = _currentUser.UserId;
            var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();

            foreach (var r in siblings)
            {
                r.Status = newStatus;
                r.HandledAt = now;
                r.HandledByUserId = handler;
                r.HandlerNote = note;
            }

            // Xác nhận vi phạm thì xử lý luôn TIN ĐĂNG — xem ReportOutcomes. Chỉ đụng tới tin
            // đang hiển thị: tin đã đóng, đã gỡ hay đang chờ duyệt thì vốn không còn trước mắt
            // người tìm nhà, đổi trạng thái của nó chỉ làm rối lịch sử của chủ tin.
            var listing = await _listings.Query().Include(l => l.Asset)
                .FirstAsync(l => l.Id == report.ListingId, ct);
            ReportAction? applied = null;
            if (request.Confirmed && listing.Status == ListingStatus.Approved)
            {
                applied = request.Action ?? ReportOutcomes.DefaultAction(report.Reason);
                var (status, action, reason) = ReportOutcomes.Apply(applied.Value, report.Reason);
                var why = ReportOutcomes.Describe(report.Reason);

                listing.Status = status;
                listing.ModerationNote = $"Theo phản ánh của người dùng: {why}." + (note is null ? "" : $" {note}");

                var round = await _events.Query().CountAsync(e => e.ListingId == listing.Id, ct);
                await _events.AddAsync(new ListingModerationEvent
                {
                    ListingId = listing.Id,
                    Action = action,
                    Reasons = new List<ModerationReason> { reason },
                    Note = listing.ModerationNote,
                    ModeratorUserId = handler,
                    Round = round + 1,
                }, ct);
            }

            await _uow.SaveChangesAsync(ct);

            if (applied is not null) await NotifyOwnerAsync(listing, applied.Value, report.Reason, note, ct);
            return new ResolveListingReportResultDto(siblings.Count, applied, listing.Status);
        }

        /// <summary>Báo chủ tin chuyện gì đã xảy ra với tin và họ làm được gì tiếp. Lỗi gửi không
        /// được làm hỏng quyết định đã lưu — cùng nguyên tắc với thông báo kiểm duyệt.</summary>
        private async Task NotifyOwnerAsync(
            Listing listing, ReportAction action, ListingReportReason reason, string? note, CancellationToken ct)
        {
            var why = ReportOutcomes.Describe(reason);
            var extra = note is null ? "" : $" Ghi chú của người kiểm duyệt: {note}.";
            var (title, body, label) = action switch
            {
                ReportAction.TakeDown => (
                    $"Tin đăng đã bị gỡ: {listing.Title}",
                    $"Tin bị gỡ khỏi trang tìm kiếm sau khi xác nhận phản ánh của người dùng: {why}.{extra} Nếu bạn cho rằng đây là nhầm lẫn, hãy sửa tin và gửi duyệt lại.",
                    "Xem tin"),
                ReportAction.MarkTaken => (
                    $"Tin đăng đã được đóng: {listing.Title}",
                    $"Người xem phản ánh {why}, nên tin đã được đóng để người tìm nhà không gọi nhầm.{extra} Khi còn trống, bạn mở lại tin bất cứ lúc nào.",
                    "Mở lại tin"),
                _ => (
                    $"Tin đăng cần chỉnh sửa: {listing.Title}",
                    $"Người xem phản ánh {why}. Tin tạm ẩn cho tới khi bạn sửa và gửi duyệt lại.{extra}",
                    "Mở tin để sửa"),
            };
            try
            {
                await _notifier.SendAsync(listing.Asset.UserId, title, body, "/tin-cua-toi", label, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không gửi được thông báo xử lý vi phạm cho tin {ListingId}", listing.Id);
            }
        }
    }
}
