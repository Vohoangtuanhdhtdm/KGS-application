using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Dtos;
using kgs_api.Repositories;
using static kgs_api.Common.Common;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Domain.Enums;
using kgs_api.Interfaces;

namespace kgs_api.Services
{
    public sealed class AssetUnitService : IAssetUnitService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<AssetUnit> _units;
        private readonly IRepository<Listing> _listings;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public AssetUnitService(IRepository<Asset> assets, IRepository<AssetUnit> units,
            IRepository<Listing> listings,
            IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _assets = assets; _units = units; _listings = listings;
            _uow = uow; _currentUser = currentUser;
        }

        public async Task<AssetUnitDto> CreateAsync(Guid assetId, AssetUnitRequest request, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);

            var duplicated = await _units.Query()
                .AnyAsync(u => u.AssetId == assetId && u.Name == request.Name.Trim(), ct);
            if (duplicated)
                throw new ConflictException($"Tài sản đã có tầng/phòng tên '{request.Name.Trim()}'.");

            var unit = new AssetUnit
            {
                AssetId = assetId,
                Name = request.Name.Trim(),
                FloorNumber = request.FloorNumber,
                Area = request.Area,
                Status = UnitStatus.Vacant,
                Notes = request.Notes
            };

            await _units.AddAsync(unit, ct);
            await _uow.SaveChangesAsync(ct);
            return ToDto(unit);
        }

        public async Task<AssetUnitDto> UpdateAsync(Guid assetId, Guid unitId, AssetUnitRequest request, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);
            var unit = await GetUnitAsync(assetId, unitId, ct);

            var duplicated = await _units.Query()
                .AnyAsync(u => u.AssetId == assetId && u.Id != unitId && u.Name == request.Name.Trim(), ct);
            if (duplicated)
                throw new ConflictException($"Tài sản đã có tầng/phòng tên '{request.Name.Trim()}'.");

            unit.Name = request.Name.Trim();
            unit.FloorNumber = request.FloorNumber;
            unit.Area = request.Area;
            unit.Notes = request.Notes;
            if (request.Status is not null) unit.Status = request.Status.Value;

            await _uow.SaveChangesAsync(ct);
            return ToDto(unit);
        }

        public async Task DeleteAsync(Guid assetId, Guid unitId, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);
            var unit = await GetUnitAsync(assetId, unitId, ct);

            // Khoá ngoại Listing → AssetUnit là cascade: xoá căn sẽ XOÁ LUÔN tin của căn, kể cả
            // tin đã duyệt cùng lượt xem, lượt hỏi thuê. Không cho xoá khi căn còn bất kỳ tin nào.
            var listings = await _listings.Query().CountAsync(l => l.AssetUnitId == unitId, ct);
            if (listings > 0)
                throw new ConflictException(
                    $"Căn này có {listings} tin đăng (kể cả nháp hoặc đã đóng) — xoá bản nháp ở \"Tin của tôi\" " +
                    "hoặc giữ căn lại và đánh dấu \"Đang sửa chữa\". Tin đã từng đăng được giữ để còn lịch sử.");

            _units.Remove(unit);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task<IReadOnlyList<AssetUnitDto>> GetByAssetAsync(Guid assetId, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);

            return await _units.Query().AsNoTracking()
                .Where(u => u.AssetId == assetId)
                .OrderBy(u => u.FloorNumber).ThenBy(u => u.Name)
                .Select(u => new AssetUnitDto(u.Id, u.Name, u.FloorNumber, u.Area, u.Status, u.Notes))
                .ToListAsync(ct);
        }

        private async Task EnsureOwnedAssetAsync(Guid assetId, CancellationToken ct)
        {
            var owns = await _assets.Query().AnyAsync(a => a.Id == assetId && a.UserId == _currentUser.UserId, ct);
            if (!owns) throw new NotFoundException("Không tìm thấy tài sản.");
        }

        private async Task<AssetUnit> GetUnitAsync(Guid assetId, Guid unitId, CancellationToken ct)
            => await _units.Query().FirstOrDefaultAsync(u => u.Id == unitId && u.AssetId == assetId, ct)
               ?? throw new NotFoundException("Không tìm thấy tầng/phòng.");

        private static AssetUnitDto ToDto(AssetUnit u)
            => new(u.Id, u.Name, u.FloorNumber, u.Area, u.Status, u.Notes);
    }
}
