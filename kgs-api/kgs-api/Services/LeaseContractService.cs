using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;   
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    public sealed class LeaseContractService : ILeaseContractService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<AssetUnit> _units;
        private readonly IRepository<LeaseContract> _contracts;
        private readonly IRepository<ContactParty> _contacts;
        private readonly IRepository<Reminder> _reminders;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public LeaseContractService(
            IRepository<Asset> assets, IRepository<AssetUnit> units,
            IRepository<LeaseContract> contracts, IRepository<ContactParty> contacts,
            IRepository<Reminder> reminders, IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _assets = assets; _units = units; _contracts = contracts;
            _contacts = contacts; _reminders = reminders; _uow = uow; _currentUser = currentUser;
        }

        // ==================== B2. TẠO HỢP ĐỒNG ====================
        // Một luồng cho cả 4 kịch bản của tài liệu nghiệp vụ:
        //   LeaseOut + AssetUnitId=null  → cho thuê nguyên căn
        //   LeaseOut + AssetUnitId=X     → cho thuê tầng/phòng
        //   LeaseIn  + AssetUnitId=null  → đi thuê từ chủ nhà
        //   (LeaseIn theo unit hiếm gặp nhưng không cấm)

        public async Task<LeaseContractDto> CreateAsync(LeaseContractCreateRequest request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            var start = EnsureUtc(request.StartDate);
            var end = EnsureUtc(request.EndDate);

            var asset = await _assets.Query()
                .FirstOrDefaultAsync(a => a.Id == request.AssetId && a.UserId == userId, ct)
                ?? throw new NotFoundException("Không tìm thấy tài sản.");

            if (request.Direction == ContractDirection.LeaseIn && asset.OwnershipType != AssetOwnershipType.Leasehold)
                throw new ValidationFailedException("Hợp đồng đi thuê (LeaseIn) chỉ áp dụng cho tài sản loại Leasehold.");

            AssetUnit? unit = null;
            if (request.AssetUnitId is not null)
            {
                unit = await _units.Query()
                    .FirstOrDefaultAsync(u => u.Id == request.AssetUnitId && u.AssetId == asset.Id, ct)
                    ?? throw new NotFoundException("Không tìm thấy tầng/phòng thuộc tài sản này.");
            }

            var counterpartyExists = await _contacts.Query()
                .AnyAsync(c => c.Id == request.CounterpartyId && c.UserId == userId, ct);
            if (!counterpartyExists)
                throw new NotFoundException("Không tìm thấy đối tác (người thuê / chủ nhà).");

            // Toàn bộ quy tắc kỳ hạn nằm trong ContractPeriodValidator: chồng kỳ hạn,
            // xung đột nguyên căn ↔ phòng, và ràng buộc cho thuê lại không vượt quá
            // hạn hợp đồng đi thuê với chủ nhà.
            var activeSlots = await LoadActiveSlotsAsync(asset.Id, ct);
            ContractPeriodValidator.EnsureCanPlace(
                activeSlots, asset.OwnershipType, request.Direction,
                request.AssetUnitId, start, end);

            var contract = new LeaseContract
            {
                AssetId = asset.Id,
                AssetUnitId = unit?.Id,
                Direction = request.Direction,
                Status = request.ActivateImmediately ? ContractStatus.Active : ContractStatus.Draft,
                CounterpartyId = request.CounterpartyId,
                StartDate = start,
                EndDate = end,
                RentAmount = request.RentAmount,
                PaymentCycle = request.PaymentCycle,
                PaymentDueDay = request.PaymentDueDay,
                DepositAmount = request.DepositAmount,
                NextRentIncreaseDate = EnsureUtcNullable(request.NextRentIncreaseDate),
                TaxResponsibility = request.TaxResponsibility,
                Notes = request.Notes
            };
            await _contracts.AddAsync(contract, ct);

            if (contract.Status == ContractStatus.Active)
            {
                ApplyActivationSideEffects(asset, unit, contract.Direction);
                await CreateContractRemindersAsync(contract, asset.Name, unit?.Name, ct);
            }

            await _uow.SaveChangesAsync(ct); // một transaction: HĐ + trạng thái + reminders
            return await GetByIdAsync(contract.Id, ct);
        }

        // ==================== B3a. GIA HẠN (chuỗi ParentContractId) ====================

        public async Task<LeaseContractDto> RenewAsync(Guid contractId, LeaseContractRenewRequest request, CancellationToken ct = default)
        {
            var old = await GetOwnedContractAsync(contractId, ct);

            if (old.Status is not (ContractStatus.Active or ContractStatus.Expired))
                throw new ConflictException("Chỉ gia hạn được hợp đồng đang hiệu lực hoặc vừa hết hạn.");

            var start = EnsureUtc(request.NewStartDate);
            var end = EnsureUtc(request.NewEndDate);

            // Trước đây luồng gia hạn KHÔNG kiểm tra kỳ hạn — gia hạn có thể đè lên một
            // hợp đồng khác đã ký sẵn cho cùng phòng. Loại trừ chính HĐ đang gia hạn vì
            // nó sắp chuyển sang trạng thái Renewed.
            var ownership = await _assets.Query().AsNoTracking()
                .Where(a => a.Id == old.AssetId)
                .Select(a => a.OwnershipType)
                .FirstAsync(ct);

            var activeSlots = await LoadActiveSlotsAsync(old.AssetId, ct);
            ContractPeriodValidator.EnsureCanPlace(
                activeSlots, ownership, old.Direction,
                old.AssetUnitId, start, end, excludeContractId: old.Id);

            var renewed = new LeaseContract
            {
                AssetId = old.AssetId,
                AssetUnitId = old.AssetUnitId,
                Direction = old.Direction,
                Status = ContractStatus.Active,
                CounterpartyId = old.CounterpartyId,
                StartDate = start,
                EndDate = end,
                RentAmount = request.NewRentAmount,
                PaymentCycle = old.PaymentCycle,
                PaymentDueDay = old.PaymentDueDay,
                DepositAmount = old.DepositAmount,
                NextRentIncreaseDate = EnsureUtcNullable(request.NextRentIncreaseDate),
                TaxResponsibility = old.TaxResponsibility,
                ParentContractId = old.Id,          // giữ chuỗi lịch sử: HĐ gốc → phụ lục → phụ lục...
                Notes = request.Notes
            };
            await _contracts.AddAsync(renewed, ct);

            old.Status = ContractStatus.Renewed;
            await DeactivateContractRemindersAsync(old.Id, ct);

            var (assetName, unitName) = await GetNamesAsync(old.AssetId, old.AssetUnitId, ct);
            await CreateContractRemindersAsync(renewed, assetName, unitName, ct);

            await _uow.SaveChangesAsync(ct);
            return await GetByIdAsync(renewed.Id, ct);
        }

        // ==================== B3b. CHẤM DỨT ====================

        public async Task TerminateAsync(Guid contractId, LeaseContractTerminateRequest request, CancellationToken ct = default)
        {
            var contract = await GetOwnedContractAsync(contractId, ct);
            if (contract.Status != ContractStatus.Active)
                throw new ConflictException("Chỉ chấm dứt được hợp đồng đang hiệu lực.");

            contract.Status = ContractStatus.Terminated;
            contract.Notes = string.IsNullOrWhiteSpace(request.Reason)
                ? contract.Notes
                : $"{contract.Notes}\n[Chấm dứt {EnsureUtc(request.TerminatedAt):yyyy-MM-dd}] {request.Reason}".Trim();

            await DeactivateContractRemindersAsync(contract.Id, ct);

            // Trả trạng thái Asset / Unit về Vacant nếu không còn HĐ LeaseOut nào khác đang hiệu lực
            if (contract.Direction == ContractDirection.LeaseOut)
            {
                if (contract.AssetUnitId is not null)
                {
                    var unit = await _units.FindAsync(contract.AssetUnitId.Value, ct);
                    if (unit is not null) unit.Status = UnitStatus.Vacant;
                }

                var otherActive = await _contracts.Query().AnyAsync(c =>
                    c.AssetId == contract.AssetId
                    && c.Id != contract.Id
                    && c.Direction == ContractDirection.LeaseOut
                    && c.Status == ContractStatus.Active, ct);

                if (!otherActive)
                {
                    var asset = await _assets.FindAsync(contract.AssetId, ct);
                    if (asset is not null && asset.Status == AssetStatus.RentedOut)
                        asset.Status = AssetStatus.Vacant;
                }
            }

            await _uow.SaveChangesAsync(ct);
        }

        // ==================== B4. HĐ SẮP HẾT HẠN ====================

        public async Task<IReadOnlyList<ExpiringContractDto>> GetExpiringAsync(int withinDays, CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;
            var limit = now.AddDays(Math.Clamp(withinDays, 1, 365));

            // Dùng partial index IX_LeaseContracts_Active_EndDate
            var rows = await _contracts.Query().AsNoTracking()
                .Where(c => c.Asset.UserId == _currentUser.UserId
                         && c.Status == ContractStatus.Active
                         && c.EndDate >= now && c.EndDate <= limit)
                .OrderBy(c => c.EndDate)
                .Select(c => new
                {
                    c.Id,
                    c.AssetId,
                    AssetName = c.Asset.Name,
                    UnitName = c.AssetUnit != null ? c.AssetUnit.Name : null,
                    c.Direction,
                    CounterpartyName = c.Counterparty.FullName,
                    c.EndDate
                })
                .ToListAsync(ct);

            // DaysLeft tính sau khi materialize — tránh hàm date-diff đặc thù từng DB provider
            return rows.Select(r => new ExpiringContractDto(
                    r.Id, r.AssetId, r.AssetName, r.UnitName,
                    r.Direction, r.CounterpartyName, r.EndDate,
                    (int)Math.Ceiling((r.EndDate - now).TotalDays)))
                .ToList();
        }

        // ==================== B5 / đọc ====================

        public async Task<LeaseContractDto> GetByIdAsync(Guid contractId, CancellationToken ct = default)
        {
            var dto = await ProjectDto(_contracts.Query().AsNoTracking()
                    .Where(c => c.Id == contractId && c.Asset.UserId == _currentUser.UserId))
                .FirstOrDefaultAsync(ct);
            return dto ?? throw new NotFoundException("Không tìm thấy hợp đồng.");
        }

        public async Task<PagedResult<LeaseContractDto>> SearchAsync(LeaseContractSearchQuery query, CancellationToken ct = default)
        {
            var q = _contracts.Query().AsNoTracking()
                .Where(c => c.Asset.UserId == _currentUser.UserId);

            if (query.AssetId is not null) q = q.Where(c => c.AssetId == query.AssetId);
            if (query.AssetUnitId is not null) q = q.Where(c => c.AssetUnitId == query.AssetUnitId);
            if (query.Direction is not null) q = q.Where(c => c.Direction == query.Direction);
            if (query.Status is not null) q = q.Where(c => c.Status == query.Status);

            var total = await q.CountAsync(ct);
            var pageSize = Math.Clamp(query.PageSize, 1, 100);
            var page = Math.Max(query.Page, 1);

            var items = await ProjectDto(q.OrderByDescending(c => c.StartDate))
                .Skip((page - 1) * pageSize).Take(pageSize)
                .ToListAsync(ct);

            return new PagedResult<LeaseContractDto>(items, page, pageSize, total);
        }

        // ==================== Helpers ====================

        private static IQueryable<LeaseContractDto> ProjectDto(IQueryable<LeaseContract> q) =>
            q.Select(c => new LeaseContractDto(
                c.Id, c.AssetId, c.Asset.Name,
                c.AssetUnitId, c.AssetUnit != null ? c.AssetUnit.Name : null,
                c.Direction, c.Status,
                c.CounterpartyId, c.Counterparty.FullName, c.Counterparty.Phone,
                c.StartDate, c.EndDate, c.RentAmount,
                c.PaymentCycle, c.PaymentDueDay, c.DepositAmount,
                c.NextRentIncreaseDate, c.TaxResponsibility,
                c.ParentContractId, c.Notes));

        /// <summary>Nạp mọi hợp đồng Active của một tài sản dưới dạng ContractSlot cho validator.
        /// Materialize bằng kiểu vô danh rồi map sau — giữ đúng quy ước đã áp dụng ở các
        /// truy vấn khác trong dự án, tránh dựng struct trong biểu thức dịch sang SQL.</summary>
        private async Task<IReadOnlyList<ContractSlot>> LoadActiveSlotsAsync(Guid assetId, CancellationToken ct)
        {
            var rows = await _contracts.Query().AsNoTracking()
                .Where(c => c.AssetId == assetId && c.Status == ContractStatus.Active)
                .Select(c => new { c.Id, c.Direction, c.AssetUnitId, c.StartDate, c.EndDate })
                .ToListAsync(ct);

            return rows
                .Select(r => new ContractSlot(r.Id, r.Direction, r.AssetUnitId, r.StartDate, r.EndDate))
                .ToList();
        }

        private async Task<LeaseContract> GetOwnedContractAsync(Guid contractId, CancellationToken ct)
            => await _contracts.Query()
                   .FirstOrDefaultAsync(c => c.Id == contractId && c.Asset.UserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy hợp đồng.");

        private static void ApplyActivationSideEffects(Asset asset, AssetUnit? unit, ContractDirection direction)
        {
            if (direction != ContractDirection.LeaseOut) return;
            if (unit is not null) unit.Status = UnitStatus.Occupied;
            else asset.Status = AssetStatus.RentedOut;
        }

        /// <summary>Tự sinh 2 reminder cho mỗi HĐ Active:
        /// (1) thu tiền (LeaseOut) / đóng tiền cho chủ nhà (LeaseIn) — lặp theo chu kỳ thanh toán;
        /// (2) hết hạn HĐ — một lần, báo trước 30 ngày.</summary>
        private async Task CreateContractRemindersAsync(LeaseContract c, string assetName, string? unitName, CancellationToken ct)
        {
            var target = unitName is null ? assetName : $"{assetName} — {unitName}";
            var isLeaseOut = c.Direction == ContractDirection.LeaseOut;

            var rentReminder = new Reminder
            {
                UserId = _currentUser.UserId,
                AssetId = c.AssetId,
                LeaseContractId = c.Id,
                Type = isLeaseOut ? ReminderType.RentCollection : ReminderType.RentPayment,
                Title = isLeaseOut ? $"Thu tiền thuê: {target}" : $"Đóng tiền thuê cho chủ nhà: {target}",
                DueDate = FirstDueDate(c.StartDate, c.PaymentDueDay),
                Cycle = ToRecurrence(c.PaymentCycle),
                NotifyDaysBefore = 3,
                IsActive = true
            };

            var expiryReminder = new Reminder
            {
                UserId = _currentUser.UserId,
                AssetId = c.AssetId,
                LeaseContractId = c.Id,
                Type = ReminderType.ContractExpiry,
                Title = $"Hợp đồng sắp hết hạn (cần tái ký/phụ lục): {target}",
                DueDate = c.EndDate,
                Cycle = RecurrenceCycle.None,
                NotifyDaysBefore = 30,
                IsActive = true
            };

            await _reminders.AddRangeAsync(new[] { rentReminder, expiryReminder }, ct);
        }

        private async Task DeactivateContractRemindersAsync(Guid contractId, CancellationToken ct)
        {
            var list = await _reminders.Query()
                .Where(r => r.LeaseContractId == contractId && r.IsActive)
                .ToListAsync(ct);
            foreach (var r in list) r.IsActive = false;
        }

        private async Task<(string AssetName, string? UnitName)> GetNamesAsync(Guid assetId, Guid? unitId, CancellationToken ct)
        {
            var assetName = await _assets.Query().Where(a => a.Id == assetId)
                .Select(a => a.Name).FirstAsync(ct);
            string? unitName = unitId is null ? null
                : await _units.Query().Where(u => u.Id == unitId).Select(u => u.Name).FirstOrDefaultAsync(ct);
            return (assetName, unitName);
        }

        /// <summary>Ngày đến hạn đầu tiên ≥ StartDate, rơi vào PaymentDueDay (clamp theo số ngày của tháng).</summary>
        internal static DateTime FirstDueDate(DateTime start, int dueDay)
        {
            var d = new DateTime(start.Year, start.Month,
                Math.Min(dueDay, DateTime.DaysInMonth(start.Year, start.Month)), 0, 0, 0, DateTimeKind.Utc);
            if (d < start.Date)
            {
                var next = start.AddMonths(1);
                d = new DateTime(next.Year, next.Month,
                    Math.Min(dueDay, DateTime.DaysInMonth(next.Year, next.Month)), 0, 0, 0, DateTimeKind.Utc);
            }
            return d;
        }

        private static RecurrenceCycle ToRecurrence(PaymentCycle cycle) => cycle switch
        {
            PaymentCycle.Monthly => RecurrenceCycle.Monthly,
            PaymentCycle.Quarterly => RecurrenceCycle.Quarterly,
            PaymentCycle.SemiAnnually => RecurrenceCycle.SemiAnnually,
            PaymentCycle.Annually => RecurrenceCycle.Annually,
            _ => RecurrenceCycle.Monthly
        };

        private static DateTime EnsureUtc(DateTime d) => DateTime.SpecifyKind(d, DateTimeKind.Utc);
        private static DateTime? EnsureUtcNullable(DateTime? d) => d is null ? null : EnsureUtc(d.Value);
    }
}
