using System.Security.Cryptography;
using System.Text;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    /// <summary>Ghép đôi hai chiều giữa chủ tin và người đang tìm nhà.
    ///
    /// "Khớp" ở đây dùng ĐÚNG <see cref="SavedSearchService.BuildMatchQuery"/> — cùng một định
    /// nghĩa với email báo tin mới. Hai bên mà hiểu "khớp" khác nhau thì sẽ có chuyện chủ tin
    /// mời một người mà tin của mình không hề lọt vào bộ lọc của họ, và người đó nhận một lời
    /// mời vô nghĩa — đúng loại làm phiền mà tính năng này phải tránh.</summary>
    public sealed class MatchmakingService : IMatchmakingService
    {
        /// <summary>Lời mời chưa trả lời quá chừng này ngày thì coi như hết hạn: chủ tin có thể
        /// đã cho thuê, người tìm có thể đã tìm được nhà.</summary>
        public static readonly TimeSpan InvitationLifetime = TimeSpan.FromDays(14);

        /// <summary>Trần lời mời mỗi chủ tin trong 24 giờ — đủ cho người có vài tin làm việc
        /// nghiêm túc, không đủ để rải lời mời hàng loạt.</summary>
        public const int MaxInvitationsPerDay = 30;

        /// <summary>Số nhu cầu tối đa đem ra đối chiếu mỗi lần (mới bật trước). Mỗi nhu cầu là
        /// một truy vấn, nên phải có trần cứng — giống MaxPerUser của bộ lọc đã lưu.</summary>
        private const int MaxDemandsScanned = 300;

        private readonly IRepository<Listing> _listings;
        private readonly IRepository<SavedSearch> _searches;
        private readonly IRepository<ListingInvitation> _invitations;
        private readonly IRepository<ListingInquiry> _inquiries;
        private readonly IMarketplaceEngagementService _engagement;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory;
        private readonly INotificationSender _notifier;
        private readonly ILogger<MatchmakingService> _logger;

        public MatchmakingService(
            IRepository<Listing> listings,
            IRepository<SavedSearch> searches,
            IRepository<ListingInvitation> invitations,
            IRepository<ListingInquiry> inquiries,
            IMarketplaceEngagementService engagement,
            IUnitOfWork uow,
            ICurrentUserService currentUser,
            GeometryFactory geometryFactory,
            INotificationSender notifier,
            ILogger<MatchmakingService> logger)
        {
            _listings = listings; _searches = searches; _invitations = invitations;
            _inquiries = inquiries; _engagement = engagement; _uow = uow;
            _currentUser = currentUser; _geometryFactory = geometryFactory;
            _notifier = notifier; _logger = logger;
        }

        // ==================== PHÍA CHỦ TIN ====================

        public async Task<IReadOnlyList<ListingDemandCountDto>> GetDemandCountsAsync(CancellationToken ct = default)
        {
            var uid = _currentUser.UserId;
            var mine = _listings.Query().AsNoTracking().Where(l => l.Asset.UserId == uid);
            var kinds = await mine.Where(l => l.Status == ListingStatus.Approved)
                .Select(l => new { l.Type, l.Asset.Address.City })
                .Distinct()
                .ToListAsync(ct);
            if (kinds.Count == 0)
                return Array.Empty<ListingDemandCountDto>();

            var counts = new Dictionary<Guid, int>();
            foreach (var s in await LoadDemandsAsync(uid, ct))
            {
                var c = SavedSearchService.Deserialize(s.CriteriaJson);
                // Không tin nào của tôi cùng loại, cùng tỉnh với nhu cầu này thì khỏi hỏi CSDL.
                if (!kinds.Any(k => PassesPrefilter(c, k.Type, k.City))) continue;

                // Một truy vấn cho mỗi nhu cầu, trả về những tin CỦA TÔI lọt vào nhu cầu đó. Dùng
                // bản nới giá (nếu có) vì nó bao cả khớp hoàn toàn lẫn gần khớp — đúng hai nhóm
                // chủ tin thấy khi mở danh sách.
                var ids = await SavedSearchService
                    .BuildMatchQuery(mine, NearMatch.Relax(c) ?? c, _geometryFactory)
                    .Select(l => l.Id)
                    .ToListAsync(ct);
                foreach (var id in ids) counts[id] = counts.GetValueOrDefault(id) + 1;
            }
            return counts.Select(kv => new ListingDemandCountDto(kv.Key, kv.Value)).ToList();
        }

        public async Task<IReadOnlyList<AnonymousDemandDto>> GetDemandsForListingAsync(
            Guid listingId, CancellationToken ct = default)
        {
            var uid = _currentUser.UserId;
            var listing = await GetOwnedApprovedListingAsync(listingId, uid, ct);

            var invited = await _invitations.Query().AsNoTracking()
                .Where(i => i.ListingId == listingId && i.SavedSearchId != null)
                .ToDictionaryAsync(i => i.SavedSearchId!.Value, ct);

            var result = new List<AnonymousDemandDto>();
            foreach (var s in await LoadDemandsAsync(uid, ct))
            {
                var c = SavedSearchService.Deserialize(s.CriteriaJson);
                if (await ClassifyAsync(c, listing, ct) is not { } match) continue;
                invited.TryGetValue(s.Id, out var inv);
                result.Add(ToAnonymous(s, c, listing.Location, inv, match));
            }
            // Chưa mời lên trước, rồi khớp hoàn toàn trước gần khớp, rồi nhu cầu mới bật trước —
            // chủ tin nhìn vào là thấy việc cần làm.
            return result
                .OrderBy(d => d.InvitationStatus is null ? 0 : 1)
                .ThenBy(d => d.MatchKind)
                .ThenByDescending(d => d.ActiveSince)
                .ToList();
        }

        public async Task<int> CountMatchingDemandsAsync(Guid listingId, CancellationToken ct = default)
        {
            var listing = await LoadListingAsync(listingId, ownerId: null, ct);
            if (listing.Status != ListingStatus.Approved) return 0;

            var n = 0;
            foreach (var s in await LoadDemandsAsync(listing.OwnerId, ct))
                if (await ClassifyAsync(SavedSearchService.Deserialize(s.CriteriaJson), listing, ct) is not null)
                    n++;
            return n;
        }

        public async Task<AnonymousDemandDto> InviteAsync(
            Guid listingId, InviteRequest request, CancellationToken ct = default)
        {
            var uid = _currentUser.UserId;
            var listing = await GetOwnedApprovedListingAsync(listingId, uid, ct);

            var demand = await _searches.Query().AsNoTracking()
                .Where(DemandExpiry.OpenAt(DateTime.UtcNow))
                .FirstOrDefaultAsync(s => s.Id == request.DemandId, ct)
                ?? throw new NotFoundException("Nhu cầu này không còn mở cho chủ tin.");

            if (demand.UserId == uid)
                throw new ValidationFailedException("Đây là nhu cầu của chính bạn.");

            // Kiểm tra lại phía máy chủ: client có thể gửi bất kỳ mã nhu cầu nào, kể cả nhu cầu
            // mà tin này không hề khớp.
            var criteria = SavedSearchService.Deserialize(demand.CriteriaJson);
            if (await ClassifyAsync(criteria, listing, ct) is not { } match)
                throw new ValidationFailedException("Tin này không khớp nhu cầu đó nên không mời được.");

            var offerError = InvitationOffer.Validate(request.OfferPrice, request.OfferNote, listing.Price);
            if (offerError is not null) throw new ValidationFailedException(offerError);

            if (await _invitations.Query().AnyAsync(
                    i => i.ListingId == listingId && i.SavedSearchId == demand.Id, ct))
                throw new ConflictException("Bạn đã mời nhu cầu này cho tin này rồi.");

            var since = DateTime.UtcNow.AddDays(-1);
            var today = await _invitations.Query()
                .CountAsync(i => i.OwnerUserId == uid && i.CreatedAt > since, ct);
            if (today >= MaxInvitationsPerDay)
                throw new ConflictException(
                    $"Mỗi ngày chỉ gửi được tối đa {MaxInvitationsPerDay} lời mời. Hãy thử lại sau.");

            var invitation = new ListingInvitation
            {
                ListingId = listingId,
                SavedSearchId = demand.Id,
                OwnerUserId = uid,
                SeekerUserId = demand.UserId,
                Message = string.IsNullOrWhiteSpace(request.Message) ? null : request.Message.Trim(),
                OfferPrice = request.OfferPrice,
                OfferNote = string.IsNullOrWhiteSpace(request.OfferNote) ? null : request.OfferNote.Trim(),
                Status = InvitationStatus.Pending,
                // Gán tường minh: hạn mức mỗi ngày và hạn 14 ngày đều tính từ cột này, không
                // được phụ thuộc vào chuyện DbContext có tự điền CreatedAt hay không.
                CreatedAt = DateTime.UtcNow
            };
            await _invitations.AddAsync(invitation, ct);
            await _uow.SaveChangesAsync(ct);

            var loiNhan = invitation.Message is null ? "" : $" Lời nhắn của chủ nhà: \"{invitation.Message}\".";
            if (invitation.OfferPrice is not null || invitation.OfferNote is not null)
                loiNhan += " Kèm ưu đãi riêng cho bạn"
                           + (invitation.OfferPrice is { } op ? $": giá {op:#,0} đ thay vì {listing.Price:#,0} đ" : "")
                           + (invitation.OfferNote is null ? "" : $" — {invitation.OfferNote}")
                           + ".";
            await NotifyAsync(
                demand.UserId,
                $"Chủ nhà mời bạn xem nhà: {listing.Title}",
                $"Tin này khớp nhu cầu \"{demand.Name}\" bạn đang tìm.{loiNhan} " +
                "Chủ nhà chưa biết bạn là ai — thông tin liên hệ chỉ được gửi đi khi bạn nhận lời.",
                "/nhu-cau", "Xem lời mời", ct);

            return ToAnonymous(demand, criteria, listing.Location, invitation, match);
        }

        // ==================== PHÍA NGƯỜI TÌM ====================

        public async Task<IReadOnlyList<SeekerInvitationDto>> GetMyInvitationsAsync(CancellationToken ct = default)
            => await ProjectSeeker(_invitations.Query().AsNoTracking()
                    .Where(i => i.SeekerUserId == _currentUser.UserId)
                    .OrderByDescending(i => i.CreatedAt))
                .ToListAsync(ct);

        public async Task<SeekerInvitationDto> RespondAsync(
            Guid invitationId, RespondInvitationRequest request, CancellationToken ct = default)
        {
            var uid = _currentUser.UserId;
            var inv = await _invitations.Query()
                .Include(i => i.Listing)
                .FirstOrDefaultAsync(i => i.Id == invitationId && i.SeekerUserId == uid, ct)
                ?? throw new NotFoundException("Không tìm thấy lời mời.");

            if (inv.Status != InvitationStatus.Pending)
                throw new ConflictException("Bạn đã trả lời lời mời này rồi.");
            if (IsExpired(inv.CreatedAt))
                throw new ConflictException("Lời mời đã hết hạn.");

            if (request.Accept)
            {
                if (inv.Listing.Status != ListingStatus.Approved || inv.Listing.Slug is null)
                    throw new ConflictException("Tin này không còn hiển thị — chủ nhà có thể đã cho thuê.");

                // Nhận lời = gửi một yêu cầu xem nhà bình thường. Nhờ vậy chủ tin nhận nó ở
                // đúng hộp thư quen thuộc, kèm liên hệ của người tìm, và luồng hẹn xem nhà chạy
                // tiếp mà không cần đường riêng.
                var message = "Nhận lời mời xem nhà của bạn."
                              + (string.IsNullOrWhiteSpace(request.Message) ? "" : " " + request.Message.Trim());
                Guid inquiryId;
                try
                {
                    var created = await _engagement.CreateInquiryAsync(
                        inv.Listing.Slug, new CreateInquiryRequest(message, request.PreferredViewingAt), ct);
                    inquiryId = created.Id;
                }
                catch (ConflictException)
                {
                    // Người tìm đã tự gửi yêu cầu cho tin này từ trước và chủ tin chưa xử lý
                    // xong: gắn lời mời vào chính yêu cầu đó thay vì báo lỗi.
                    inquiryId = await _inquiries.Query()
                        .Where(i => i.ListingId == inv.ListingId && i.FromUserId == uid
                                    && (i.Status == InquiryStatus.New
                                        || i.Status == InquiryStatus.Contacted
                                        || i.Status == InquiryStatus.Viewed))
                        .Select(i => i.Id)
                        .FirstAsync(ct);
                }
                inv.Status = InvitationStatus.Accepted;
                inv.InquiryId = inquiryId;

                // Ghi cứng ưu đãi vào yêu cầu xem nhà: cả hai bên cùng thấy đúng con số đã hứa
                // trong hộp thư, kể cả khi tin đổi giá sau đó.
                if (inv.OfferPrice is not null || inv.OfferNote is not null)
                {
                    var inquiry = await _inquiries.Query().FirstAsync(i => i.Id == inquiryId, ct);
                    if (inquiry.OfferPrice is null && inquiry.OfferNote is null)
                    {
                        inquiry.OfferPrice = inv.OfferPrice;
                        inquiry.OfferNote = inv.OfferNote;
                    }
                }
            }
            else
            {
                inv.Status = InvitationStatus.Declined;
            }

            inv.RespondedAt = DateTime.UtcNow;
            await _uow.SaveChangesAsync(ct);

            return await ProjectSeeker(_invitations.Query().AsNoTracking().Where(i => i.Id == inv.Id))
                .FirstAsync(ct);
        }

        // ==================== Nội bộ ====================

        private Task<List<SavedSearch>> LoadDemandsAsync(string ownerId, CancellationToken ct)
            => _searches.Query().AsNoTracking()
                .Where(DemandExpiry.OpenAt(DateTime.UtcNow))
                .Where(s => s.UserId != ownerId)
                .OrderByDescending(s => s.DiscoverableSince)
                .Take(MaxDemandsScanned)
                .ToListAsync(ct);

        private Task<bool> MatchesAsync(PublicListingSearchQuery c, Guid listingId, CancellationToken ct)
            => SavedSearchService
                .BuildMatchQuery(_listings.Query().AsNoTracking().Where(l => l.Id == listingId), c, _geometryFactory)
                .AnyAsync(ct);

        /// <summary>Lọc sơ TRONG BỘ NHỚ trước khi hỏi CSDL: nhu cầu ghi loại tin hay tỉnh/thành
        /// khác với tin thì chắc chắn không khớp. Phần lớn nhu cầu rơi ở đây, nên số truy vấn
        /// so khớp giảm theo số khu vực chứ không theo tổng số nhu cầu.</summary>
        public static bool PassesPrefilter(PublicListingSearchQuery c, ListingType listingType, string listingCity)
            => (c.Type is null || c.Type == listingType)
               && (string.IsNullOrWhiteSpace(c.City)
                   || AdministrativeNames.CanonicalCity(c.City) == AdministrativeNames.CanonicalCity(listingCity));

        /// <summary>Nhu cầu khớp tin này thế nào: hoàn toàn, gần khớp theo giá (kèm % vượt ngân
        /// sách), hay không khớp (null). Tối đa hai truy vấn, chỉ sau khi đã qua lọc sơ.</summary>
        private async Task<(DemandMatchKind Kind, int? OverBudgetPercent)?> ClassifyAsync(
            PublicListingSearchQuery c, ListingInfo l, CancellationToken ct)
        {
            if (!PassesPrefilter(c, l.Type, l.City)) return null;
            if (await MatchesAsync(c, l.Id, ct)) return (DemandMatchKind.Exact, null);
            if (NearMatch.Relax(c) is not { } relaxed || !await MatchesAsync(relaxed, l.Id, ct)) return null;

            var over = Math.Max(
                c.PriceMax is { } pm ? NearMatch.OverBudgetPercent(l.Price, pm) : 0,
                c.TotalCostMax is { } tm ? NearMatch.OverBudgetPercent(l.MonthlyCost, tm) : 0);
            return (DemandMatchKind.NearPrice, over);
        }

        private sealed record ListingInfo(
            Guid Id, string OwnerId, string Title, ListingStatus Status, Point? Location,
            ListingType Type, string City, decimal Price, decimal MonthlyCost);

        /// <summary><paramref name="ownerId"/> null = không kiểm chủ sở hữu (tác vụ nền).</summary>
        private async Task<ListingInfo> LoadListingAsync(Guid listingId, string? ownerId, CancellationToken ct)
        {
            var l = await _listings.Query().AsNoTracking()
                .Where(x => x.Id == listingId && (ownerId == null || x.Asset.UserId == ownerId))
                .Select(x => new
                {
                    x.Id, x.Asset.UserId, x.Title, x.Status, x.Asset.Location, x.Type, x.Asset.Address.City,
                    x.Price, x.Terms.ServiceFee, x.Terms.ParkingFee, x.Terms.InternetFee,
                })
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");
            return new ListingInfo(l.Id, l.UserId, l.Title, l.Status, l.Location, l.Type, l.City, l.Price,
                l.Price + (l.ServiceFee ?? 0) + (l.ParkingFee ?? 0) + (l.InternetFee ?? 0));
        }

        private async Task<ListingInfo> GetOwnedApprovedListingAsync(Guid listingId, string uid, CancellationToken ct)
        {
            var l = await LoadListingAsync(listingId, uid, ct);
            if (l.Status != ListingStatus.Approved)
                throw new ValidationFailedException("Chỉ tin đang hiển thị mới mời được người xem.");
            return l;
        }

        private static bool IsExpired(DateTime createdAt)
            => DateTime.UtcNow - createdAt > InvitationLifetime;

        private static AnonymousDemandDto ToAnonymous(
            SavedSearch s, PublicListingSearchQuery c, Point? listingLocation, ListingInvitation? inv,
            (DemandMatchKind Kind, int? OverBudgetPercent) match)
        {

            double? distance = null;
            if (c.Latitude is not null && c.Longitude is not null && listingLocation is not null)
                distance = Haversine(c.Latitude.Value, c.Longitude.Value, listingLocation.Y, listingLocation.X);

            // Bỏ toạ độ trước khi trả cho chủ tin — điểm ghim thường là chỗ làm hay nhà người
            // thân. Bán kính thì giữ: nó nói người này chịu đi xa tới đâu, không nói họ ở đâu.
            var safe = c with { Latitude = null, Longitude = null, Within = null };

            return new AnonymousDemandDto(
                s.Id, Alias(s.Id), safe, distance is null ? null : DistanceBand(distance.Value),
                s.DemandNote, s.DiscoverableSince ?? s.CreatedAt,
                inv?.Status, inv?.CreatedAt,
                inv is { Status: InvitationStatus.Pending } && IsExpired(inv.CreatedAt),
                match.Kind, match.OverBudgetPercent,
                c.Occupants, c.AvailableBy, c.PetsAllowed,
                inv?.OfferPrice, inv?.OfferNote);
        }

        /// <summary>Khoảng cách THÔ: chỉ trả về cận trên của một trong vài dải (1 / 2 / 5 / 10 km).
        ///
        /// Không trả khoảng cách chính xác, kể cả đã làm tròn 100 m: một chủ tin có vài tin ở
        /// các vị trí khác nhau, nhìn cùng một nhu cầu từ ba tin là đo tam giác ra được điểm
        /// người tìm ghim — thường chính là chỗ làm của họ. Dải thô đủ để chủ tin biết "người
        /// này tìm quanh đây", không đủ để định vị.</summary>
        private static double DistanceBand(double meters)
            => meters < 1000 ? 1000 : meters < 2000 ? 2000 : meters < 5000 ? 5000 : 10000;

        /// <summary>Bí danh ổn định cho một nhu cầu. Băm mã nhu cầu chứ không dùng thẳng mã:
        /// bí danh chỉ để nhìn phân biệt, không nên là thứ đoán ngược được.</summary>
        private static string Alias(Guid id)
        {
            var h = SHA256.HashData(Encoding.UTF8.GetBytes(id.ToString()));
            return $"Người tìm #{Convert.ToHexString(h, 0, 2)}";
        }

        private static double Haversine(double lat1, double lng1, double lat2, double lng2)
        {
            const double R = 6_371_008.8;
            double rad(double d) => d * Math.PI / 180;
            var dLat = rad(lat2 - lat1);
            var dLng = rad(lng2 - lng1);
            var h = Math.Pow(Math.Sin(dLat / 2), 2)
                    + Math.Cos(rad(lat1)) * Math.Cos(rad(lat2)) * Math.Pow(Math.Sin(dLng / 2), 2);
            return 2 * R * Math.Asin(Math.Min(1, Math.Sqrt(h)));
        }

        private static IQueryable<SeekerInvitationDto> ProjectSeeker(IQueryable<ListingInvitation> q)
        {
            var cutoff = DateTime.UtcNow - InvitationLifetime;
            return q.Select(i => new SeekerInvitationDto(
                i.Id, i.ListingId, i.Listing.Slug!, i.Listing.Title,
                i.Listing.Images.OrderBy(x => x.SortOrder).Select(x => x.File.Url).FirstOrDefault(),
                i.Listing.Price, i.Listing.Type, i.Listing.RentPaymentCycle,
                i.Listing.Asset.Address.City, i.Listing.Asset.Address.District,
                i.Listing.Asset.User.Name,
                i.Message,
                i.SavedSearch != null ? i.SavedSearch.Name : null,
                i.Status,
                i.Status == InvitationStatus.Pending && i.CreatedAt < cutoff,
                i.CreatedAt, i.RespondedAt,
                i.OfferPrice, i.OfferNote));
        }

        private async Task NotifyAsync(
            string userId, string title, string body, string link, string label, CancellationToken ct)
        {
            try
            {
                await _notifier.SendAsync(userId, title, body, link, label, ct);
            }
            catch (Exception ex)
            {
                // Không gửi được email không được phép làm hỏng lời mời đã lưu.
                _logger.LogWarning(ex, "Không gửi được thông báo lời mời tới {UserId}", userId);
            }
        }
    }
}
