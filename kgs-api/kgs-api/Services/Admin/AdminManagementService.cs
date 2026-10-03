using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services.Admin
{
    /// <summary>Quản trị toàn hệ thống: mọi tin đăng (không chỉ hàng đợi duyệt) và người dùng.
    ///
    /// Trước đây admin chỉ thấy tin CHỜ DUYỆT — một tin lừa đảo đã lên sóng mà chưa ai báo
    /// thì không có cách nào gỡ, và tài khoản đăng tin lừa đảo hàng loạt thì không có cách
    /// nào chặn: xoá từng tin xong họ đăng lại.</summary>
    public sealed class AdminManagementService
    {
        private const string AdminRole = "Admin";

        private readonly ApplicationDbContext _db;
        private readonly UserManager<ApplicationUser> _users;
        private readonly ICurrentUserService _currentUser;
        private readonly INotificationSender _notifier;
        private readonly UserAccessGuard _guard;
        private readonly ILogger<AdminManagementService> _logger;

        public AdminManagementService(
            ApplicationDbContext db, UserManager<ApplicationUser> users, ICurrentUserService currentUser,
            INotificationSender notifier, UserAccessGuard guard, ILogger<AdminManagementService> logger)
        {
            _db = db; _users = users; _currentUser = currentUser; _notifier = notifier; _guard = guard; _logger = logger;
        }

        // ==================== Tin đăng ====================

        public async Task<PagedAdminResult<AdminListingRowDto>> SearchListingsAsync(
            string? q, ListingStatus? status, ListingType? type, AssetDomainType? assetType, string? city,
            string? ownerId, bool reportedOnly, string? sort, int page, int pageSize, CancellationToken ct)
        {
            pageSize = Math.Clamp(pageSize, 1, 100);
            page = Math.Max(page, 1);
            var src = _db.Listings.AsNoTracking().AsQueryable();

            if (status is not null) src = src.Where(l => l.Status == status);
            if (type is not null) src = src.Where(l => l.Type == type);
            if (assetType is not null) src = src.Where(l => l.Asset.TypeProperty == assetType);
            var canonCity = AdministrativeNames.CanonicalCity(city);
            if (!string.IsNullOrWhiteSpace(canonCity)) src = src.Where(l => l.Asset.Address.City == canonCity);
            if (!string.IsNullOrWhiteSpace(ownerId)) src = src.Where(l => l.Asset.UserId == ownerId);
            if (reportedOnly)
                src = src.Where(l => _db.ListingReports.Any(r => r.ListingId == l.Id && r.Status == ListingReportStatus.Pending));
            if (!string.IsNullOrWhiteSpace(q))
            {
                var kw = $"%{q.Trim()}%";
                src = src.Where(l => EF.Functions.ILike(l.Title, kw)
                                  || EF.Functions.ILike(l.Slug!, kw)
                                  || EF.Functions.ILike(l.Asset.User.Name, kw)
                                  || EF.Functions.ILike(l.Asset.User.Email!, kw)
                                  || EF.Functions.ILike(l.Asset.Address.District, kw));
            }

            var total = await src.CountAsync(ct);
            var ordered = sort switch
            {
                "reports" => src.OrderByDescending(l => _db.ListingReports.Count(r => r.ListingId == l.Id && r.Status == ListingReportStatus.Pending))
                                .ThenByDescending(l => l.CreatedAt),
                "views" => src.OrderByDescending(l => l.ViewCount),
                "price" => src.OrderByDescending(l => l.Price),
                _ => src.OrderByDescending(l => l.CreatedAt),
            };
            var items = await Project(ordered.ThenBy(l => l.Id).Skip((page - 1) * pageSize).Take(pageSize), ct);
            return new PagedAdminResult<AdminListingRowDto>(items, page, pageSize, total);
        }

        /// <summary>Gỡ một tin bất kỳ đang hiển thị hoặc chờ duyệt — không cần đợi ai báo.</summary>
        public async Task<AdminActionResultDto> TakeDownAsync(Guid listingId, AdminTakeDownRequest req, CancellationToken ct)
        {
            var listing = await LoadAsync(listingId, ct);
            if (listing.Status is not (ListingStatus.Approved or ListingStatus.Pending))
                throw new ConflictException("Chỉ gỡ được tin đang hiển thị hoặc đang chờ duyệt.");

            var note = Clean(req.Note);
            var reasons = req.Reasons.Distinct().ToList();
            if (reasons.Contains(ModerationReason.Other) && note is null)
                throw new ValidationFailedException("Chọn \"Lý do khác\" thì cần ghi chú cụ thể.");

            listing.Status = ListingStatus.Rejected;
            listing.ModerationNote = "Quản trị viên gỡ tin: " + string.Join("; ", reasons.Select(Describe)) + "." + (note is null ? "" : $" {note}");
            await LogAsync(listing, ModerationAction.TakenDown, reasons, listing.ModerationNote, ct);
            await _db.SaveChangesAsync(ct);

            await NotifyAsync(listing.Asset.UserId, $"Tin đăng đã bị gỡ: {listing.Title}",
                $"{listing.ModerationNote} Nếu bạn cho rằng đây là nhầm lẫn, hãy sửa tin và gửi duyệt lại.",
                "/tin-cua-toi", "Xem tin", ct);
            return new AdminActionResultDto("Đã gỡ tin và báo cho chủ tin.", 1);
        }

        /// <summary>Khôi phục tin do quản trị gỡ/đóng nhầm (AdminRules.CanRestore).</summary>
        public async Task<AdminActionResultDto> RestoreAsync(Guid listingId, AdminRestoreRequest req, CancellationToken ct)
        {
            var listing = await LoadAsync(listingId, ct);
            var latest = await LatestActionAsync(listing.Id, ct);
            if (!AdminRules.CanRestore(listing.Status, latest))
                throw new ConflictException("Chỉ khôi phục được tin do quản trị viên gỡ hoặc đóng.");
            if (await IsLockedAsync(listing.Asset.UserId, ct))
                throw new ConflictException("Tài khoản người đăng đang bị khoá — mở khoá trước khi khôi phục tin.");

            await RestoreCoreAsync(listing, Clean(req.Note), ct);
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(listing.Asset.UserId, $"Tin đăng đã được khôi phục: {listing.Title}",
                "Quản trị viên đã xem xét lại và cho tin hiển thị trở lại.", "/tin-cua-toi", "Xem tin", ct);
            return new AdminActionResultDto("Đã khôi phục tin.", 1);
        }

        // ==================== Người dùng ====================

        public async Task<PagedAdminResult<AdminUserRowDto>> SearchUsersAsync(
            string? q, string? filter, string? sort, int page, int pageSize, CancellationToken ct)
        {
            pageSize = Math.Clamp(pageSize, 1, 100);
            page = Math.Max(page, 1);
            var now = DateTimeOffset.UtcNow;
            var adminRoleId = await AdminRoleIdAsync(ct);
            var users = _db.Users.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(q))
            {
                var kw = $"%{q.Trim()}%";
                users = users.Where(u => EF.Functions.ILike(u.Name, kw) || EF.Functions.ILike(u.Email!, kw)
                                      || EF.Functions.ILike(u.PhoneNumber!, kw));
            }
            users = filter switch
            {
                "admin" => users.Where(u => _db.UserRoles.Any(r => r.UserId == u.Id && r.RoleId == adminRoleId)),
                "locked" => users.Where(u => u.AdminLockedAt != null && u.LockoutEnd > now),
                "violations" => users.Where(u => _db.ListingReports.Any(r =>
                    r.Listing.Asset.UserId == u.Id && r.Status == ListingReportStatus.Resolved)),
                _ => users,
            };

            var total = await users.CountAsync(ct);
            var rows = ProjectUsers(users, adminRoleId, now);
            var sorted = sort switch
            {
                "listings" => rows.OrderByDescending(u => u.ListingCount),
                "violations" => rows.OrderByDescending(u => u.ConfirmedViolations).ThenByDescending(u => u.PendingReports),
                _ => rows.OrderByDescending(u => u.CreatedAt),
            };
            var items = await sorted.ThenBy(u => u.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
            return new PagedAdminResult<AdminUserRowDto>(items.Select(u => u.ToDto()).ToList(), page, pageSize, total);
        }

        public async Task<AdminUserDetailDto> GetUserAsync(string userId, CancellationToken ct)
        {
            var now = DateTimeOffset.UtcNow;
            var adminRoleId = await AdminRoleIdAsync(ct);
            var row = (await ProjectUsers(_db.Users.AsNoTracking().Where(u => u.Id == userId), adminRoleId, now)
                .FirstOrDefaultAsync(ct) ?? throw new NotFoundException("Không tìm thấy người dùng.")).ToDto();
            var meta = await _db.Users.AsNoTracking().Where(u => u.Id == userId)
                .Select(u => new { u.AdminLockedAt, u.AdminLockedByUserId }).FirstAsync(ct);
            var lockedBy = meta.AdminLockedByUserId is null ? null
                : await _db.Users.Where(u => u.Id == meta.AdminLockedByUserId).Select(u => u.Name).FirstOrDefaultAsync(ct);

            var listings = await Project(_db.Listings.AsNoTracking().Where(l => l.Asset.UserId == userId)
                .OrderByDescending(l => l.CreatedAt).Take(50), ct);
            return new AdminUserDetailDto(row, row.IsLocked ? meta.AdminLockedAt : null, row.IsLocked ? lockedBy : null, listings);
        }

        public async Task<AdminActionResultDto> LockAsync(string userId, AdminLockUserRequest req, CancellationToken ct)
        {
            var actor = _currentUser.UserId;
            var user = await _users.FindByIdAsync(userId) ?? throw new NotFoundException("Không tìm thấy người dùng.");
            var err = AdminRules.CannotLock(actor, userId, await _users.IsInRoleAsync(user, AdminRole),
                await IsLockedAsync(userId, ct));
            if (err is not null) throw new ConflictException(err);

            var now = DateTimeOffset.UtcNow;
            user.LockoutEnabled = true;
            user.LockoutEnd = AdminRules.LockEnd(now, req.Days);
            user.AdminLockReason = req.Reason.Trim();
            user.AdminLockedAt = now.UtcDateTime;
            user.AdminLockedByUserId = actor;

            // Đăng xuất mọi thiết bị: thu hồi refresh token. Access token còn sống bị chặn ngay
            // bởi UserAccessGuard.
            var tokens = await _db.Set<RefreshToken>().Where(t => t.UserId == userId && t.RevokedAt == null).ToListAsync(ct);
            foreach (var t in tokens) t.RevokedAt = now.UtcDateTime;

            var hidden = 0;
            if (req.HideListings)
            {
                var live = await _db.Listings.Include(l => l.Asset)
                    .Where(l => l.Asset.UserId == userId && (l.Status == ListingStatus.Approved || l.Status == ListingStatus.Pending))
                    .ToListAsync(ct);
                foreach (var l in live)
                {
                    l.ModerationNote = AdminRules.LockTakedownNote(user.AdminLockReason, l.Status == ListingStatus.Pending);
                    l.Status = ListingStatus.Rejected;
                    await LogAsync(l, ModerationAction.TakenDown, new List<ModerationReason> { ModerationReason.ProhibitedContent }, l.ModerationNote, ct);
                }
                hidden = live.Count;
            }

            await _db.SaveChangesAsync(ct);   // cùng một lần lưu với user — UserManager dùng chung DbContext
            _guard.Invalidate(userId);

            var until = req.Days is null ? "vô thời hạn" : $"tới {user.LockoutEnd:dd/MM/yyyy}";
            await NotifyAsync(userId, "Tài khoản KGS của bạn đã bị khoá",
                $"Tài khoản bị khoá {until}. Lý do: {user.AdminLockReason}. Nếu cần trao đổi, hãy phản hồi email này.",
                "/", "Mở KGS", ct);
            return new AdminActionResultDto(
                hidden > 0 ? $"Đã khoá tài khoản và gỡ {hidden} tin." : "Đã khoá tài khoản.", hidden);
        }

        public async Task<AdminActionResultDto> UnlockAsync(string userId, AdminUnlockUserRequest req, CancellationToken ct)
        {
            var user = await _users.FindByIdAsync(userId) ?? throw new NotFoundException("Không tìm thấy người dùng.");
            if (!await IsLockedAsync(userId, ct)) throw new ConflictException("Tài khoản không bị khoá.");

            user.LockoutEnd = null;
            user.AccessFailedCount = 0;
            user.AdminLockReason = null;
            user.AdminLockedAt = null;
            user.AdminLockedByUserId = null;

            var restored = 0;
            if (req.RestoreListings)
            {
                // Chỉ những tin bị gỡ VÌ khoá và chưa bị đụng tới sau đó.
                var candidates = await _db.Listings.Include(l => l.Asset)
                    .Where(l => l.Asset.UserId == userId && l.Status == ListingStatus.Rejected
                             && l.ModerationNote != null && l.ModerationNote.StartsWith(AdminRules.LockTakedownPrefix))
                    .ToListAsync(ct);
                foreach (var l in candidates)
                {
                    if (await LatestActionAsync(l.Id, ct) != ModerationAction.TakenDown) continue;
                    await RestoreCoreAsync(l, "Mở khoá tài khoản", ct);
                    restored++;
                }
            }

            await _db.SaveChangesAsync(ct);
            _guard.Invalidate(userId);
            await NotifyAsync(userId, "Tài khoản KGS của bạn đã được mở khoá",
                restored > 0 ? $"Bạn đăng nhập lại được; {restored} tin đã hiển thị trở lại." : "Bạn đăng nhập lại được.",
                "/login", "Đăng nhập", ct);
            return new AdminActionResultDto(
                restored > 0 ? $"Đã mở khoá và khôi phục {restored} tin." : "Đã mở khoá tài khoản.", restored);
        }

        public async Task<AdminActionResultDto> SetAdminAsync(string userId, bool grant, CancellationToken ct)
        {
            var user = await _users.FindByIdAsync(userId) ?? throw new NotFoundException("Không tìm thấy người dùng.");
            var isAdmin = await _users.IsInRoleAsync(user, AdminRole);
            if (isAdmin == grant) return new AdminActionResultDto(grant ? "Đã là quản trị viên." : "Không phải quản trị viên.", 0);

            var adminCount = (await _users.GetUsersInRoleAsync(AdminRole)).Count;
            var err = AdminRules.CannotChangeAdmin(_currentUser.UserId, userId, grant, await IsLockedAsync(userId, ct), adminCount);
            if (err is not null) throw new ConflictException(err);

            var result = grant ? await _users.AddToRoleAsync(user, AdminRole) : await _users.RemoveFromRoleAsync(user, AdminRole);
            if (!result.Succeeded) throw new ConflictException(string.Join("; ", result.Errors.Select(e => e.Description)));
            _guard.Invalidate(userId);
            return new AdminActionResultDto(grant ? $"Đã cấp quyền Admin cho {user.Name}." : $"Đã thu quyền Admin của {user.Name}.", 0);
        }

        // ==================== Nội bộ ====================

        private async Task<List<AdminListingRowDto>> Project(IQueryable<Listing> q, CancellationToken ct)
        {
            var now = DateTimeOffset.UtcNow;
            var rows = await q.Select(l => new
            {
                l.Id, l.Slug, l.Title, l.Type, l.Status, l.Price, l.RentPaymentCycle,
                l.Asset.TypeProperty, l.Asset.Address.City, l.Asset.Address.District,
                UnitName = l.AssetUnit != null ? l.AssetUnit.Name : null,
                OwnerId = l.Asset.UserId, OwnerName = l.Asset.User.Name, OwnerEmail = l.Asset.User.Email!,
                OwnerLocked = l.Asset.User.AdminLockedAt != null && l.Asset.User.LockoutEnd > now,
                l.CreatedAt, l.PublishedAt, l.ViewCount, l.ModerationNote,
                Pending = _db.ListingReports.Count(r => r.ListingId == l.Id && r.Status == ListingReportStatus.Pending),
                Confirmed = _db.ListingReports.Count(r => r.ListingId == l.Id && r.Status == ListingReportStatus.Resolved),
                Latest = _db.ListingModerationEvents.Where(e => e.ListingId == l.Id)
                    .OrderByDescending(e => e.CreatedAt).Select(e => (ModerationAction?)e.Action).FirstOrDefault(),
            }).ToListAsync(ct);
            return rows.Select(r => new AdminListingRowDto(
                r.Id, r.Slug, r.Title, r.Type, r.Status, r.Price, r.RentPaymentCycle, r.TypeProperty,
                r.City, r.District, r.UnitName, r.OwnerId, r.OwnerName, r.OwnerEmail, r.OwnerLocked,
                r.CreatedAt, r.PublishedAt, r.ViewCount, r.Pending, r.Confirmed, r.ModerationNote,
                AdminRules.CanRestore(r.Status, r.Latest))).ToList();
        }

        /// <summary>Hàng trung gian để EF sắp xếp được trên các cột tính toán — sắp xếp sau
        /// khi đã dựng record bằng constructor thì EF không dịch sang SQL được.</summary>
        private sealed class UserRow
        {
            public string Id { get; init; } = "";
            public string Name { get; init; } = "";
            public string Email { get; init; } = "";
            public string? Phone { get; init; }
            public DateTime CreatedAt { get; init; }
            public bool EmailConfirmed { get; init; }
            public bool IsAdmin { get; init; }
            public bool IsLocked { get; init; }
            public DateTimeOffset? LockoutEnd { get; init; }
            public string? LockReason { get; init; }
            public int ListingCount { get; init; }
            public int LiveListingCount { get; init; }
            public int ConfirmedViolations { get; init; }
            public int PendingReports { get; init; }

            public AdminUserRowDto ToDto() => new(
                Id, Name, Email, Phone, CreatedAt, EmailConfirmed, IsAdmin, IsLocked,
                IsLocked ? LockoutEnd : null, IsLocked ? LockReason : null,
                ListingCount, LiveListingCount, ConfirmedViolations, PendingReports);
        }

        private IQueryable<UserRow> ProjectUsers(IQueryable<ApplicationUser> users, string? adminRoleId, DateTimeOffset now)
            => users.Select(u => new UserRow
            {
                Id = u.Id,
                Name = u.Name,
                Email = u.Email!,
                Phone = u.PhoneNumber,
                CreatedAt = u.CreatedAt,
                EmailConfirmed = u.EmailConfirmed,
                IsAdmin = _db.UserRoles.Any(r => r.UserId == u.Id && r.RoleId == adminRoleId),
                IsLocked = u.AdminLockedAt != null && u.LockoutEnd > now,
                LockoutEnd = u.LockoutEnd,
                LockReason = u.AdminLockReason,
                ListingCount = _db.Listings.Count(l => l.Asset.UserId == u.Id),
                LiveListingCount = _db.Listings.Count(l => l.Asset.UserId == u.Id && l.Status == ListingStatus.Approved),
                ConfirmedViolations = _db.ListingReports.Count(r => r.Listing.Asset.UserId == u.Id && r.Status == ListingReportStatus.Resolved),
                PendingReports = _db.ListingReports.Count(r => r.Listing.Asset.UserId == u.Id && r.Status == ListingReportStatus.Pending),
            });

        private async Task<Listing> LoadAsync(Guid id, CancellationToken ct)
            => await _db.Listings.Include(l => l.Asset).FirstOrDefaultAsync(l => l.Id == id, ct)
               ?? throw new NotFoundException("Không tìm thấy tin đăng.");

        private Task<ModerationAction?> LatestActionAsync(Guid listingId, CancellationToken ct)
            => _db.ListingModerationEvents.Where(e => e.ListingId == listingId)
                .OrderByDescending(e => e.CreatedAt).Select(e => (ModerationAction?)e.Action).FirstOrDefaultAsync(ct);

        private async Task<bool> IsLockedAsync(string userId, CancellationToken ct)
        {
            var now = DateTimeOffset.UtcNow;
            return await _db.Users.AnyAsync(u => u.Id == userId && u.AdminLockedAt != null && u.LockoutEnd > now, ct);
        }

        private Task<string?> AdminRoleIdAsync(CancellationToken ct)
            => _db.Roles.Where(r => r.Name == AdminRole).Select(r => r.Id).FirstOrDefaultAsync(ct);

        private async Task RestoreCoreAsync(Listing listing, string? note, CancellationToken ct)
        {
            if (listing.ModerationNote is not null
                && AdminRules.StatusAfterUnlock(listing.ModerationNote) == ListingStatus.Pending)
            {
                // Bị gỡ lúc còn chờ duyệt → về hàng đợi, không lên sóng thẳng mà chưa ai duyệt.
                listing.Status = ListingStatus.Pending;
                listing.ModerationNote = null;
                await LogAsync(listing, ModerationAction.Submitted, null, "Trả về hàng đợi duyệt sau khi khôi phục", ct);
                return;
            }
            listing.Status = ListingStatus.Approved;
            listing.ModerationNote = null;
            listing.PublishedAt ??= DateTime.UtcNow;
            await LogAsync(listing, ModerationAction.Approved, null, note is null ? "Khôi phục tin" : $"Khôi phục tin: {note}", ct);
        }

        private async Task LogAsync(Listing listing, ModerationAction action, List<ModerationReason>? reasons, string? note, CancellationToken ct)
        {
            var round = await _db.ListingModerationEvents.CountAsync(e => e.ListingId == listing.Id, ct)
                      + _db.ListingModerationEvents.Local.Count(e => e.ListingId == listing.Id);
            _db.ListingModerationEvents.Add(new ListingModerationEvent
            {
                ListingId = listing.Id, Action = action, Reasons = reasons ?? new(),
                Note = note, ModeratorUserId = _currentUser.UserId, Round = round + 1,
            });
        }

        private async Task NotifyAsync(string userId, string title, string body, string link, string label, CancellationToken ct)
        {
            try { await _notifier.SendAsync(userId, title, body, link, label, ct); }
            catch (Exception ex) { _logger.LogWarning(ex, "Không gửi được thông báo quản trị tới {UserId}", userId); }
        }

        private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

        private static string Describe(ModerationReason r) => r switch
        {
            ModerationReason.MissingOrBadPhotos => "ảnh không đúng bất động sản",
            ModerationReason.ThinDescription => "mô tả sơ sài",
            ModerationReason.PriceOrCostIssue => "giá hoặc chi phí sai lệch",
            ModerationReason.AddressIssue => "địa chỉ sai",
            ModerationReason.MissingTerms => "thiếu điều kiện thuê",
            ModerationReason.Duplicate => "tin trùng lặp",
            ModerationReason.ProhibitedContent => "nội dung vi phạm hoặc có dấu hiệu lừa đảo",
            _ => "lý do khác",
        };
    }
}
