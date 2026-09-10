using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Dtos.Auth;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Dtos;

namespace kgs_api.Controllers
{
    /// <summary>Kiểm duyệt tin đăng — nghiệp vụ lõi của một nền tảng môi giới.
    ///
    /// Nguyên tắc: admin phải XEM ĐƯỢC NỘI DUNG trước khi quyết định, và chủ tin phải
    /// BIẾT VÌ SAO khi bị từ chối. Thiếu một trong hai thì kiểm duyệt chỉ là hình thức.</summary>
    [ApiController]
    [Authorize(Roles = "Admin")]          // ← chặn ở tầng framework, không cần check thủ công
    [Route("api/admin/listings")]
    public sealed class AdminListingsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly INotificationSender _notifier;
        private readonly ICurrentUserService _currentUser;
        private readonly ILogger<AdminListingsController> _logger;

        public AdminListingsController(
            ApplicationDbContext db,
            INotificationSender notifier,
            ICurrentUserService currentUser,
            ILogger<AdminListingsController> logger)
        {
            _db = db; _notifier = notifier; _currentUser = currentUser; _logger = logger;
        }

        /// <summary>Hàng đợi chờ duyệt, lọc được theo loại tin, khu vực và người đăng.</summary>
        [HttpGet("pending")]
        public async Task<IActionResult> GetPending(
            [FromQuery] ListingType? type,
            [FromQuery] string? city,
            [FromQuery] string? district,
            [FromQuery] string? keyword,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken ct = default)
        {
            pageSize = Math.Clamp(pageSize, 1, 100);
            page = Math.Max(page, 1);

            var q = _db.Listings.AsNoTracking().Where(l => l.Status == ListingStatus.Pending);

            if (type is not null) q = q.Where(l => l.Type == type);
            if (!string.IsNullOrWhiteSpace(city)) q = q.Where(l => l.Asset.Address.City == city);
            if (!string.IsNullOrWhiteSpace(district)) q = q.Where(l => l.Asset.Address.District == district);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var kw = $"%{keyword.Trim()}%";
                q = q.Where(l => EF.Functions.ILike(l.Title, kw)
                              || EF.Functions.ILike(l.Asset.User.Name, kw)
                              || EF.Functions.ILike(l.Asset.User.Email!, kw));
            }

            var total = await q.CountAsync(ct);

            var items = await q
                .OrderBy(l => l.CreatedAt)                    // tin cũ duyệt trước
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(l => new PendingListingDto(
                    l.Id, l.Title, l.Price,
                    l.Asset.Address.City, l.Asset.Address.District,
                    l.AssetUnit != null ? l.AssetUnit.Name : null,
                    l.Asset.User.Name, l.Asset.User.Email!, l.CreatedAt,
                    l.Images.Count))
                .ToListAsync(ct);

            return Ok(new { items, page, pageSize, totalCount = total });
        }

        /// <summary>Toàn bộ nội dung của một tin để admin xem trước khi quyết định.</summary>
        [HttpGet("{listingId:guid}")]
        public async Task<ActionResult<AdminListingDetailDto>> GetDetail(
            Guid listingId, CancellationToken ct)
        {
            // Giữ nguyên Point rồi tách Y/X sau khi materialize — ST_Y(geography) không
            // tồn tại nên không tách được trong biểu thức dịch sang SQL.
            var row = await _db.Listings.AsNoTracking()
                .Where(l => l.Id == listingId)
                .Select(l => new
                {
                    l.Id, l.Title, l.Description, l.Type, l.Status, l.Price, l.RentPaymentCycle,
                    l.Asset.Address,
                    l.Asset.Location,
                    l.Asset.TypeProperty,
                    UnitName = l.AssetUnit != null ? l.AssetUnit.Name : null,
                    Area = l.AssetUnit != null ? l.AssetUnit.Area : l.Asset.Area,
                    l.Asset.Bedrooms, l.Asset.Bathrooms, l.Asset.Floors,
                    l.Asset.HouseDirection, l.Asset.LegalStatus, l.Asset.FurnitureState,
                    ImageUrls = l.Images.OrderBy(i => i.SortOrder).Select(i => i.File.Url).ToList(),
                    l.Amenities,
                    l.Terms,
                    OwnerId = l.Asset.UserId,
                    OwnerName = l.Asset.User.Name,
                    OwnerEmail = l.Asset.User.Email!,
                    OwnerPhone = l.Asset.User.PhoneNumber,
                    // Đếm tin của cùng người đăng: một tài khoản có 40 tin chờ duyệt là
                    // tín hiệu rất khác với một tài khoản có 1 tin.
                    OwnerListingCount = _db.Listings.Count(x => x.Asset.UserId == l.Asset.UserId),
                    l.CreatedAt, l.ModerationNote
                })
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            var totalCost = row.Price
                + (row.Terms.ServiceFee ?? 0)
                + (row.Terms.ParkingFee ?? 0)
                + (row.Terms.InternetFee ?? 0);

            var completeness =
                (row.Terms.DepositMonths != null ? 15 : 0)
              + (row.Terms.ElectricityPrice != null ? 15 : 0)
              + (row.Terms.WaterPrice != null ? 15 : 0)
              + (row.Terms.AvailableFrom != null ? 10 : 0)
              + (row.Terms.MinLeaseMonths != null ? 5 : 0)
              + (row.Terms.MaxOccupants != null ? 5 : 0)
              + (row.Terms.PetsAllowed != null ? 10 : 0)
              + (row.Terms.CurfewFree != null ? 5 : 0)
              + (row.Terms.SharedWithOwner != null ? 5 : 0)
              + (row.Amenities.Count >= 3 ? 10 : 0)
              + (row.Description.Length >= 120 ? 5 : 0);

            return Ok(new AdminListingDetailDto(
                row.Id, row.Title, row.Description, row.Type, row.Status, row.Price,
                row.RentPaymentCycle, totalCost,
                row.Address.City, row.Address.District, row.Address.Ward, row.Address.Detail,
                row.Location?.Y, row.Location?.X,    // Y=lat, X=lng — dễ đảo nhầm
                row.TypeProperty, ListingService.AssetTypeLabel(row.TypeProperty), row.UnitName,
                row.Area, row.Bedrooms, row.Bathrooms, row.Floors,
                row.HouseDirection, row.LegalStatus, row.FurnitureState,
                row.ImageUrls, row.Amenities, completeness,
                row.OwnerId, row.OwnerName, row.OwnerEmail, row.OwnerPhone, row.OwnerListingCount,
                row.CreatedAt, row.ModerationNote));
        }

        /// <summary>Duyệt tin đăng.</summary>
        [HttpPost("{listingId:guid}/approve")]
        public async Task<IActionResult> Approve(
            Guid listingId, [FromBody] ApproveListingRequest request, CancellationToken ct)
        {
            var listing = await _db.Listings
                .Include(l => l.Asset)
                .FirstOrDefaultAsync(l => l.Id == listingId, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            if (listing.Status != ListingStatus.Pending)
                throw new ConflictException($"Tin đăng đang ở trạng thái {listing.Status}, không thể duyệt.");

            ApplyApprove(listing, request.Note);
            await GhiLuuVetAsync(listing, ModerationAction.Approved, null, request.Note, ct);
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(listing, approved: true, reason: null, ct);

            return Ok(new { message = "Đã duyệt tin đăng.", listingId, status = listing.Status.ToString() });
        }

        /// <summary>Từ chối tin đăng (bắt buộc nêu lý do).</summary>
        [HttpPost("{listingId:guid}/reject")]
        public async Task<IActionResult> Reject(
            Guid listingId, [FromBody] RejectListingRequest request, CancellationToken ct)
        {
            var listing = await _db.Listings
                .Include(l => l.Asset)
                .FirstOrDefaultAsync(l => l.Id == listingId, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            if (listing.Status != ListingStatus.Pending)
                throw new ConflictException($"Tin đăng đang ở trạng thái {listing.Status}, không thể từ chối.");

            listing.Status = ListingStatus.Rejected;
            listing.ModerationNote = request.Reason;

            await GhiLuuVetAsync(listing, ModerationAction.Rejected, request.Reasons, request.Reason, ct);
            await _db.SaveChangesAsync(ct);
            await NotifyAsync(listing, approved: false, reason: request.Reason, ct);

            return Ok(new { message = "Đã từ chối tin đăng.", listingId, reason = request.Reason });
        }

        /// <summary>Trả tin về cho chủ tin sửa.
        ///
        /// Bậc trung gian giữa duyệt và từ chối. Trước đây kiểm duyệt viên chỉ có hai lối
        /// ra, nên một tin thiếu ảnh — việc chủ tin sửa trong mười giây — vẫn phải nhận
        /// "bị từ chối". Từ chối là phán quyết về tin; yêu cầu chỉnh sửa là một lời nhắc
        /// việc. Trộn hai thứ đó vào một nút làm hỏng cả hai.</summary>
        [HttpPost("{listingId:guid}/request-changes")]
        public async Task<IActionResult> RequestChanges(
            Guid listingId, [FromBody] RequestChangesRequest request, CancellationToken ct)
        {
            var listing = await _db.Listings
                .Include(l => l.Asset)
                .FirstOrDefaultAsync(l => l.Id == listingId, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            if (listing.Status != ListingStatus.Pending)
                throw new ConflictException(
                    $"Tin đăng đang ở trạng thái {listing.Status}, không thể yêu cầu chỉnh sửa.");

            if (request.Reasons.Contains(ModerationReason.Other) && string.IsNullOrWhiteSpace(request.Note))
                throw new ValidationFailedException("Chọn lý do \"Khác\" thì phải ghi rõ cần sửa gì.");

            listing.Status = ListingStatus.ChangesRequested;
            // Vẫn ghi vào ModerationNote để các màn hình cũ đọc trường này không bị trống —
            // nhưng nguồn sự thật của lịch sử là bảng ListingModerationEvents.
            listing.ModerationNote = request.Note;

            await GhiLuuVetAsync(listing, ModerationAction.ChangesRequested, request.Reasons, request.Note, ct);
            await _db.SaveChangesAsync(ct);
            await NotifyChangesRequestedAsync(listing, request.Reasons, request.Note, ct);

            return Ok(new
            {
                message = "Đã gửi yêu cầu chỉnh sửa cho chủ tin.",
                listingId,
                status = listing.Status.ToString(),
            });
        }

        /// <summary>Lịch sử kiểm duyệt của một tin — dùng cho màn hình quản trị.</summary>
        [HttpGet("{listingId:guid}/moderation-history")]
        public async Task<ActionResult<IReadOnlyList<ModerationEventDto>>> ModerationHistory(
            Guid listingId, CancellationToken ct)
        {
            var rows = await _db.ListingModerationEvents
                .AsNoTracking()
                .Where(e => e.ListingId == listingId)
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => new ModerationEventDto(e.Action, e.Reasons, e.Note, e.Round, e.CreatedAt))
                .ToListAsync(ct);

            return Ok(rows);
        }

        /// <summary>Duyệt hoặc từ chối nhiều tin cùng lúc.
        ///
        /// Tin không còn ở trạng thái Pending bị BỎ QUA thay vì làm hỏng cả lô — hàng đợi
        /// là dữ liệu động, một tin có thể đã được admin khác xử lý trong lúc đang chọn.</summary>
        [HttpPost("bulk")]
        public async Task<ActionResult<BulkModerateResultDto>> BulkModerate(
            [FromBody] BulkModerateRequest request, CancellationToken ct)
        {
            if (request.ListingIds.Count == 0)
                throw new ValidationFailedException("Chưa chọn tin nào.");

            if (!request.Approve && string.IsNullOrWhiteSpace(request.Reason))
                throw new ValidationFailedException("Từ chối hàng loạt vẫn phải nêu lý do.");

            var listings = await _db.Listings
                .Include(l => l.Asset)
                .Where(l => request.ListingIds.Contains(l.Id))
                .ToListAsync(ct);

            var messages = new List<string>();
            var handled = new List<Listing>();

            foreach (var listing in listings)
            {
                if (listing.Status != ListingStatus.Pending)
                {
                    messages.Add($"\"{listing.Title}\" đang ở trạng thái {listing.Status} — bỏ qua.");
                    continue;
                }

                if (request.Approve)
                {
                    ApplyApprove(listing, request.Reason);
                }
                else
                {
                    listing.Status = ListingStatus.Rejected;
                    listing.ModerationNote = request.Reason;
                }

                handled.Add(listing);
            }

            await _db.SaveChangesAsync(ct);

            // Gửi thông báo SAU khi lưu: nếu SaveChanges hỏng thì không có email nào báo
            // một quyết định chưa từng được ghi.
            foreach (var listing in handled)
                await NotifyAsync(listing, request.Approve, request.Reason, ct);

            return Ok(new BulkModerateResultDto(handled.Count, listings.Count - handled.Count, messages));
        }

        /// <summary>Thống kê nhanh cho dashboard admin.</summary>
        [HttpGet("stats")]
        public async Task<IActionResult> Stats(CancellationToken ct)
        {
            var stats = await _db.Listings
                .GroupBy(l => l.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })
                .ToListAsync(ct);

            return Ok(new
            {
                byStatus = stats.Select(s => new { Status = s.Status.ToString(), s.Count }),
                totalUsers = await _db.Users.CountAsync(ct),
                totalAssets = await _db.Assets.CountAsync(ct)
            });
        }

        // ==================== Helpers ====================

        /// <summary>Ghi một dòng vào lịch sử kiểm duyệt.
        ///
        /// Gọi ở MỌI đường ra của kiểm duyệt — duyệt, yêu cầu sửa, từ chối, kể cả trong xử
        /// lý hàng loạt. Bỏ sót một đường là lịch sử có lỗ, mà một lịch sử có lỗ thì không
        /// dùng được vào việc gì: chủ tin nhìn vào không hiểu vì sao trạng thái nhảy.</summary>
        private async Task GhiLuuVetAsync(
            Listing listing,
            ModerationAction action,
            IReadOnlyList<ModerationReason>? reasons,
            string? note,
            CancellationToken ct)
        {
            var soVongTruoc = await _db.ListingModerationEvents
                .CountAsync(e => e.ListingId == listing.Id, ct);

            _db.ListingModerationEvents.Add(new ListingModerationEvent
            {
                ListingId = listing.Id,
                Action = action,
                Reasons = reasons?.ToList() ?? new List<ModerationReason>(),
                Note = note,
                ModeratorUserId = _currentUser.UserId,
                Round = soVongTruoc + 1,
            });
        }

        private static void ApplyApprove(Listing listing, string? note)
        {
            listing.Status = ListingStatus.Approved;
            listing.ModerationNote = note;

            // Chỉ lần duyệt ĐẦU TIÊN mới đặt PublishedAt — tin bị sửa rồi duyệt lại vẫn giữ
            // ngày lên sóng gốc, nên thứ tự "tin mới nhất" ngoài marketplace không bị xáo.
            listing.PublishedAt ??= DateTime.UtcNow;
        }

        /// <summary>Báo kết quả cho chủ tin. Trước đây lý do từ chối chỉ được echo trong
        /// response rồi vứt đi — chủ tin không bao giờ biết vì sao tin của mình bị loại.
        ///
        /// Lỗi gửi mail KHÔNG được làm hỏng quyết định đã ghi vào CSDL: quyết định là thật,
        /// email chỉ là thông báo.</summary>
        /// <summary>Báo cho chủ tin biết cần sửa gì.
        ///
        /// Viết ra TỪNG nhóm lý do thay vì một câu chung: mục đích của hành động này là để
        /// họ sửa được ngay, mà "tin của bạn cần chỉnh sửa" thì không sửa được gì cả.</summary>
        private async Task NotifyChangesRequestedAsync(
            Listing listing,
            IReadOnlyList<ModerationReason> reasons,
            string? note,
            CancellationToken ct)
        {
            try
            {
                var danhSach = string.Join("; ", reasons.Select(MoTaLyDo));
                var body = $"Cần chỉnh sửa: {danhSach}."
                         + (string.IsNullOrWhiteSpace(note) ? "" : $" Ghi chú của người duyệt: {note}.")
                         + " Sửa xong bạn gửi duyệt lại, tin không bị xoá.";

                await _notifier.SendAsync(
                    listing.Asset.UserId, $"Tin đăng cần chỉnh sửa: {listing.Title}", body, ct);
            }
            catch (Exception ex)
            {
                // Không để lỗi gửi thông báo làm hỏng thao tác kiểm duyệt đã ghi xong.
                _logger.LogWarning(ex, "Không gửi được thông báo yêu cầu chỉnh sửa cho tin {ListingId}", listing.Id);
            }
        }

        /// <summary>Mô tả lý do bằng tiếng Việt cho email. Giữ ở đây thay vì ở client vì
        /// email do máy chủ dựng.</summary>
        private static string MoTaLyDo(ModerationReason r) => r switch
        {
            ModerationReason.MissingOrBadPhotos => "ảnh thiếu hoặc không phải của bất động sản đang rao",
            ModerationReason.ThinDescription => "mô tả quá sơ sài",
            ModerationReason.PriceOrCostIssue => "giá hoặc chi phí chưa hợp lý",
            ModerationReason.AddressIssue => "địa chỉ thiếu hoặc không khớp khu vực",
            ModerationReason.MissingTerms => "thiếu điều kiện thuê (cọc, điện nước, nội quy)",
            ModerationReason.Duplicate => "trùng với tin đang có của bạn",
            ModerationReason.ProhibitedContent => "nội dung vi phạm quy định",
            _ => "lý do khác",
        };

        private async Task NotifyAsync(Listing listing, bool approved, string? reason, CancellationToken ct)
        {
            try
            {
                var title = approved
                    ? $"Tin đăng đã được duyệt: {listing.Title}"
                    : $"Tin đăng bị từ chối: {listing.Title}";

                var body = approved
                    ? "Tin của bạn đã hiển thị công khai trên KGS."
                    : $"Lý do: {reason}\n\nBạn có thể sửa lại nội dung và gửi duyệt lần nữa.";

                await _notifier.SendAsync(listing.Asset.UserId, title, body, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Không gửi được thông báo kiểm duyệt cho tin {ListingId}", listing.Id);
            }
        }
    }
}
