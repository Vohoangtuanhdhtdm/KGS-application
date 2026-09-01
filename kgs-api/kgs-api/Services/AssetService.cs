using kgs_api.Domain.Entity;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using kgs_api.Storage;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using System.Linq;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    public sealed class AssetService : IAssetService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<Property> _properties;
        private readonly IUnitOfWork _uow;
        private readonly IFileStorageService _files;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory; // singleton SRID 4326 từ DI

        public AssetService(
            IRepository<Asset> assets,
            IRepository<Property> properties,
            IUnitOfWork uow,
            IFileStorageService files,
            ICurrentUserService currentUser,
            GeometryFactory geometryFactory)
        {
            _assets = assets;
            _properties = properties;
            _uow = uow;
            _files = files;
            _currentUser = currentUser;
            _geometryFactory = geometryFactory;
        }

        // -------------------- A1. CRUD --------------------

        public async Task<AssetDetailDto> CreateAsync(AssetCreateRequest request, CancellationToken ct = default)
        {
            var asset = new Asset
            {
                UserId = _currentUser.UserId,
                Name = request.Name.Trim(),
                TypeProperty = request.TypeProperty,
                OwnershipType = request.OwnershipType,
                Status = AssetStatus.InUse,
                Address = MapAddress(request.Address),
                Location = ToPoint(request.Location),
                Area = request.Area,
                CurrentValue = request.CurrentValue,
                AcquisitionDate = request.AcquisitionDate,
                Notes = request.Notes,
                Floors = request.Floors,
                Bedrooms = request.Bedrooms,
                Bathrooms = request.Bathrooms,
                HouseDirection = request.HouseDirection?.Trim(),
                LegalStatus = request.LegalStatus?.Trim(),
                FurnitureState = request.FurnitureState?.Trim()
            };

            await _assets.AddAsync(asset, ct);
            await _uow.SaveChangesAsync(ct);
            return await GetByIdAsync(asset.Id, ct);
        }

        public async Task<AssetDetailDto> UpdateAsync(Guid assetId, AssetUpdateRequest request, CancellationToken ct = default)
        {
            var asset = await GetOwnedAssetAsync(assetId, ct);

            asset.Name = request.Name.Trim();
            asset.TypeProperty = request.TypeProperty;
            asset.Status = request.Status;
            asset.Address = MapAddress(request.Address);
            asset.Location = ToPoint(request.Location);
            asset.Area = request.Area;
            asset.CurrentValue = request.CurrentValue;
            asset.AcquisitionDate = request.AcquisitionDate;
            asset.Notes = request.Notes;

            asset.Floors = request.Floors;
            asset.Bedrooms = request.Bedrooms;
            asset.Bathrooms = request.Bathrooms;
            asset.HouseDirection = request.HouseDirection?.Trim();
            asset.LegalStatus = request.LegalStatus?.Trim();
            asset.FurnitureState = request.FurnitureState?.Trim();

            await _uow.SaveChangesAsync(ct);
            return await GetByIdAsync(assetId, ct);
        }

        public async Task DeleteAsync(Guid assetId, CancellationToken ct = default)
        {
            var asset = await _assets.Query()
                .Include(a => a.Media)
                .Include(a => a.Documents)
                .FirstOrDefaultAsync(a => a.Id == assetId && a.UserId == _currentUser.UserId, ct)
                ?? throw new NotFoundException("Không tìm thấy tài sản.");

            var hasActiveContract = await _assets.Query()
                .Where(a => a.Id == assetId)
                .SelectMany(a => a.Contracts)
                .AnyAsync(c => c.Status == ContractStatus.Active, ct);
            if (hasActiveContract)
                throw new ConflictException("Tài sản còn hợp đồng đang hiệu lực — hãy chấm dứt hợp đồng trước khi xoá.");

            // Đẩy toàn bộ file Cloudinary vào outbox — cùng transaction với DELETE
            _files.ScheduleDeletion(asset.Thumbnail);
            foreach (var m in asset.Media) _files.ScheduleDeletion(m.File);
            foreach (var d in asset.Documents) _files.ScheduleDeletion(d.File);

            _assets.Remove(asset); // các bảng con Cascade theo FK
            await _uow.SaveChangesAsync(ct);
        }

        public async Task<AssetDetailDto> GetByIdAsync(Guid assetId, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            // Lấy Location nguyên object (Point) — KHÔNG tách .X/.Y trong Select này
            var raw = await _assets.Query().AsNoTracking()
                .Where(a => a.Id == assetId && a.UserId == userId)
                .Select(a => new
                {
                    a.Id,
                    a.Name,
                    a.TypeProperty,
                    a.OwnershipType,
                    a.Status,
                    a.Address,
                    a.Location,
                    a.Area,
                    a.CurrentValue,
                    a.AcquisitionDate,
                    a.Notes,
                    a.Thumbnail,
                    a.LinkedPropertyId,
                    UnitCount = a.Units.Count,
                    ActiveContractCount = a.Contracts.Count(c => c.Status == ContractStatus.Active),
                    a.CreatedAt,
                    a.UpdatedAt,
                    a.Floors,
                    a.Bedrooms,
                    a.Bathrooms,
                    a.HouseDirection,
                    a.LegalStatus,
                    a.FurnitureState
                })
                .FirstOrDefaultAsync(ct);

            if (raw is null) throw new NotFoundException("Không tìm thấy tài sản.");

            // Tách X/Y ở ĐÂY — đã là C# thuần, không còn dịch sang SQL nữa
            return new AssetDetailDto(
                raw.Id, raw.Name, raw.TypeProperty, raw.OwnershipType, raw.Status,
                new AddressDto(raw.Address.City, raw.Address.District, raw.Address.Ward, raw.Address.Detail),
                raw.Location is null ? null : new GeoPointDto(raw.Location.Y, raw.Location.X), // Y=lat, X=lng
                raw.Area, raw.CurrentValue, raw.AcquisitionDate, raw.Notes,
                raw.Thumbnail is null ? null
                    : new StoredFileDto(raw.Thumbnail.Url, raw.Thumbnail.FileName, raw.Thumbnail.ContentType, raw.Thumbnail.SizeBytes),
                raw.LinkedPropertyId, raw.UnitCount, raw.ActiveContractCount, raw.CreatedAt, raw.UpdatedAt, raw.Floors, raw.Bedrooms, raw.Bathrooms,
                raw.HouseDirection, raw.LegalStatus, raw.FurnitureState);
        }

        public async Task<PagedResult<AssetSummaryDto>> SearchAsync(AssetSearchQuery query, CancellationToken ct = default)
        {
            var q = _assets.Query().AsNoTracking()
                .Where(a => a.UserId == _currentUser.UserId);

            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var kw = $"%{query.Keyword.Trim()}%";
                q = q.Where(a => EF.Functions.ILike(a.Name, kw)
                              || EF.Functions.ILike(a.Address.Detail, kw));
            }
            if (query.TypeProperty is not null) q = q.Where(a => a.TypeProperty == query.TypeProperty);
            if (query.Status is not null) q = q.Where(a => a.Status == query.Status);
            if (query.OwnershipType is not null) q = q.Where(a => a.OwnershipType == query.OwnershipType);
            if (!string.IsNullOrWhiteSpace(query.City)) q = q.Where(a => a.Address.City == query.City);

            var total = await q.CountAsync(ct);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);
            var page = Math.Max(query.Page, 1);

            var items = await q
                .OrderByDescending(a => a.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new AssetSummaryDto(
                    a.Id, a.Name, a.TypeProperty, a.OwnershipType, a.Status,
                    a.Address.City, a.Address.District, a.CurrentValue,
                    a.Thumbnail == null ? null : a.Thumbnail.Url,
                    a.LinkedPropertyId))
                .ToListAsync(ct);

            return new PagedResult<AssetSummaryDto>(items, page, pageSize, total);
        }

        // -------------------- A2. NEARBY (PostGIS) --------------------

        public async Task<IReadOnlyList<AssetNearbyDto>> FindNearbyAsync(NearbyQuery query, CancellationToken ct = default)
        {
            var origin = _geometryFactory.CreatePoint(new Coordinate(query.Longitude, query.Latitude));

            // Distance()/IsWithinDistance() dịch được sang ST_Distance/ST_DWithin cho geography — giữ nguyên trong Select
            var rows = await _assets.Query().AsNoTracking()
                .Where(a => a.UserId == _currentUser.UserId
                         && a.Location != null
                         && a.Location.IsWithinDistance(origin, query.RadiusMeters))
                .OrderBy(a => a.Location!.Distance(origin))
                .Take(Math.Clamp(query.Limit, 1, 100))
                .Select(a => new
                {
                    a.Id,
                    a.Name,
                    a.TypeProperty,
                    a.Status,
                    a.Location,                              // lấy nguyên Point, không tách X/Y ở đây
                    DistanceMeters = a.Location!.Distance(origin)
                })
                .ToListAsync(ct);

            // Tách X/Y sau khi đã materialize
            return rows.Select(r => new AssetNearbyDto(
                    r.Id, r.Name, r.TypeProperty, r.Status,
                    r.Location!.Y, r.Location.X, r.DistanceMeters))
                .ToList();
        }

        public async Task<IReadOnlyList<AssetMapPinDto>> GetMapPinsAsync(CancellationToken ct = default)
        {
            // ← KHÔNG còn .Where(a => a.Location != null) — trả TẤT CẢ tài sản của user,
            //   kể cả chưa gắn vị trí (đúng yêu cầu ở docs/api-map-pins.md: "Vẫn phải trả về,
            //   với latitude/longitude = null. Frontend liệt kê chúng riêng trong overlay
            //   danh sách kèm nút Bổ sung — bỏ sót là người dùng không biết mình còn tài sản
            //   chưa gắn vị trí.")

            // Materialize TRƯỚC bằng kiểu vô danh, tách Location.Y/.X SAU — giữ đúng nguyên
            // tắc đã sửa từ lỗi ST_Y(geography) does not exist ở đầu dự án
            var raw = await _assets.Query().AsNoTracking()
                .Where(a => a.UserId == _currentUser.UserId)
                .Select(a => new
                {
                    a.Id,
                    a.Name,
                    a.TypeProperty,
                    a.OwnershipType,
                    a.Status,
                    a.Address.City,
                    a.Address.District,
                    a.CurrentValue,
                    ThumbnailUrl = a.Thumbnail == null ? null : a.Thumbnail.Url,
                    a.LinkedPropertyId,
                    a.Location   // giữ nguyên object Point?, tách Y/X sau khi đã materialize
                })
                .ToListAsync(ct);

            return raw.Select(r => new AssetMapPinDto(
                r.Id, r.Name, r.TypeProperty, r.OwnershipType, r.Status,
                r.City, r.District, r.CurrentValue, r.ThumbnailUrl, r.LinkedPropertyId,
                r.Location?.Y,   // null nếu r.Location null — đúng ý đồ, KHÔNG throw, KHÔNG loại bỏ dòng
                r.Location?.X))
                .ToList();
        }

        // -------------------- A3. LINK PROPERTY --------------------

        public async Task LinkPropertyAsync(Guid assetId, int propertyId, CancellationToken ct = default)
        {
            var asset = await GetOwnedAssetAsync(assetId, ct);

            var ownsProperty = await _properties.Query()
                .AnyAsync(p => p.Id == propertyId && p.UserId == _currentUser.UserId, ct);
            if (!ownsProperty)
                throw new NotFoundException("Không tìm thấy tin đăng hoặc tin đăng không thuộc về bạn.");

            var alreadyLinked = await _assets.Query()
                .AnyAsync(a => a.LinkedPropertyId == propertyId && a.Id != assetId, ct);
            if (alreadyLinked)
                throw new ConflictException("Tin đăng này đã được liên kết với một tài sản khác.");

            asset.LinkedPropertyId = propertyId;
            await _uow.SaveChangesAsync(ct);
        }

        public async Task UnlinkPropertyAsync(Guid assetId, CancellationToken ct = default)
        {
            var asset = await GetOwnedAssetAsync(assetId, ct);
            asset.LinkedPropertyId = null;
            await _uow.SaveChangesAsync(ct);
        }

        // -------------------- Helpers --------------------

        private async Task<Asset> GetOwnedAssetAsync(Guid assetId, CancellationToken ct)
            => await _assets.Query()
                   .FirstOrDefaultAsync(a => a.Id == assetId && a.UserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy tài sản.");

        private static Address MapAddress(AddressDto dto) => new()
        {
            City = dto.City.Trim(),
            District = dto.District.Trim(),
            Ward = dto.Ward.Trim(),
            Detail = dto.Detail?.Trim() ?? string.Empty
        };

        /// <summary>Điểm chuyển đổi DUY NHẤT lat/lng → Point để không bao giờ đảo trục.</summary>
        private Point? ToPoint(GeoPointDto? dto)
            => dto is null ? null
               : _geometryFactory.CreatePoint(new Coordinate(dto.Longitude, dto.Latitude));
    }
}
