using System.Text.Json;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    /// <summary>Mô hình toà nhà 3D, dựng từ dữ liệu đã có thay vì từ tệp 3D.
    ///
    /// Cách làm học từ các công cụ tạo 3D như Meshy: đầu vào tối thiểu, xem trước gần như tức
    /// thì, rồi mới tinh chỉnh. Khác ở chỗ đầu vào không phải ảnh mà là DỮ LIỆU THẬT — khung
    /// toà nhà trên bản đồ, số tầng, các căn chủ nhà đã khai — nên mô hình đúng vị trí, đúng số
    /// tầng, đúng căn, thay vì một hình "tưởng tượng" từ ảnh.</summary>
    public sealed class BuildingModelService
    {
        public const double DefaultFloorHeight = 3.2;
        private const int MaxFootprintPoints = 200;

        private readonly IRepository<Asset> _assets;
        private readonly IRepository<AssetUnit> _units;
        private readonly IRepository<Listing> _listings;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory;

        /// <summary>Khung nhìn rộng hơn mức này (độ) thì không trả: khối 3D chỉ hiện khi đã phóng
        /// gần, và một khung nhìn cả thành phố thì vừa nặng vừa vô nghĩa.</summary>
        public const double MaxViewSpanDegrees = 0.2;
        private const int MaxBuildingsInView = 150;
        private const int PreviewListings = 4;

        public BuildingModelService(
            IRepository<Asset> assets, IRepository<AssetUnit> units, IRepository<Listing> listings,
            IUnitOfWork uow, ICurrentUserService currentUser, GeometryFactory geometryFactory)
        {
            _assets = assets; _units = units; _listings = listings; _uow = uow; _currentUser = currentUser;
            _geometryFactory = geometryFactory;
        }

        // ==================== Chủ nhà ====================

        public async Task<BuildingModelDto> GetForOwnerAsync(Guid assetId, CancellationToken ct)
        {
            var asset = await OwnedAsync(assetId, ct);
            return await ToDtoAsync(asset, null, publicView: false, ct);
        }

        public async Task<BuildingModelDto> SaveAsync(Guid assetId, SaveBuildingModelRequest req, CancellationToken ct)
        {
            var asset = await OwnedAsync(assetId, ct);
            ValidateFootprint(req.Footprint);

            asset.FootprintJson = JsonSerializer.Serialize(req.Footprint.Select(p => new[] { Math.Round(p[0], 7), Math.Round(p[1], 7) }));
            asset.Floors = req.Floors;
            asset.FloorHeightMeters = Math.Round(req.FloorHeightMeters, 2);
            asset.BuildingModelPublished = req.Published;
            await _uow.SaveChangesAsync(ct);
            return await ToDtoAsync(asset, null, publicView: false, ct);
        }

        /// <summary>Quản trị viên: mô hình của bất kỳ toà nhà nào, kể cả chưa công khai.</summary>
        public async Task<BuildingModelDto> GetForAdminAsync(Guid assetId, CancellationToken ct)
        {
            var asset = await _assets.Query().AsNoTracking().FirstOrDefaultAsync(a => a.Id == assetId, ct)
                ?? throw new NotFoundException("Không tìm thấy toà nhà.");
            return await ToDtoAsync(asset, null, publicView: false, ct);
        }

        // ==================== Người tìm nhà ====================

        /// <summary>Mô hình của toà nhà chứa tin này — null khi chủ nhà chưa dựng hoặc chưa công khai.</summary>
        public async Task<BuildingModelDto?> GetPublicBySlugAsync(string slug, CancellationToken ct)
        {
            var row = await _listings.Query().AsNoTracking()
                .Where(l => l.Slug == slug && l.Status == ListingStatus.Approved)
                .Select(l => new { l.AssetId, l.AssetUnitId })
                .FirstOrDefaultAsync(ct);
            if (row is null) return null;

            var asset = await _assets.Query().AsNoTracking().FirstOrDefaultAsync(a => a.Id == row.AssetId, ct);
            if (asset is null || !asset.BuildingModelPublished || string.IsNullOrEmpty(asset.FootprintJson)) return null;

            return await ToDtoAsync(asset, row.AssetUnitId, publicView: true, ct);
        }

        /// <summary>Các toà nhà có mô hình công khai VÀ đang có tin hiển thị trong khung nhìn.
        /// Toà nhà không còn tin nào thì không hiện: bản đồ tìm kiếm là để tìm chỗ đang cho
        /// thuê/bán, không phải để xem kiến trúc. <paramref name="type"/> = loại tin đang tìm.</summary>
        public async Task<List<MapBuildingDto>> GetInViewAsync(
            double west, double south, double east, double north, ListingType? type, CancellationToken ct)
        {
            if (!(west < east && south < north) || east - west > MaxViewSpanDegrees || north - south > MaxViewSpanDegrees
                || west < -180 || east > 180 || south < -90 || north > 90)
                throw new ValidationFailedException("Khung nhìn không hợp lệ hoặc quá rộng — hãy phóng gần hơn.");

            var view = _geometryFactory.CreatePolygon(new[]
            {
                new Coordinate(west, south), new Coordinate(east, south), new Coordinate(east, north),
                new Coordinate(west, north), new Coordinate(west, south),
            });

            var assets = await _assets.Query().AsNoTracking()
                .Where(a => a.BuildingModelPublished && a.FootprintJson != null && a.Location != null
                            && a.Location.Intersects(view))
                .Where(a => a.Listings.Any(l => l.Status == ListingStatus.Approved && (type == null || l.Type == type)))
                .Select(a => new
                {
                    a.Id, a.FootprintJson, a.Floors, a.FloorHeightMeters,
                    a.Address.Detail, a.Address.District,
                })
                .Take(MaxBuildingsInView)
                .ToListAsync(ct);
            if (assets.Count == 0) return new();

            var ids = assets.Select(a => a.Id).ToList();
            var unitStats = await _units.Query().AsNoTracking()
                .Where(u => ids.Contains(u.AssetId))
                .GroupBy(u => u.AssetId)
                .Select(g => new
                {
                    AssetId = g.Key,
                    Count = g.Count(),
                    Vacant = g.Count(u => u.Status == UnitStatus.Vacant),
                    MaxFloor = g.Max(u => u.FloorNumber),
                })
                .ToDictionaryAsync(x => x.AssetId, ct);
            var listings = await _listings.Query().AsNoTracking()
                .Where(l => ids.Contains(l.AssetId) && l.Status == ListingStatus.Approved && (type == null || l.Type == type))
                .OrderBy(l => l.Price)
                .Select(l => new
                {
                    l.AssetId, l.Slug, l.Title, l.Price, l.Type, l.RentPaymentCycle,
                    UnitName = l.AssetUnit != null ? l.AssetUnit.Name : null,
                })
                .ToListAsync(ct);
            var byAsset = listings.GroupBy(l => l.AssetId).ToDictionary(g => g.Key, g => g.ToList());

            return assets.Select(a =>
            {
                unitStats.TryGetValue(a.Id, out var st);
                var ls = byAsset.GetValueOrDefault(a.Id) ?? new();
                return new MapBuildingDto(
                    a.Id,
                    $"{a.Detail}, {a.District}".Trim(' ', ','),
                    JsonSerializer.Deserialize<List<double[]>>(a.FootprintJson!) ?? new(),
                    Math.Max(Math.Max(a.Floors ?? 0, st?.MaxFloor ?? 0), 1),
                    a.FloorHeightMeters ?? DefaultFloorHeight,
                    st?.Count ?? 0,
                    st?.Vacant ?? 0,
                    ls.Count,
                    ls.Take(PreviewListings)
                      .Select(l => new BuildingListingPreviewDto(l.Slug!, l.Title, l.Price, l.Type, l.RentPaymentCycle, l.UnitName))
                      .ToList());
            }).ToList();
        }

        // ==================== Nội bộ ====================

        private async Task<Asset> OwnedAsync(Guid assetId, CancellationToken ct)
            => await _assets.Query().FirstOrDefaultAsync(a => a.Id == assetId && a.UserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy tài sản.");

        private async Task<BuildingModelDto> ToDtoAsync(Asset asset, Guid? focusUnitId, bool publicView, CancellationToken ct)
        {
            var units = await _units.Query().AsNoTracking()
                .Where(u => u.AssetId == asset.Id)
                .OrderBy(u => u.FloorNumber).ThenBy(u => u.Name)
                .ToListAsync(ct);

            // Tin đang hiển thị của từng căn (mới nhất). Chỉ tin đã duyệt — tin nháp hay chờ duyệt
            // không tồn tại với người tìm nhà.
            var listings = await _listings.Query().AsNoTracking()
                .Where(l => l.AssetId == asset.Id && l.AssetUnitId != null && l.Status == ListingStatus.Approved)
                .OrderByDescending(l => l.PublishedAt)
                .Select(l => new { l.Id, l.AssetUnitId, l.Slug, l.Title, l.Price, l.Type, l.RentPaymentCycle })
                .ToListAsync(ct);
            var byUnit = listings.GroupBy(l => l.AssetUnitId!.Value).ToDictionary(g => g.Key, g => g.First());

            // Ảnh của các tin đó — một truy vấn cho cả toà nhà, cắt 6 ảnh mỗi tin ở bộ nhớ.
            var shownIds = byUnit.Values.Select(l => l.Id).ToList();
            var images = shownIds.Count == 0
                ? new Dictionary<Guid, List<string>>()
                : (await _listings.Query().AsNoTracking()
                        .Where(l => shownIds.Contains(l.Id))
                        .SelectMany(l => l.Images.Select(i => new { i.ListingId, i.SortOrder, i.File.Url }))
                        .ToListAsync(ct))
                    .GroupBy(i => i.ListingId)
                    .ToDictionary(g => g.Key, g => g.OrderBy(i => i.SortOrder).Take(6).Select(i => i.Url).ToList());
            // Ảnh chung: ảnh bìa của từng tin trong toà, tối đa 8.
            var buildingImages = images.Values.Where(v => v.Count > 0).Select(v => v[0]).Take(8).ToList();

            var footprint = string.IsNullOrEmpty(asset.FootprintJson)
                ? new List<double[]>()
                : JsonSerializer.Deserialize<List<double[]>>(asset.FootprintJson) ?? new List<double[]>();

            var floors = Math.Max(asset.Floors ?? 0, units.Max(u => (int?)u.FloorNumber) ?? 0);

            return new BuildingModelDto(
                asset.Id,
                // Tên tài sản là thứ nội bộ của chủ nhà ("Nhà mẹ cho thuê") — người tìm nhà chỉ
                // thấy địa chỉ.
                publicView ? $"{asset.Address.Detail}, {asset.Address.District}".Trim(' ', ',') : asset.Name,
                footprint,
                Math.Max(floors, 1),
                asset.FloorHeightMeters ?? DefaultFloorHeight,
                asset.BuildingModelPublished,
                units.Select(u => new BuildingUnitDto(
                    u.Id, u.Name, u.FloorNumber, u.Area, u.Status,
                    byUnit.TryGetValue(u.Id, out var l)
                        ? new BuildingUnitListingDto(l.Slug!, l.Title, l.Price, l.Type, l.RentPaymentCycle,
                            images.TryGetValue(l.Id, out var imgs) ? imgs : new List<string>())
                        : null)).ToList(),
                focusUnitId,
                asset.Location?.Y,
                asset.Location?.X,
                buildingImages);
        }

        /// <summary>Khung phải là một đa giác hợp lý: 3–200 điểm, toạ độ hợp lệ, diện tích từ
        /// 15 m² tới 0,2 km² (lớn hơn thì gần như chắc chắn là chọn nhầm cả một khu).</summary>
        public static void ValidateFootprint(List<double[]> ring)
        {
            if (ring.Count < 3 || ring.Count > MaxFootprintPoints || ring.Any(p => p.Length != 2))
                throw new ValidationFailedException($"Khung toà nhà phải có từ 3 đến {MaxFootprintPoints} điểm.");
            if (ring.Any(p => p[0] is < -180 or > 180 || p[1] is < -90 or > 90 || !double.IsFinite(p[0]) || !double.IsFinite(p[1])))
                throw new ValidationFailedException("Khung toà nhà có toạ độ không hợp lệ.");

            // Diện tích theo công thức dây giày trên mặt phẳng chiếu quanh tâm — đủ chính xác ở
            // cỡ một toà nhà.
            var lat0 = ring.Average(p => p[1]) * Math.PI / 180;
            const double mPerDeg = 111_320;
            double area = 0;
            for (int i = 0; i < ring.Count; i++)
            {
                var a = ring[i]; var b = ring[(i + 1) % ring.Count];
                area += (a[0] * Math.Cos(lat0) * mPerDeg) * (b[1] * mPerDeg) - (b[0] * Math.Cos(lat0) * mPerDeg) * (a[1] * mPerDeg);
            }
            area = Math.Abs(area) / 2;
            if (area < 15 || area > 200_000)
                throw new ValidationFailedException($"Khung toà nhà rộng {area:0} m² — không hợp lý cho một toà nhà.");
        }
    }
}
