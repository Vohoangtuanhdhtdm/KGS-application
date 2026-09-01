using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Dtos;
using kgs_api.Repositories;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using kgs_api.Interfaces;

namespace kgs_api.Services
{

    

    public sealed class ReminderService : IReminderService
    {
        private readonly IRepository<Reminder> _reminders;
        private readonly IRepository<Asset> _assets;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public ReminderService(IRepository<Reminder> reminders, IRepository<Asset> assets,
            IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _reminders = reminders; _assets = assets; _uow = uow; _currentUser = currentUser;
        }

        public async Task<ReminderDto> CreateAsync(ReminderCreateRequest request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            if (request.AssetId is not null)
            {
                var owns = await _assets.Query().AnyAsync(a => a.Id == request.AssetId && a.UserId == userId, ct);
                if (!owns) throw new NotFoundException("Không tìm thấy tài sản.");
            }

            var reminder = new Reminder
            {
                UserId = userId,
                AssetId = request.AssetId,
                LeaseContractId = request.LeaseContractId,
                Type = request.Type,
                Title = request.Title.Trim(),
                DueDate = DateTime.SpecifyKind(request.DueDate, DateTimeKind.Utc),
                Cycle = request.Cycle,
                NotifyDaysBefore = request.NotifyDaysBefore,
                IsActive = true
            };

            await _reminders.AddAsync(reminder, ct);
            await _uow.SaveChangesAsync(ct);
            return await ProjectOneAsync(reminder.Id, ct);
        }

        public async Task<ReminderDto> UpdateAsync(Guid reminderId, ReminderUpdateRequest request, CancellationToken ct = default)
        {
            var reminder = await GetOwnedAsync(reminderId, ct);

            reminder.Title = request.Title.Trim();
            reminder.DueDate = DateTime.SpecifyKind(request.DueDate, DateTimeKind.Utc);
            reminder.Cycle = request.Cycle;
            reminder.NotifyDaysBefore = request.NotifyDaysBefore;
            reminder.IsActive = request.IsActive;

            await _uow.SaveChangesAsync(ct);
            return await ProjectOneAsync(reminderId, ct);
        }

        public async Task DeleteAsync(Guid reminderId, CancellationToken ct = default)
        {
            var reminder = await GetOwnedAsync(reminderId, ct);
            _reminders.Remove(reminder);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task<IReadOnlyList<ReminderDto>> GetUpcomingAsync(int withinDays, CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;
            var limit = now.AddDays(Math.Clamp(withinDays, 1, 365));

            // Chạy trên partial index IX_Reminders_Active_DueDate (WHERE IsActive)
            return await Project(_reminders.Query().AsNoTracking()
                    .Where(r => r.UserId == _currentUser.UserId
                             && r.IsActive
                             && r.DueDate <= limit)
                    .OrderBy(r => r.DueDate))
                .ToListAsync(ct);
        }

        public async Task<PagedResult<ReminderDto>> ListAsync(bool? isActive, int page, int pageSize, CancellationToken ct = default)
        {
            var q = _reminders.Query().AsNoTracking()
                .Where(r => r.UserId == _currentUser.UserId);
            if (isActive is not null) q = q.Where(r => r.IsActive == isActive);

            var total = await q.CountAsync(ct);
            pageSize = Math.Clamp(pageSize, 1, 100);
            page = Math.Max(page, 1);

            var items = await Project(q.OrderBy(r => r.DueDate))
                .Skip((page - 1) * pageSize).Take(pageSize)
                .ToListAsync(ct);

            return new PagedResult<ReminderDto>(items, page, pageSize, total);
        }

        private async Task<Reminder> GetOwnedAsync(Guid id, CancellationToken ct)
            => await _reminders.Query()
                   .FirstOrDefaultAsync(r => r.Id == id && r.UserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy nhắc lịch.");

        private async Task<ReminderDto> ProjectOneAsync(Guid id, CancellationToken ct)
            => await Project(_reminders.Query().AsNoTracking().Where(r => r.Id == id)).FirstAsync(ct);

        private static IQueryable<ReminderDto> Project(IQueryable<Reminder> q) =>
            q.Select(r => new ReminderDto(
                r.Id, r.AssetId, r.Asset != null ? r.Asset.Name : null, r.LeaseContractId,
                r.Type, r.Title, r.DueDate, r.Cycle, r.NotifyDaysBefore, r.IsActive, r.LastNotifiedAt));
    }

    

    public sealed class LoggingNotificationSender : INotificationSender
    {
        private readonly ILogger<LoggingNotificationSender> _logger;
        public LoggingNotificationSender(ILogger<LoggingNotificationSender> logger) => _logger = logger;

        public Task SendAsync(string userId, string title, string body, CancellationToken ct = default)
        {
            _logger.LogInformation("[NOTIFY→{UserId}] {Title}: {Body}", userId, title, body);
            return Task.CompletedTask;
        }
    }

    public sealed class ReminderProcessingJob
    {
        private const int BatchSize = 200;
        private const int MaxNotifyWindowDays = 90; // NotifyDaysBefore tối đa cho phép

        private readonly ApplicationDbContext _db;
        private readonly INotificationSender _notifier;
        private readonly ILogger<ReminderProcessingJob> _logger;

        public ReminderProcessingJob(ApplicationDbContext db, INotificationSender notifier,
            ILogger<ReminderProcessingJob> logger)
        {
            _db = db; _notifier = notifier; _logger = logger;
        }

        public async Task RunAsync(CancellationToken ct)
        {
            var now = DateTime.UtcNow;

            // Bước 1 — thu hẹp bằng index (partial index WHERE IsActive):
            // mọi reminder có DueDate trong cửa sổ tối đa. Điều kiện chính xác
            // theo NotifyDaysBefore của từng dòng lọc tiếp ở bước 2 (in-memory,
            // trên tập đã rất nhỏ) — tránh biểu thức AddDays(cột) khó dịch SQL.
            //
            // Khi chạy NHIỀU instance: thay đoạn query này bằng raw SQL
            //   SELECT ... FOR UPDATE SKIP LOCKED
            // để hai instance không xử lý trùng một reminder.
            var candidates = await _db.Set<Reminder>()
                .Where(r => r.IsActive && r.DueDate <= now.AddDays(MaxNotifyWindowDays))
                .OrderBy(r => r.DueDate)
                .Take(BatchSize)
                .ToListAsync(ct);

            foreach (var r in candidates)
            {
                var notifyFrom = r.DueDate.AddDays(-r.NotifyDaysBefore);
                if (now < notifyFrom) continue;                                  // chưa tới cửa sổ báo
                if (r.LastNotifiedAt is not null && r.LastNotifiedAt >= notifyFrom) continue; // đã báo cho kỳ này

                try
                {
                    await _notifier.SendAsync(r.UserId, r.Title,
                        $"Đến hạn ngày {r.DueDate:dd/MM/yyyy}.", ct);
                    r.LastNotifiedAt = now;

                    // Đã QUA hạn → nhảy kỳ tiếp theo (lặp) hoặc tắt (một lần)
                    if (now >= r.DueDate)
                    {
                        if (r.Cycle == RecurrenceCycle.None)
                            r.IsActive = false;
                        else
                            r.DueDate = Advance(r.DueDate, r.Cycle, now);
                    }
                }
                catch (Exception ex)
                {
                    // Không đánh dấu LastNotifiedAt → lần chạy sau retry
                    _logger.LogWarning(ex, "Gửi thông báo reminder {ReminderId} thất bại", r.Id);
                }
            }

            await _db.SaveChangesAsync(ct);
        }

        /// <summary>Nhảy DueDate về tương lai theo chu kỳ (bù cả trường hợp job ngưng lâu ngày).</summary>
        internal static DateTime Advance(DateTime dueDate, RecurrenceCycle cycle, DateTime now)
        {
            var months = cycle switch
            {
                RecurrenceCycle.Monthly => 1,
                RecurrenceCycle.Quarterly => 3,
                RecurrenceCycle.SemiAnnually => 6,
                RecurrenceCycle.Annually => 12,
                _ => 0
            };
            if (months == 0) return dueDate;

            var next = dueDate;
            while (next <= now) next = next.AddMonths(months);
            return next;
        }
    }

}
