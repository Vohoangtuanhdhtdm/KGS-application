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
        private readonly IRepository<LeaseContract> _contracts;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public AssetUnitService(IRepository<Asset> assets, IRepository<AssetUnit> units,
            IRepository<LeaseContract> contracts, IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _assets = assets; _units = units; _contracts = contracts; _uow = uow; _currentUser = currentUser;
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

            unit.Name = request.Name.Trim();
            unit.FloorNumber = request.FloorNumber;
            unit.Area = request.Area;
            unit.Notes = request.Notes;

            await _uow.SaveChangesAsync(ct);
            return ToDto(unit);
        }

        public async Task DeleteAsync(Guid assetId, Guid unitId, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);
            var unit = await GetUnitAsync(assetId, unitId, ct);

            var hasActiveContract = await _contracts.Query()
                .AnyAsync(c => c.AssetUnitId == unitId && c.Status == ContractStatus.Active, ct);
            if (hasActiveContract)
                throw new ConflictException("Tầng/phòng còn hợp đồng đang hiệu lực — chấm dứt hợp đồng trước khi xoá.");

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

    public sealed class ContactPartyService : IContactPartyService
    {
        private readonly IRepository<ContactParty> _contacts;
        private readonly IRepository<LeaseContract> _contracts;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public ContactPartyService(IRepository<ContactParty> contacts, IRepository<LeaseContract> leaseContracts,
            IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _contacts = contacts; _contracts = leaseContracts;
            _uow = uow; _currentUser = currentUser;
        }

        public async Task<ContactPartyDto> CreateAsync(ContactPartyRequest request, CancellationToken ct = default)
        {
            var contact = new ContactParty
            {
                UserId = _currentUser.UserId,
                Type = request.Type,
                FullName = request.FullName.Trim(),
                Phone = request.Phone?.Trim(),
                Email = request.Email?.Trim(),
                IdNumber = request.IdNumber?.Trim(),
                Notes = request.Notes
            };

            await _contacts.AddAsync(contact, ct);
            await _uow.SaveChangesAsync(ct);
            return ToDto(contact);
        }

        public async Task<ContactPartyDto> UpdateAsync(Guid contactId, ContactPartyRequest request, CancellationToken ct = default)
        {
            var contact = await GetOwnedAsync(contactId, ct);

            contact.Type = request.Type;
            contact.FullName = request.FullName.Trim();
            contact.Phone = request.Phone?.Trim();
            contact.Email = request.Email?.Trim();
            contact.IdNumber = request.IdNumber?.Trim();
            contact.Notes = request.Notes;

            await _uow.SaveChangesAsync(ct);
            return ToDto(contact);
        }

        public async Task DeleteAsync(Guid contactId, CancellationToken ct = default)
        {
            var contact = await GetOwnedAsync(contactId, ct);

            // FK là Restrict — kiểm tra trước để trả lỗi nghiệp vụ rõ ràng thay vì lỗi DB
            var referenced =
                await _contracts.Query().AnyAsync(c => c.CounterpartyId == contactId, ct);
            if (referenced)
                throw new ConflictException("Đối tác đang được tham chiếu bởi hợp đồng — không thể xoá.");

            _contacts.Remove(contact);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task<PagedResult<ContactPartyDto>> ListAsync(ContactType? type, string? keyword,
            int page, int pageSize, CancellationToken ct = default)
        {
            var q = _contacts.Query().AsNoTracking()
                .Where(c => c.UserId == _currentUser.UserId);

            if (type is not null) q = q.Where(c => c.Type == type);
            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var kw = $"%{keyword.Trim()}%";
                q = q.Where(c => EF.Functions.ILike(c.FullName, kw)
                              || (c.Phone != null && EF.Functions.ILike(c.Phone, kw)));
            }

            var total = await q.CountAsync(ct);
            pageSize = Math.Clamp(pageSize, 1, 100);
            page = Math.Max(page, 1);

            var items = await q.OrderBy(c => c.FullName)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(c => new ContactPartyDto(c.Id, c.Type, c.FullName, c.Phone, c.Email, c.IdNumber, c.Notes))
                .ToListAsync(ct);

            return new PagedResult<ContactPartyDto>(items, page, pageSize, total);
        }

        private async Task<ContactParty> GetOwnedAsync(Guid id, CancellationToken ct)
            => await _contacts.Query()
                   .FirstOrDefaultAsync(c => c.Id == id && c.UserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy đối tác.");

        private static ContactPartyDto ToDto(ContactParty c)
            => new(c.Id, c.Type, c.FullName, c.Phone, c.Email, c.IdNumber, c.Notes);
    }
}
