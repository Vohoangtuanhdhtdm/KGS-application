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
        private readonly IRepository<SaleListingBroker> _listingBrokers;
        private readonly IRepository<MaintenanceRecord> _maintenance;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public ContactPartyService(IRepository<ContactParty> contacts, IRepository<LeaseContract> leaseContracts,
            IRepository<SaleListingBroker> listingBrokers, IRepository<MaintenanceRecord> maintenance,
            IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _contacts = contacts; _contracts = leaseContracts; _listingBrokers = listingBrokers;
            _maintenance = maintenance; _uow = uow; _currentUser = currentUser;
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
                await _contracts.Query().AnyAsync(c => c.CounterpartyId == contactId, ct)
                || await _listingBrokers.Query().AnyAsync(b => b.BrokerId == contactId, ct)
                || await _maintenance.Query().AnyAsync(m => m.VendorId == contactId, ct);
            if (referenced)
                throw new ConflictException("Đối tác đang được tham chiếu bởi hợp đồng / rao bán / sửa chữa — không thể xoá.");

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

    public sealed class MaintenanceService : IMaintenanceService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<MaintenanceRecord> _records;
        private readonly IRepository<CashFlowEntry> _cashFlows;
        private readonly IRepository<ContactParty> _contacts;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public MaintenanceService(IRepository<Asset> assets, IRepository<MaintenanceRecord> records,
            IRepository<CashFlowEntry> cashFlows, IRepository<ContactParty> contacts,
            IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _assets = assets; _records = records; _cashFlows = cashFlows;
            _contacts = contacts; _uow = uow; _currentUser = currentUser;
        }

        public async Task<MaintenanceDto> CreateAsync(Guid assetId, MaintenanceRequest request, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);
            await ValidateVendorAsync(request.VendorId, ct);

            var record = new MaintenanceRecord
            {
                AssetId = assetId,
                AssetUnitId = request.AssetUnitId,
                Title = request.Title.Trim(),
                Description = request.Description,
                StartDate = Utc(request.StartDate),
                CompletedDate = UtcNullable(request.CompletedDate),
                Cost = request.Cost,
                VendorId = request.VendorId,
                Notes = request.Notes
            };
            await _records.AddAsync(record, ct);

            // Ghi chi phí vào sổ cái CÙNG transaction → báo cáo lợi nhuận tự chính xác
            if (request.RecordAsExpense && request.Cost is > 0)
            {
                await _cashFlows.AddAsync(new CashFlowEntry
                {
                    UserId = _currentUser.UserId,
                    AssetId = assetId,
                    AssetUnitId = request.AssetUnitId,
                    Direction = CashFlowDirection.Expense,
                    Category = CashFlowCategory.MaintenanceCost,
                    Amount = request.Cost.Value,
                    OccurredAt = UtcNullable(request.CompletedDate) ?? Utc(request.StartDate),
                    Description = $"Chi phí sửa chữa: {record.Title}"
                }, ct);
            }

            await _uow.SaveChangesAsync(ct);
            return await ProjectOneAsync(record.Id, ct);
        }

        public async Task<MaintenanceDto> UpdateAsync(Guid assetId, Guid recordId, MaintenanceRequest request, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);
            await ValidateVendorAsync(request.VendorId, ct);

            var record = await _records.Query()
                .FirstOrDefaultAsync(r => r.Id == recordId && r.AssetId == assetId, ct)
                ?? throw new NotFoundException("Không tìm thấy lịch sử sửa chữa.");

            record.AssetUnitId = request.AssetUnitId;
            record.Title = request.Title.Trim();
            record.Description = request.Description;
            record.StartDate = Utc(request.StartDate);
            record.CompletedDate = UtcNullable(request.CompletedDate);
            record.Cost = request.Cost;
            record.VendorId = request.VendorId;
            record.Notes = request.Notes;
            // Lưu ý: update KHÔNG tự sửa bút toán đã ghi — sổ cái là append-only,
            // người dùng điều chỉnh bằng bút toán mới (đúng nguyên tắc kế toán).

            await _uow.SaveChangesAsync(ct);
            return await ProjectOneAsync(recordId, ct);
        }

        public async Task DeleteAsync(Guid assetId, Guid recordId, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);

            var record = await _records.Query()
                .FirstOrDefaultAsync(r => r.Id == recordId && r.AssetId == assetId, ct)
                ?? throw new NotFoundException("Không tìm thấy lịch sử sửa chữa.");

            _records.Remove(record);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task<IReadOnlyList<MaintenanceDto>> GetByAssetAsync(Guid assetId, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);

            return await Project(_records.Query().AsNoTracking()
                    .Where(r => r.AssetId == assetId)
                    .OrderByDescending(r => r.StartDate))
                .ToListAsync(ct);
        }

        private async Task EnsureOwnedAssetAsync(Guid assetId, CancellationToken ct)
        {
            var owns = await _assets.Query().AnyAsync(a => a.Id == assetId && a.UserId == _currentUser.UserId, ct);
            if (!owns) throw new NotFoundException("Không tìm thấy tài sản.");
        }

        private async Task ValidateVendorAsync(Guid? vendorId, CancellationToken ct)
        {
            if (vendorId is null) return;
            var ok = await _contacts.Query()
                .AnyAsync(c => c.Id == vendorId && c.UserId == _currentUser.UserId, ct);
            if (!ok) throw new NotFoundException("Không tìm thấy nhà thầu trong sổ đối tác.");
        }

        private async Task<MaintenanceDto> ProjectOneAsync(Guid id, CancellationToken ct)
            => await Project(_records.Query().AsNoTracking().Where(r => r.Id == id)).FirstAsync(ct);

        private static IQueryable<MaintenanceDto> Project(IQueryable<MaintenanceRecord> q) =>
            q.Select(r => new MaintenanceDto(
                r.Id, r.AssetUnitId, r.Title, r.Description,
                r.StartDate, r.CompletedDate, r.Cost,
                r.VendorId, r.Vendor != null ? r.Vendor.FullName : null, r.Notes));

        private static DateTime Utc(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);
        private static DateTime? UtcNullable(DateTime? d) => d is null ? null : Utc(d.Value);
    }

    public sealed class EquipmentService : IEquipmentService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<Equipment> _equipments;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public EquipmentService(IRepository<Asset> assets, IRepository<Equipment> equipments,
            IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _assets = assets; _equipments = equipments; _uow = uow; _currentUser = currentUser;
        }

        public async Task<EquipmentDto> CreateAsync(Guid assetId, EquipmentRequest request, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);

            var equipment = new Equipment
            {
                AssetId = assetId,
                AssetUnitId = request.AssetUnitId,
                Name = request.Name.Trim(),
                Quantity = request.Quantity,
                Condition = request.Condition,
                Source = request.Source,
                Notes = request.Notes
            };

            await _equipments.AddAsync(equipment, ct);
            await _uow.SaveChangesAsync(ct);
            return ToDto(equipment);
        }

        public async Task<EquipmentDto> UpdateAsync(Guid assetId, Guid equipmentId, EquipmentRequest request, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);
            var equipment = await GetAsync(assetId, equipmentId, ct);

            equipment.AssetUnitId = request.AssetUnitId;
            equipment.Name = request.Name.Trim();
            equipment.Quantity = request.Quantity;
            equipment.Condition = request.Condition;
            equipment.Source = request.Source;
            equipment.Notes = request.Notes;

            await _uow.SaveChangesAsync(ct);
            return ToDto(equipment);
        }

        public async Task DeleteAsync(Guid assetId, Guid equipmentId, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);
            var equipment = await GetAsync(assetId, equipmentId, ct);

            _equipments.Remove(equipment);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task<IReadOnlyList<EquipmentDto>> GetByAssetAsync(Guid assetId, Guid? unitId, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);

            var q = _equipments.Query().AsNoTracking().Where(e => e.AssetId == assetId);
            if (unitId is not null) q = q.Where(e => e.AssetUnitId == unitId);

            return await q.OrderBy(e => e.Name)
                .Select(e => new EquipmentDto(e.Id, e.AssetUnitId, e.Name, e.Quantity, e.Condition, e.Source, e.Notes))
                .ToListAsync(ct);
        }

        private async Task EnsureOwnedAssetAsync(Guid assetId, CancellationToken ct)
        {
            var owns = await _assets.Query().AnyAsync(a => a.Id == assetId && a.UserId == _currentUser.UserId, ct);
            if (!owns) throw new NotFoundException("Không tìm thấy tài sản.");
        }

        private async Task<Equipment> GetAsync(Guid assetId, Guid equipmentId, CancellationToken ct)
            => await _equipments.Query().FirstOrDefaultAsync(e => e.Id == equipmentId && e.AssetId == assetId, ct)
               ?? throw new NotFoundException("Không tìm thấy thiết bị.");

        private static EquipmentDto ToDto(Equipment e)
            => new(e.Id, e.AssetUnitId, e.Name, e.Quantity, e.Condition, e.Source, e.Notes);
    }

    public sealed class UsagePeriodService : IUsagePeriodService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<UsagePeriod> _periods;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public UsagePeriodService(IRepository<Asset> assets, IRepository<UsagePeriod> periods,
            IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _assets = assets; _periods = periods; _uow = uow; _currentUser = currentUser;
        }

        public async Task<UsagePeriodDto> CreateAsync(Guid assetId, UsagePeriodRequest request, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);
            ValidateDates(request);

            var period = new UsagePeriod
            {
                AssetId = assetId,
                OccupantType = request.OccupantType,
                OccupantName = request.OccupantName?.Trim(),
                StartDate = Utc(request.StartDate),
                EndDate = UtcNullable(request.EndDate),
                Notes = request.Notes
            };

            await _periods.AddAsync(period, ct);
            await _uow.SaveChangesAsync(ct);
            return ToDto(period);
        }

        public async Task<UsagePeriodDto> UpdateAsync(Guid assetId, Guid periodId, UsagePeriodRequest request, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);
            ValidateDates(request);
            var period = await GetAsync(assetId, periodId, ct);

            period.OccupantType = request.OccupantType;
            period.OccupantName = request.OccupantName?.Trim();
            period.StartDate = Utc(request.StartDate);
            period.EndDate = UtcNullable(request.EndDate);
            period.Notes = request.Notes;

            await _uow.SaveChangesAsync(ct);
            return ToDto(period);
        }

        public async Task DeleteAsync(Guid assetId, Guid periodId, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);
            var period = await GetAsync(assetId, periodId, ct);

            _periods.Remove(period);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task<IReadOnlyList<UsagePeriodDto>> GetByAssetAsync(Guid assetId, CancellationToken ct = default)
        {
            await EnsureOwnedAssetAsync(assetId, ct);

            return await _periods.Query().AsNoTracking()
                .Where(p => p.AssetId == assetId)
                .OrderByDescending(p => p.StartDate)
                .Select(p => new UsagePeriodDto(p.Id, p.OccupantType, p.OccupantName, p.StartDate, p.EndDate, p.Notes))
                .ToListAsync(ct);
        }

        private static void ValidateDates(UsagePeriodRequest request)
        {
            if (request.EndDate is not null && request.EndDate <= request.StartDate)
                throw new ValidationFailedException("Ngày kết thúc phải sau ngày bắt đầu.");
        }

        private async Task EnsureOwnedAssetAsync(Guid assetId, CancellationToken ct)
        {
            var owns = await _assets.Query().AnyAsync(a => a.Id == assetId && a.UserId == _currentUser.UserId, ct);
            if (!owns) throw new NotFoundException("Không tìm thấy tài sản.");
        }

        private async Task<UsagePeriod> GetAsync(Guid assetId, Guid periodId, CancellationToken ct)
            => await _periods.Query().FirstOrDefaultAsync(p => p.Id == periodId && p.AssetId == assetId, ct)
               ?? throw new NotFoundException("Không tìm thấy giai đoạn sử dụng.");

        private static UsagePeriodDto ToDto(UsagePeriod p)
            => new(p.Id, p.OccupantType, p.OccupantName, p.StartDate, p.EndDate, p.Notes);

        private static DateTime Utc(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);
        private static DateTime? UtcNullable(DateTime? d) => d is null ? null : Utc(d.Value);
    }

}
