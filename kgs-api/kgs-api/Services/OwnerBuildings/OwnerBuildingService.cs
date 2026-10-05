using System.ComponentModel.DataAnnotations;
using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.Rules;
using kgs_api.Domain.ValueObjects;
using kgs_api.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services.OwnerBuildings
{
    public sealed record OwnerBuildingUnitDto(
        Guid Id, string Name, int? Floor, double? Area, UnitStatus Status,
        /// <summary>Tin mới nhất CHƯA ĐÓNG của căn (nháp, chờ duyệt, đang hiển thị, cần sửa,
        /// bị từ chối) — null nghĩa là căn chưa có tin, đăng được ngay.</summary>
        Guid? ListingId, ListingStatus? ListingStatus, string? ListingSlug);

    public sealed record OwnerBuildingDto(
        Guid AssetId, string Name, AssetDomainType PropertyType,
        string City, string District, string Ward, string AddressDetail,
        double? Latitude, double? Longitude,
        int Floors, bool HasModel, bool Published,
        List<OwnerBuildingUnitDto> Units);

    public sealed record CreateBuildingRequest(
        [MaxLength(200)] string? Name,
        AssetDomainType PropertyType,
        [Required, MaxLength(100)] string City,
        [Required, MaxLength(100)] string District,
        [Required, MaxLength(100)] string Ward,
        [MaxLength(500)] string? AddressDetail,
        [Range(-90, 90)] double Latitude,
        [Range(-180, 180)] double Longitude,
        [Range(1, 60)] int Floors,
        /// <summary>0 = chưa sinh căn (tự khai sau).</summary>
        [Range(0, 30)] int UnitsPerFloor,
        /// <summary>Tầng đầu tiên có căn — nhà trọ/chung cư mini hay để tầng 1 làm chỗ để xe.</summary>
        [Range(1, 60)] int FirstUnitFloor,
        [Range(0, 2000)] double? UnitArea);

    /// <summary>Toà nhà / khu trọ nhiều căn của chủ nhà — để dựng mô hình 3D và đăng tin theo
    /// từng căn.
    ///
    /// Trước đây toà nhà chỉ dựng được trong khu "Quản lý tài sản" cũ mà thanh điều hướng Chủ
    /// nhà không còn dẫn tới, và luồng đăng tin luôn đăng NGUYÊN CĂN — không có cách nào gắn
    /// tin vào một căn. Hệ quả: chỉ dữ liệu trình diễn mới có tin hiện trên mô hình 3D.</summary>
    public sealed class OwnerBuildingService
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometry;

        public OwnerBuildingService(ApplicationDbContext db, ICurrentUserService currentUser, GeometryFactory geometry)
        {
            _db = db; _currentUser = currentUser; _geometry = geometry;
        }

        /// <summary>Tài sản có khai căn hoặc đã dựng khung 3D.</summary>
        public async Task<List<OwnerBuildingDto>> ListAsync(CancellationToken ct)
        {
            var userId = _currentUser.UserId;
            var assets = await _db.Assets.AsNoTracking()
                .Where(a => a.UserId == userId && (a.Units.Any() || a.FootprintJson != null))
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync(ct);
            if (assets.Count == 0) return new();

            var ids = assets.Select(a => a.Id).ToList();
            var units = await _db.AssetUnits.AsNoTracking()
                .Where(u => ids.Contains(u.AssetId))
                .ToListAsync(ct);
            var listings = await _db.Listings.AsNoTracking()
                .Where(l => ids.Contains(l.AssetId) && l.AssetUnitId != null && l.Status != ListingStatus.Closed)
                .OrderByDescending(l => l.CreatedAt)
                .Select(l => new { l.Id, l.AssetUnitId, l.Status, l.Slug })
                .ToListAsync(ct);
            var byUnit = listings.GroupBy(l => l.AssetUnitId!.Value).ToDictionary(g => g.Key, g => g.First());

            return assets.Select(a =>
            {
                var mine = units.Where(u => u.AssetId == a.Id)
                    .OrderBy(u => u.FloorNumber ?? int.MaxValue).ThenBy(u => u.Name, StringComparer.Ordinal)
                    .Select(u => byUnit.TryGetValue(u.Id, out var l)
                        ? new OwnerBuildingUnitDto(u.Id, u.Name, u.FloorNumber, u.Area, u.Status, l.Id, l.Status, l.Slug)
                        : new OwnerBuildingUnitDto(u.Id, u.Name, u.FloorNumber, u.Area, u.Status, null, null, null))
                    .ToList();
                var floors = Math.Max(a.Floors ?? 0, mine.Max(u => u.Floor) ?? 0);
                return new OwnerBuildingDto(
                    a.Id, a.Name, a.TypeProperty,
                    a.Address.City, a.Address.District, a.Address.Ward, a.Address.Detail,
                    a.Location?.Y, a.Location?.X,
                    Math.Max(floors, 1), !string.IsNullOrEmpty(a.FootprintJson), a.BuildingModelPublished,
                    mine);
            }).ToList();
        }

        /// <summary>Tạo toà nhà và sinh sẵn danh sách căn "P.{tầng}{số}" (P.201, P.202…). Đã có
        /// tài sản ở đúng địa chỉ này thì dùng lại — cùng quy tắc với đăng tin trực tiếp.</summary>
        public async Task<OwnerBuildingDto> CreateAsync(CreateBuildingRequest r, CancellationToken ct)
        {
            if (r.FirstUnitFloor > r.Floors)
                throw new ValidationFailedException("Tầng bắt đầu có căn phải không cao hơn số tầng.");

            var userId = _currentUser.UserId;
            var city = AdministrativeNames.CanonicalCity(r.City)!;
            var address = new Address
            {
                City = city,
                District = AdministrativeNames.CanonicalDistrict(city, r.District)!,
                Ward = r.Ward.Trim(),
                Detail = r.AddressDetail?.Trim() ?? string.Empty,
            };

            var asset = await _db.Assets.Include(a => a.Units)
                .FirstOrDefaultAsync(a => a.UserId == userId
                                       && a.Address.City == address.City
                                       && a.Address.District == address.District
                                       && a.Address.Ward == address.Ward
                                       && a.Address.Detail == address.Detail, ct);
            var name = string.IsNullOrWhiteSpace(r.Name)
                ? (string.IsNullOrWhiteSpace(address.Detail) ? $"{address.Ward}, {address.District}" : $"{address.Detail}, {address.District}")
                : r.Name.Trim();

            if (asset is null)
            {
                asset = new Asset
                {
                    UserId = userId,
                    Name = name,
                    TypeProperty = r.PropertyType,
                    OwnershipType = AssetOwnershipType.Owned,
                    Status = AssetStatus.InUse,
                    Address = address,
                };
                _db.Assets.Add(asset);
            }
            else if (!string.IsNullOrWhiteSpace(r.Name))
            {
                asset.Name = name;
            }
            asset.TypeProperty = r.PropertyType;
            asset.Floors = Math.Max(asset.Floors ?? 0, r.Floors);
            asset.Location = _geometry.CreatePoint(new Coordinate(r.Longitude, r.Latitude));

            var existing = asset.Units.Select(u => u.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            for (var f = r.FirstUnitFloor; f <= r.Floors; f++)
            {
                for (var i = 1; i <= r.UnitsPerFloor; i++)
                {
                    var unitName = $"P.{f}{i:00}";
                    if (!existing.Add(unitName)) continue;
                    asset.Units.Add(new AssetUnit
                    {
                        Name = unitName,
                        FloorNumber = f,
                        Area = r.UnitArea,
                        Status = UnitStatus.Vacant,
                    });
                }
            }

            await _db.SaveChangesAsync(ct);
            return (await ListAsync(ct)).First(b => b.AssetId == asset.Id);
        }
    }
}
