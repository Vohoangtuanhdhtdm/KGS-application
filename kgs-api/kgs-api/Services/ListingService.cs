using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using System.Text;
using System.Text.RegularExpressions;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    /// <summary>Quản lý tin đăng công khai.
    ///
    /// Sau khi gộp Property vào Asset, service này KHÔNG còn sao chép thuộc tính vật lý
    /// sang tin đăng. Mọi truy vấn đọc qua navigation Listing.Asset, nên sửa địa chỉ hay
    /// diện tích ở màn hình tài sản là tin đăng đổi theo ngay — trước đây hai bên lệch
    /// nhau âm thầm kể từ lúc đăng.</summary>
    public sealed class ListingService : IListingService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<AssetUnit> _units;
        private readonly IRepository<Listing> _listings;
        private readonly IRepository<AssetMedia> _media;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory;

        public ListingService(
            IRepository<Asset> assets,
            IRepository<AssetUnit> units,
            IRepository<Listing> listings,
            IRepository<AssetMedia> media,
            IUnitOfWork uow,
            ICurrentUserService currentUser,
            GeometryFactory geometryFactory)
        {
            _assets = assets; _units = units; _listings = listings; _media = media;
            _uow = uow; _currentUser = currentUser; _geometryFactory = geometryFactory;
        }

        // ==================== ĐĂNG TIN ====================

        public async Task<OwnerListingDto> CreateAsync(Guid assetId, CreateListingRequest request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            var asset = await _assets.Query().AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == assetId && a.UserId == userId, ct)
                ?? throw new NotFoundException("Không tìm thấy tài sản.");

            if (request.Type == ListingType.Rent && request.RentPaymentCycle is null)
                throw new ValidationFailedException("Tin cho thuê bắt buộc phải chọn chu kỳ thanh toán.");

            // Đăng tin theo phòng: phòng phải thuộc đúng tài sản này.
            if (request.AssetUnitId is not null)
            {
                var unitExists = await _units.Query()
                    .AnyAsync(u => u.Id == request.AssetUnitId && u.AssetId == assetId, ct);
                if (!unitExists)
                    throw new NotFoundException("Không tìm thấy tầng/phòng thuộc tài sản này.");
            }

            // Một chỗ chỉ có một tin đang sống. Kiểm ở đây để trả lỗi nghiệp vụ rõ ràng
            // thay vì để partial unique index UX_Listings_OneLivePerSlot ném lỗi DB.
            var hasLive = await _listings.Query().AnyAsync(l =>
                l.AssetId == assetId
                && l.AssetUnitId == request.AssetUnitId
                && (l.Status == ListingStatus.Pending || l.Status == ListingStatus.Approved), ct);
            if (hasLive)
                throw new ConflictException(request.AssetUnitId is null
                    ? "Tài sản này đã có tin đăng đang hiển thị — hãy sửa tin hiện có thay vì tạo mới."
                    : "Phòng này đã có tin đăng đang hiển thị — hãy sửa tin hiện có thay vì tạo mới.");

            var selectedMedia = await _media.Query().AsNoTracking()
                .Where(m => m.AssetId == assetId && request.SelectedAssetMediaIds.Contains(m.Id))
                .ToListAsync(ct);

            if (selectedMedia.Count == 0)
                throw new ValidationFailedException("Cần chọn ít nhất 1 ảnh để đăng tin công khai.");

            var listing = new Listing
            {
                AssetId = assetId,
                AssetUnitId = request.AssetUnitId,
                Title = request.Title.Trim(),
                Description = request.Description,
                Price = request.Price,
                Type = request.Type,
                RentPaymentCycle = request.Type == ListingType.Rent ? request.RentPaymentCycle : null,
                Status = ListingStatus.Pending,
                Slug = await GenerateUniqueSlugAsync(request.Title, ct),
                ViewCount = 0,
                Images = selectedMedia.Select((m, i) => new ListingImage
                {
                    File = new StoredFile
                    {
                        Url = m.File.Url,
                        PublicId = m.File.PublicId,
                        FileName = m.File.FileName,
                        ContentType = m.File.ContentType,
                        SizeBytes = m.File.SizeBytes
                    },
                    SortOrder = i
                }).ToList()
            };

            await _listings.AddAsync(listing, ct);

            // MỘT SaveChanges duy nhất. Trước đây phải gọi hai lần vì Property có khoá int
            // identity và Asset.LinkedPropertyId cần Id thật; nay quan hệ đã đảo chiều nên
            // không còn ràng buộc đó — cũng không còn cửa sổ tạo ra tin đăng mồ côi.
            await _uow.SaveChangesAsync(ct);

            return await GetOwnedDtoAsync(listing.Id, ct);
        }

        public async Task<OwnerListingDto> UpdateAsync(Guid listingId, UpdateListingRequest request, CancellationToken ct = default)
        {
            var listing = await GetOwnedListingAsync(listingId, ct);

            if (listing.Status == ListingStatus.Closed)
                throw new ConflictException("Tin đã đóng — không sửa được. Hãy đăng tin mới.");

            if (listing.Type == ListingType.Rent && request.RentPaymentCycle is null)
                throw new ValidationFailedException("Tin cho thuê bắt buộc phải chọn chu kỳ thanh toán.");

            listing.Title = request.Title.Trim();
            listing.Description = request.Description;
            listing.Price = request.Price;
            listing.RentPaymentCycle = listing.Type == ListingType.Rent ? request.RentPaymentCycle : null;

            // Sửa nội dung thì phải duyệt lại — nếu không, người đăng có thể được duyệt một
            // nội dung sạch rồi thay bằng nội dung khác.
            if (listing.Status == ListingStatus.Approved)
            {
                listing.Status = ListingStatus.Pending;
                listing.ModerationNote = "Tin đã được sửa sau khi duyệt — cần duyệt lại.";
            }

            await _uow.SaveChangesAsync(ct);
            return await GetOwnedDtoAsync(listingId, ct);
        }

        public async Task CloseAsync(Guid listingId, CancellationToken ct = default)
        {
            var listing = await GetOwnedListingAsync(listingId, ct);

            if (listing.Status == ListingStatus.Closed)
                return;   // idempotent

            listing.Status = ListingStatus.Closed;
            await _uow.SaveChangesAsync(ct);
        }

        // ==================== ĐỌC — CHỦ TIN ====================

        public async Task<IReadOnlyList<OwnerListingDto>> GetMyListingsAsync(CancellationToken ct = default)
            => await ProjectOwner(_listings.Query().AsNoTracking()
                    .Where(l => l.Asset.UserId == _currentUser.UserId)
                    .OrderByDescending(l => l.CreatedAt))
                .ToListAsync(ct);

        public async Task<IReadOnlyList<OwnerListingDto>> GetByAssetAsync(Guid assetId, CancellationToken ct = default)
            => await ProjectOwner(_listings.Query().AsNoTracking()
                    .Where(l => l.AssetId == assetId && l.Asset.UserId == _currentUser.UserId)
                    .OrderByDescending(l => l.CreatedAt))
                .ToListAsync(ct);

        // ==================== ĐỌC — CÔNG KHAI ====================

        public async Task<PagedResult<PublicListingSummaryDto>> SearchPublicAsync(PublicListingSearchQuery query, CancellationToken ct = default)
        {
            var q = _listings.Query().AsNoTracking()
                .Where(l => l.Status == ListingStatus.Approved);

            if (query.Type is not null) q = q.Where(l => l.Type == query.Type);
            if (!string.IsNullOrWhiteSpace(query.City)) q = q.Where(l => l.Asset.Address.City == query.City);
            if (!string.IsNullOrWhiteSpace(query.District)) q = q.Where(l => l.Asset.Address.District == query.District);
            if (query.PriceMin is not null) q = q.Where(l => l.Price >= query.PriceMin);
            if (query.PriceMax is not null) q = q.Where(l => l.Price <= query.PriceMax);
            if (query.BedroomsMin is not null) q = q.Where(l => l.Asset.Bedrooms >= query.BedroomsMin);

            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var kw = $"%{query.Keyword.Trim()}%";
                q = q.Where(l => EF.Functions.ILike(l.Title, kw)
                              || EF.Functions.ILike(l.Description, kw)
                              || EF.Functions.ILike(l.Asset.Address.Detail, kw));
            }

            // Toạ độ nay đọc từ Asset.Location — GiST index đã có sẵn trên bảng Assets.
            Point? origin = null;
            var hasGeoSearch = query.Latitude is not null && query.Longitude is not null && query.RadiusMeters is not null;
            if (hasGeoSearch)
            {
                origin = _geometryFactory.CreatePoint(new Coordinate(query.Longitude!.Value, query.Latitude!.Value));
                q = q.Where(l => l.Asset.Location != null
                              && EF.Functions.IsWithinDistance(l.Asset.Location, origin, query.RadiusMeters!.Value, true));
            }

            var total = await q.CountAsync(ct);
            var pageSize = Math.Clamp(query.PageSize, 1, 50);
            var page = Math.Max(query.Page, 1);

            var ordered = hasGeoSearch
                ? q.OrderBy(l => l.Asset.Location!.Distance(origin))
                : q.OrderByDescending(l => l.PublishedAt ?? l.CreatedAt);

            // Giữ nguyên Point trong projection, tách Y/X sau khi materialize —
            // ST_Y(geography) không tồn tại nên không tách được trong biểu thức SQL.
            var rows = await ordered
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(l => new
                {
                    l.Id,
                    l.Slug,
                    l.Title,
                    l.Type,
                    l.Price,
                    l.RentPaymentCycle,
                    l.Asset.Address.City,
                    l.Asset.Address.District,
                    l.Asset.Bedrooms,
                    l.Asset.Bathrooms,
                    Area = l.AssetUnit != null ? l.AssetUnit.Area : l.Asset.Area,
                    UnitName = l.AssetUnit != null ? l.AssetUnit.Name : null,
                    ThumbnailUrl = l.Images.OrderBy(i => i.SortOrder).Select(i => i.File.Url).FirstOrDefault(),
                    l.Asset.Location,
                    DistanceMeters = hasGeoSearch ? (double?)l.Asset.Location!.Distance(origin!) : null,
                    l.PublishedAt
                })
                .ToListAsync(ct);

            var items = rows.Select(r => new PublicListingSummaryDto(
                r.Id, r.Slug!, r.Title, r.Type, r.Price, r.RentPaymentCycle,
                r.City, r.District, r.Bedrooms, r.Bathrooms, r.Area, r.ThumbnailUrl,
                r.Location?.Y, r.Location?.X, r.DistanceMeters, r.UnitName, r.PublishedAt)).ToList();

            return new PagedResult<PublicListingSummaryDto>(items, page, pageSize, total);
        }

        public async Task<PublicListingDetailDto> GetPublicBySlugAsync(string slug, CancellationToken ct = default)
        {
            var listing = await _listings.Query()
                .Include(l => l.Images)
                .Include(l => l.Asset)
                .Include(l => l.AssetUnit)
                .FirstOrDefaultAsync(l => l.Slug == slug && l.Status == ListingStatus.Approved, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            // Tăng lượt xem bằng UPDATE trực tiếp thay vì tải-sửa-lưu: một GET công khai
            // không nên kéo theo change tracking và một transaction đầy đủ. Vẫn chưa chống
            // trùng theo IP — xem docs, việc đó thuộc giai đoạn sau.
            await _listings.Query()
                .Where(l => l.Id == listing.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.ViewCount, l => l.ViewCount + 1), ct);

            var owner = await _assets.Query().AsNoTracking()
                .Where(a => a.Id == listing.AssetId)
                .Select(a => new { a.User.Name, a.User.PhoneNumber })
                .FirstAsync(ct);

            var asset = listing.Asset;

            return new PublicListingDetailDto(
                listing.Id, listing.Slug!, listing.Title, listing.Description, listing.Type,
                listing.Price, listing.RentPaymentCycle,
                asset.Address.City, asset.Address.District, asset.Address.Ward, asset.Address.Detail,
                listing.AssetUnit?.Area ?? asset.Area, asset.Frontage,
                asset.Floors, asset.Bedrooms, asset.Bathrooms,
                asset.HouseDirection, asset.LegalStatus, asset.FurnitureState,
                asset.TypeProperty, AssetTypeLabel(asset.TypeProperty), listing.AssetUnit?.Name,
                asset.Location?.Y, asset.Location?.X,   // Y=lat, X=lng — dễ đảo nhầm
                listing.Images.OrderBy(i => i.SortOrder).Select(i => i.File.Url).ToList(),
                listing.ViewCount + 1, listing.PublishedAt,
                owner.Name, owner.PhoneNumber ?? "Chưa cập nhật số điện thoại");
        }

        // ==================== Helpers ====================

        private async Task<Listing> GetOwnedListingAsync(Guid listingId, CancellationToken ct)
            => await _listings.Query()
                   .FirstOrDefaultAsync(l => l.Id == listingId && l.Asset.UserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy tin đăng.");

        private async Task<OwnerListingDto> GetOwnedDtoAsync(Guid listingId, CancellationToken ct)
            => await ProjectOwner(_listings.Query().AsNoTracking().Where(l => l.Id == listingId))
                   .FirstAsync(ct);

        private static IQueryable<OwnerListingDto> ProjectOwner(IQueryable<Listing> q) =>
            q.Select(l => new OwnerListingDto(
                l.Id, l.Slug, l.Title, l.Type, l.Status, l.Price, l.RentPaymentCycle, l.ViewCount,
                l.CreatedAt, l.PublishedAt, l.AssetId, l.Asset.Name,
                l.AssetUnit != null ? l.AssetUnit.Name : null, l.ModerationNote));

        internal static string AssetTypeLabel(AssetDomainType type) => type switch
        {
            AssetDomainType.PrivateHouse => "Nhà riêng",
            AssetDomainType.Apartment => "Căn hộ",
            AssetDomainType.Land => "Đất",
            AssetDomainType.Villa => "Biệt thự",
            AssetDomainType.Shophouse => "Nhà mặt phố",
            AssetDomainType.Office => "Văn phòng",
            _ => "Khác"
        };

        private async Task<string> GenerateUniqueSlugAsync(string title, CancellationToken ct)
        {
            var baseSlug = ToSlug(title);
            var candidate = $"{baseSlug}-{Guid.NewGuid().ToString("N")[..6]}";

            while (await _listings.Query().AnyAsync(l => l.Slug == candidate, ct))
                candidate = $"{baseSlug}-{Guid.NewGuid().ToString("N")[..6]}";

            return candidate;
        }

        private static string ToSlug(string input)
        {
            var normalized = input.ToLowerInvariant();
            normalized = Regex.Replace(
                normalized.Normalize(NormalizationForm.FormD), @"\p{Mn}", "");
            normalized = normalized.Replace('đ', 'd');
            normalized = Regex.Replace(normalized, @"[^a-z0-9\s-]", "");
            normalized = Regex.Replace(normalized, @"\s+", "-").Trim('-');
            return normalized.Length > 60 ? normalized[..60].Trim('-') : normalized;
        }
    }
}
