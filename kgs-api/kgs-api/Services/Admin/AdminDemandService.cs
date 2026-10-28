using System.ComponentModel.DataAnnotations;
using kgs_api.Data;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services.Admin
{
    /// <summary>Một nhu cầu chờ duyệt như quản trị thấy. Tiêu chí đã bỏ toạ độ điểm ghim (thường là
    /// chỗ làm của người tìm) — quản trị cần biết nhu cầu là gì, không cần biết họ làm ở đâu.</summary>
    public sealed record AdminDemandDto(
        Guid Id, string Name, PublicListingSearchQuery Criteria, string? Note, string? ReviewReason,
        DateTime SubmittedAt, string UserName, string Email, bool EmailConfirmed, DateTime UserJoinedAt);

    public sealed record RejectDemandRequest([Required, MaxLength(300)] string Reason);

    public sealed record BulkDemandRequest(List<Guid> Ids, bool Approve, [MaxLength(300)] string? Reason);

    public sealed record BulkDemandResultDto(int Handled, int Skipped);

    /// <summary>Hàng đợi kiểm duyệt "Đăng nhu cầu": nhu cầu bị bộ lọc tự động giữ lại
    /// (DemandScreening) chờ quản trị duyệt hoặc từ chối.</summary>
    public sealed class AdminDemandService
    {
        private readonly ApplicationDbContext _db;
        private readonly INotificationSender _notifier;
        private readonly ILogger<AdminDemandService> _logger;

        public AdminDemandService(ApplicationDbContext db, INotificationSender notifier, ILogger<AdminDemandService> logger)
        {
            _db = db; _notifier = notifier; _logger = logger;
        }

        private IQueryable<SavedSearch> Pending() => _db.Set<SavedSearch>()
            .Where(s => s.DiscoverableByOwners && s.DemandReview == DemandReviewStatus.Pending);

        public Task<int> CountPendingAsync(CancellationToken ct) => Pending().CountAsync(ct);

        public async Task<IReadOnlyList<AdminDemandDto>> GetPendingAsync(CancellationToken ct)
        {
            var rows = await Pending().AsNoTracking()
                .OrderByDescending(s => s.DiscoverableSince)
                .Select(s => new
                {
                    s.Id, s.Name, s.CriteriaJson, s.DemandNote, s.DemandReviewReason,
                    Submitted = s.DiscoverableSince ?? s.CreatedAt,
                    UserName = s.User.Name, Email = s.User.Email!, s.User.EmailConfirmed, Joined = s.User.CreatedAt,
                })
                .ToListAsync(ct);
            return rows.Select(r => new AdminDemandDto(
                r.Id, r.Name,
                SavedSearchService.Deserialize(r.CriteriaJson) with { Latitude = null, Longitude = null, Within = null },
                r.DemandNote, r.DemandReviewReason, r.Submitted, r.UserName, r.Email, r.EmailConfirmed, r.Joined)).ToList();
        }

        public async Task ApproveAsync(Guid id, CancellationToken ct)
        {
            var s = await LoadPendingAsync(id, ct);
            Approve(s);
            await _db.SaveChangesAsync(ct);
            await NotifyApprovedAsync(s, ct);
        }

        public async Task RejectAsync(Guid id, string reason, CancellationToken ct)
        {
            var s = await LoadPendingAsync(id, ct);
            Reject(s, reason);
            await _db.SaveChangesAsync(ct);
            await NotifyRejectedAsync(s, ct);
        }

        public async Task<BulkDemandResultDto> BulkAsync(BulkDemandRequest request, CancellationToken ct)
        {
            if (request.Ids.Count == 0) throw new ValidationFailedException("Chưa chọn nhu cầu nào.");
            if (!request.Approve && string.IsNullOrWhiteSpace(request.Reason))
                throw new ValidationFailedException("Từ chối phải nêu lý do.");

            var items = await Pending().Where(s => request.Ids.Contains(s.Id)).ToListAsync(ct);
            foreach (var s in items)
            {
                if (request.Approve) Approve(s);
                else Reject(s, request.Reason!);
            }
            await _db.SaveChangesAsync(ct);
            // Thông báo SAU khi lưu: lưu hỏng thì không có thông báo nào về một quyết định chưa ghi.
            foreach (var s in items)
                if (request.Approve) await NotifyApprovedAsync(s, ct);
                else await NotifyRejectedAsync(s, ct);
            return new BulkDemandResultDto(items.Count, request.Ids.Count - items.Count);
        }

        private async Task<SavedSearch> LoadPendingAsync(Guid id, CancellationToken ct)
        {
            var s = await _db.Set<SavedSearch>().FirstOrDefaultAsync(x => x.Id == id, ct)
                ?? throw new NotFoundException("Không tìm thấy nhu cầu.");
            // Người tìm đã tắt, hoặc quản trị khác vừa xử lý xong.
            if (!s.DiscoverableByOwners || s.DemandReview != DemandReviewStatus.Pending)
                throw new ConflictException("Nhu cầu không còn chờ duyệt.");
            return s;
        }

        private static void Approve(SavedSearch s)
        {
            s.DemandReview = DemandReviewStatus.Approved;
            s.DemandReviewReason = null;
            s.DemandReviewedAt = DateTime.UtcNow;
        }

        private static void Reject(SavedSearch s, string reason)
        {
            s.DemandReview = DemandReviewStatus.Rejected;
            s.DemandReviewReason = reason.Trim();
            s.DemandReviewedAt = DateTime.UtcNow;
        }

        private Task NotifyApprovedAsync(SavedSearch s, CancellationToken ct) => SafeNotify(s.UserId,
            $"Nhu cầu “{s.Name}” đã được duyệt",
            "Chủ nhà phù hợp giờ đã thấy nhu cầu của bạn và có thể mời bạn xem nhà.", ct);

        private Task NotifyRejectedAsync(SavedSearch s, CancellationToken ct) => SafeNotify(s.UserId,
            $"Nhu cầu “{s.Name}” chưa được duyệt",
            $"Lý do: {s.DemandReviewReason}. Sửa lời nhắn rồi gửi lại trong trang Nhu cầu của tôi.", ct);

        private async Task SafeNotify(string userId, string title, string body, CancellationToken ct)
        {
            try
            {
                await _notifier.SendAsync(userId, title, body, "/nhu-cau", "Xem nhu cầu", ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Không gửi được thông báo kết quả duyệt nhu cầu tới {UserId}", userId);
            }
        }
    }
}
