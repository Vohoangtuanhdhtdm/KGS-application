using System.Text.Json;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using static kgs_api.Common.Common;

namespace kgs_api.Services
{
    public sealed class SavedSearchService : ISavedSearchService
    {
        /// <summary>Một người giữ chừng này bộ lọc là quá đủ dùng; đặt trần để một tài khoản
        /// không tự biến mình thành tải cho job đối chiếu.</summary>
        private const int MaxPerUser = 20;

        private readonly IRepository<SavedSearch> _searches;
        private readonly IRepository<Listing> _listings;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory;

        public SavedSearchService(
            IRepository<SavedSearch> searches,
            IRepository<Listing> listings,
            IUnitOfWork uow,
            ICurrentUserService currentUser,
            GeometryFactory geometryFactory)
        {
            _searches = searches; _listings = listings; _uow = uow;
            _currentUser = currentUser; _geometryFactory = geometryFactory;
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

            var entity = new SavedSearch
            {
                UserId = userId,
                Name = request.Name.Trim(),
                CriteriaJson = JsonSerializer.Serialize(criteria),
                NotifyEnabled = request.NotifyEnabled,
                // "Tin mới" tính từ lúc lưu — những tin đã có sẵn thì người dùng vừa xem xong.
                LastCheckedAt = DateTime.UtcNow
            };

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

        private async Task<SavedSearchDto> ToDtoAsync(SavedSearch s, CancellationToken ct)
        {
            var criteria = Deserialize(s.CriteriaJson);

            var newCount = await BuildMatchQuery(_listings.Query().AsNoTracking(), criteria, _geometryFactory)
                .Where(l => (l.PublishedAt ?? l.CreatedAt) > s.LastCheckedAt)
                .CountAsync(ct);

            return new SavedSearchDto(
                s.Id, s.Name, criteria, s.NotifyEnabled, s.CreatedAt, s.LastNotifiedAt, newCount);
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
            City = string.IsNullOrWhiteSpace(c.City) ? null : c.City.Trim(),
            District = string.IsNullOrWhiteSpace(c.District) ? null : c.District.Trim(),
            Keyword = string.IsNullOrWhiteSpace(c.Keyword) ? null : c.Keyword.Trim(),
            Amenities = ListingSearchFilter.NormalizeAmenities(c.Amenities),
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
