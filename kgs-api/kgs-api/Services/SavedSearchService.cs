using System.Text.Json;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    public sealed class SavedSearchService : ISavedSearchService
    {
        /// <summary>Một người giữ chừng này bộ lọc là quá đủ dùng; đặt trần để một tài khoản
        /// không tự biến mình thành tải cho job đối chiếu.</summary>
        private const int MaxPerUser = 20;

        private readonly IRepository<SavedSearch> _searches;
        private readonly IRepository<Listing> _listings;
        private readonly IRepository<DemandOpening> _openings;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory;
        private readonly UserManager<ApplicationUser> _users;

        public SavedSearchService(
            IRepository<SavedSearch> searches,
            IRepository<Listing> listings,
            IRepository<DemandOpening> openings,
            IUnitOfWork uow,
            ICurrentUserService currentUser,
            GeometryFactory geometryFactory,
            UserManager<ApplicationUser> users)
        {
            _searches = searches; _listings = listings; _openings = openings; _uow = uow;
            _currentUser = currentUser; _geometryFactory = geometryFactory; _users = users;
        }

        public async Task<IReadOnlyList<SavedSearchDto>> GetMineAsync(CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            var rows = await _searches.Query().AsNoTracking()
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync(ct);

            // Đếm tin mới cho từng bộ lọc bằng một truy vấn riêng. Không gộp được thành một
            // câu vì mỗi bộ lọc là một mệnh đề WHERE khác nhau — nhưng số bộ lọc bị chặn ở
            // MaxPerUser nên số truy vấn có trần cứng, không phình theo dữ liệu.
            var result = new List<SavedSearchDto>(rows.Count);
            foreach (var s in rows)
                result.Add(await ToDtoAsync(s, ct));

            return result;
        }

        public async Task<SavedSearchDto> CreateAsync(CreateSavedSearchRequest request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            var count = await _searches.Query().CountAsync(s => s.UserId == userId, ct);
            if (count >= MaxPerUser)
                throw new InvalidOperationException(
                    $"Bạn đã lưu tối đa {MaxPerUser} bộ lọc. Xoá bớt một bộ trước khi lưu thêm.");

            // Chuẩn hoá trước khi cất: bỏ sắp xếp và phân trang (là cách XEM kết quả, không
            // phải điều kiện khớp), lọc bỏ khoá tiện nghi lạ. Cất nguyên xi thứ client gửi
            // lên thì hai bộ lọc giống hệt nhau về nội dung lại khác nhau về JSON chỉ vì
            // người dùng đang đứng ở trang 2.
            var criteria = Sanitize(request.Criteria);

            var now = DateTime.UtcNow;
            var entity = new SavedSearch
            {
                UserId = userId,
                Name = request.Name.Trim(),
                CriteriaJson = JsonSerializer.Serialize(criteria),
                NotifyEnabled = request.NotifyEnabled,
                // "Tin mới" tính từ lúc lưu — những tin đã có sẵn thì người dùng vừa xem xong.
                LastCheckedAt = now,
                DemandNote = string.IsNullOrWhiteSpace(request.DemandNote) ? null : request.DemandNote.Trim(),
            };
            // "Đăng nhu cầu" = lưu bộ lọc và mở cho chủ nhà trong cùng một lần gọi, để người
            // tìm không phải đi qua hai bước mới bật được.
            if (request.Discoverable)
            {
                RequireArea(criteria);
                Open(entity, now);
                await ScreenAsync(entity, ct, opening: true);
            }

            await _searches.AddAsync(entity, ct);
            await _uow.SaveChangesAsync(ct);

            return await ToDtoAsync(entity, ct);
        }

        public async Task<SavedSearchDto> SetNotifyAsync(Guid id, bool enabled, CancellationToken ct = default)
        {
            var entity = await GetOwnedAsync(id, ct);
            entity.NotifyEnabled = enabled;
            await _uow.SaveChangesAsync(ct);
            return await ToDtoAsync(entity, ct);
        }

        public async Task<SavedSearchDto> SetDiscoverableAsync(
            Guid id, SetDiscoverableRequest request, CancellationToken ct = default)
        {
            var entity = await GetOwnedAsync(id, ct);
            var oldNote = entity.DemandNote;
            entity.DemandNote = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
            if (request.Enabled)
            {
                RequireArea(Deserialize(entity.CriteriaJson));
                var reopening = !entity.DiscoverableByOwners;
                Open(entity, DateTime.UtcNow);
                // Bật lại, gửi lại sau khi bị từ chối, hoặc lời nhắn đổi nội dung: kiểm tra lại — nhu
                // cầu đã duyệt mà bị sửa thêm số điện thoại phải quay về chờ duyệt.
                if (reopening || entity.DemandReview == DemandReviewStatus.Rejected
                    || DemandScreening.NeedsRescreen(oldNote, entity.DemandNote))
                    await ScreenAsync(entity, ct, reopening);
            }
            else
            {
                entity.DiscoverableByOwners = false;
                // Tự tắt khác hết hạn: xoá hạn để giao diện không ghi "Đã hết hạn".
                entity.DiscoverableUntil = null;
            }
            await _uow.SaveChangesAsync(ct);
            return await ToDtoAsync(entity, ct);
        }

        public async Task<SavedSearchDto> RenewAsync(Guid id, CancellationToken ct = default)
        {
            var entity = await GetOwnedAsync(id, ct);
            RequireArea(Deserialize(entity.CriteriaJson));
            var reopening = !entity.DiscoverableByOwners;
            Open(entity, DateTime.UtcNow);
            // Gia hạn giữ nguyên kết quả duyệt; chỉ nhu cầu bị từ chối hoặc đang tắt mới kiểm tra lại.
            if (reopening || entity.DemandReview == DemandReviewStatus.Rejected)
                await ScreenAsync(entity, ct, reopening);
            await _uow.SaveChangesAsync(ct);
            return await ToDtoAsync(entity, ct);
        }

        public async Task MarkSeenAsync(Guid id, CancellationToken ct = default)
        {
            var entity = await GetOwnedAsync(id, ct);
            entity.LastCheckedAt = DateTime.UtcNow;
            await _uow.SaveChangesAsync(ct);
        }

        public async Task DeleteAsync(Guid id, CancellationToken ct = default)
        {
            var entity = await GetOwnedAsync(id, ct);
            _searches.Remove(entity);
            await _uow.SaveChangesAsync(ct);
        }

        // ==================== Nội bộ ====================

        private async Task<SavedSearch> GetOwnedAsync(Guid id, CancellationToken ct)
        {
            var userId = _currentUser.UserId;
            var entity = await _searches.Query().FirstOrDefaultAsync(s => s.Id == id, ct)
                ?? throw new KeyNotFoundException("Không tìm thấy bộ lọc đã lưu.");

            // Trả 404 chứ không phải 403: bộ lọc của người khác thì với người này nó không
            // tồn tại, và câu trả lời "có tồn tại nhưng bạn không được xem" tự nó đã là rò rỉ.
            if (entity.UserId != userId)
                throw new KeyNotFoundException("Không tìm thấy bộ lọc đã lưu.");

            return entity;
        }

        /// <summary>Chạy bộ lọc tự động (DemandScreening): sạch thì duyệt ngay, có dấu hiệu thì chờ
        /// quản trị. Đếm "mở trong 24 giờ" trên các nhu cầu KHÁC của cùng người, kể cả nhu cầu đã
        /// xoá (bảng DemandOpening). <paramref name="opening"/>: lần này là đăng mới hoặc bật lại.</summary>
        private async Task ScreenAsync(SavedSearch s, CancellationToken ct, bool opening = false)
        {
            var user = await _users.FindByIdAsync(s.UserId);
            var now = DateTime.UtcNow;
            var since = now.AddHours(-24);
            var opened = await _openings.Query()
                .Where(x => x.UserId == s.UserId && x.SavedSearchId != s.Id && x.OpenedAt >= since)
                .Select(x => x.SavedSearchId).Distinct().CountAsync(ct);
            if (opening)
                await _openings.AddAsync(new DemandOpening { UserId = s.UserId, SavedSearchId = s.Id, OpenedAt = now }, ct);
            var (status, reason) = DemandScreening.Decide(
                DemandScreening.Screen(s.Name, s.DemandNote, user?.EmailConfirmed ?? false, opened),
                s.DemandReview);
            s.DemandReview = status;
            s.DemandReviewReason = reason;
            s.DemandReviewedAt = null;
        }

        private static void RequireArea(PublicListingSearchQuery c)
        {
            if (!DemandExpiry.HasArea(c))
                throw new ValidationFailedException(
                    "Hãy chọn tỉnh/thành bạn muốn tìm — chủ nhà ở đúng khu vực đó mới mời được bạn.");
        }

        /// <summary>Bật (hoặc gia hạn) chế độ mở: hạn mới tính từ bây giờ, và được nhắc lại
        /// một lần trước khi hết hạn mới này.</summary>
        private static void Open(SavedSearch s, DateTime now)
        {
            if (!s.DiscoverableByOwners) s.DiscoverableSince = now;
            s.DiscoverableByOwners = true;
            s.DiscoverableUntil = DemandExpiry.UntilFrom(now);
            s.ExpiryRemindedAt = null;
        }

        private async Task<SavedSearchDto> ToDtoAsync(SavedSearch s, CancellationToken ct)
        {
            var criteria = Deserialize(s.CriteriaJson);
            var matches = BuildMatchQuery(_listings.Query().AsNoTracking(), criteria, _geometryFactory);

            var newCount = await matches
                .Where(l => (l.PublishedAt ?? l.CreatedAt) > s.LastCheckedAt)
                .CountAsync(ct);
            // "Đang khớp N căn của M chủ nhà": cho người tìm thấy nhu cầu của mình có đất để
            // chủ nhà mời — hoặc biết nên nới điều kiện.
            var listings = await matches.CountAsync(ct);
            var owners = listings == 0 ? 0 : await matches.Select(l => l.Asset.UserId).Distinct().CountAsync(ct);

            return new SavedSearchDto(
                s.Id, s.Name, criteria, s.NotifyEnabled, s.CreatedAt, s.LastNotifiedAt, newCount,
                s.DiscoverableByOwners, s.DemandNote, s.DiscoverableUntil, listings, owners,
                s.DemandReview, s.DemandReviewReason);
        }

        /// <summary>Dựng truy vấn "tin khớp bộ lọc này". Dùng chung với job đối chiếu để hai
        /// bên không thể hiểu khác nhau về chữ "khớp".</summary>
        public static IQueryable<Listing> BuildMatchQuery(
            IQueryable<Listing> source, PublicListingSearchQuery criteria, GeometryFactory factory)
        {
            Point? origin = null;
            if (ListingSearchFilter.HasGeoSearch(criteria))
                origin = factory.CreatePoint(
                    new Coordinate(criteria.Longitude!.Value, criteria.Latitude!.Value));

            return ListingSearchFilter.Apply(source, criteria, origin);
        }

        private static PublicListingSearchQuery Sanitize(PublicListingSearchQuery c) => c with
        {
            City = string.IsNullOrWhiteSpace(c.City) ? null : AdministrativeNames.CanonicalCity(c.City),
            District = string.IsNullOrWhiteSpace(c.District) ? null
                : AdministrativeNames.CanonicalDistrict(AdministrativeNames.CanonicalCity(c.City), c.District),
            Keyword = string.IsNullOrWhiteSpace(c.Keyword) ? null : c.Keyword.Trim(),
            Amenities = ListingSearchFilter.NormalizeAmenities(c.Amenities),
            // Vùng Isochrone không được lưu: điều khoản Mapbox chỉ cho hiển thị nó trên bản đồ,
            // không cho cất giữ để dùng lại (job gửi thông báo sẽ dùng nó khi không có bản đồ
            // nào). Bộ lọc lưu lại giữ vòng tròn bao ngoài vùng — rộng hơn một chút, không hẹp hơn.
            Within = null,
            PropertyTypes = c.PropertyTypes is { Count: > 0 } ? c.PropertyTypes.Distinct().Order().ToList() : null,
            Directions = PropertyVocabulary.NormalizeFilter(
                c.Directions, PropertyVocabulary.NormalizeDirection, PropertyVocabulary.Directions),
            LegalStatuses = PropertyVocabulary.NormalizeFilter(
                c.LegalStatuses, PropertyVocabulary.NormalizeLegal, PropertyVocabulary.LegalStatuses),
            FurnitureStates = PropertyVocabulary.NormalizeFilter(
                c.FurnitureStates, PropertyVocabulary.NormalizeFurniture, PropertyVocabulary.FurnitureStates),
            SortBy = null,
            Page = 1,
            PageSize = 20
        };

        public static PublicListingSearchQuery Deserialize(string json)
        {
            try
            {
                return JsonSerializer.Deserialize<PublicListingSearchQuery>(json) ?? Empty();
            }
            catch (JsonException)
            {
                // Một bộ lọc hỏng không được phép làm sập cả danh sách lẫn cả job. Lùi về bộ
                // lọc rỗng: người dùng thấy nó vô dụng rồi xoá đi, vẫn hơn là màn hình lỗi.
                return Empty();
            }
        }

        private static PublicListingSearchQuery Empty() => new(
            Type: null, City: null, District: null, PriceMin: null, PriceMax: null,
            BedroomsMin: null, Keyword: null, Latitude: null, Longitude: null,
            RadiusMeters: null, TotalCostMax: null, PetsAllowed: null, CurfewFree: null,
            SharedWithOwner: null, AvailableBy: null, Amenities: null, SortBy: null);
    }
}
