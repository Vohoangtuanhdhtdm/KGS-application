using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using Microsoft.EntityFrameworkCore;
using kgs_api.Repositories;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;
using kgs_api.Storage;
using kgs_api.Interfaces;

namespace kgs_api.Services
{
    public sealed class CashFlowService : ICashFlowService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<CashFlowEntry> _entries;
        private readonly IUnitOfWork _uow;
        private readonly IFileStorageService _files;
        private readonly ICurrentUserService _currentUser;

        public CashFlowService(IRepository<Asset> assets, IRepository<CashFlowEntry> entries,
            IUnitOfWork uow, IFileStorageService files, ICurrentUserService currentUser)
        {
            _assets = assets; _entries = entries; _uow = uow; _files = files; _currentUser = currentUser;
        }

        public async Task<CashFlowDto> CreateAsync(CashFlowCreateRequest request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            ValidateDirectionCategory(request.Direction, request.Category);

            var asset = await _assets.Query().AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == request.AssetId && a.UserId == userId, ct)
                ?? throw new NotFoundException("Không tìm thấy tài sản.");

            StoredFile? receipt = null;
            if (request.Receipt is not null)
            {
                var isImage = request.Receipt.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
                receipt = isImage
                    ? await _files.UploadImageAsync(request.Receipt, folder: $"receipts/{asset.Id}", ct)
                    : await _files.UploadDocumentAsync(request.Receipt, folder: $"receipts/{asset.Id}", ct);
            }

            var entry = new CashFlowEntry
            {
                UserId = userId,                       // denormalize CÓ CHỦ ĐÍCH — luôn gán từ server
                AssetId = asset.Id,
                AssetUnitId = request.AssetUnitId,
                LeaseContractId = request.LeaseContractId,
                Direction = request.Direction,
                Category = request.Category,
                Amount = request.Amount,
                OccurredAt = DateTime.SpecifyKind(request.OccurredAt, DateTimeKind.Utc),
                PeriodStart = SpecifyUtc(request.PeriodStart),
                PeriodEnd = SpecifyUtc(request.PeriodEnd),
                Description = request.Description,
                Receipt = receipt
            };

            await _entries.AddAsync(entry, ct);
            await _uow.SaveChangesAsync(ct);

            return new CashFlowDto(entry.Id, asset.Id, asset.Name, entry.AssetUnitId, entry.LeaseContractId,
                entry.Direction, entry.Category, entry.Amount, entry.OccurredAt,
                entry.PeriodStart, entry.PeriodEnd, entry.Description,
                receipt is null ? null : new StoredFileDto(receipt.Url, receipt.FileName, receipt.ContentType, receipt.SizeBytes));
        }

        /// <summary>Keyset pagination trên (OccurredAt DESC, Id DESC) — chi phí trang thứ 1000
        /// bằng trang thứ 1, không như OFFSET.</summary>
        public async Task<KeysetPage<CashFlowDto>> ListAsync(CashFlowQuery query, CancellationToken ct = default)
        {
            var q = _entries.Query().AsNoTracking()
                .Where(e => e.UserId == _currentUser.UserId);

            if (query.AssetId is not null) q = q.Where(e => e.AssetId == query.AssetId);
            if (query.Direction is not null) q = q.Where(e => e.Direction == query.Direction);
            if (query.Category is not null) q = q.Where(e => e.Category == query.Category);
            if (query.From is not null) q = q.Where(e => e.OccurredAt >= SpecifyUtc(query.From));
            if (query.To is not null) q = q.Where(e => e.OccurredAt < SpecifyUtc(query.To));

            var cursor = CashFlowCursor.Decode(query.Cursor);
            if (cursor is not null)
            {
                var (cAt, cId) = cursor.Value;
                q = q.Where(e => e.OccurredAt < cAt
                              || (e.OccurredAt == cAt && e.Id.CompareTo(cId) < 0));
            }

            var pageSize = Math.Clamp(query.PageSize, 1, 100);

            var items = await q
                .OrderByDescending(e => e.OccurredAt).ThenByDescending(e => e.Id)
                .Take(pageSize + 1) // lấy dư 1 để biết còn trang sau không
                .Select(e => new CashFlowDto(
                    e.Id, e.AssetId, e.Asset.Name, e.AssetUnitId, e.LeaseContractId,
                    e.Direction, e.Category, e.Amount, e.OccurredAt,
                    e.PeriodStart, e.PeriodEnd, e.Description,
                    e.Receipt == null ? null
                        : new StoredFileDto(e.Receipt.Url, e.Receipt.FileName, e.Receipt.ContentType, e.Receipt.SizeBytes)))
                .ToListAsync(ct);

            string? nextCursor = null;
            if (items.Count > pageSize)
            {
                items.RemoveAt(pageSize);
                var last = items[^1];
                nextCursor = CashFlowCursor.Encode(last.OccurredAt, last.Id);
            }

            return new KeysetPage<CashFlowDto>(items, nextCursor);
        }

        public async Task DeleteAsync(Guid entryId, CancellationToken ct = default)
        {
            var entry = await _entries.Query()
                .FirstOrDefaultAsync(e => e.Id == entryId && e.UserId == _currentUser.UserId, ct)
                ?? throw new NotFoundException("Không tìm thấy bút toán.");

            _files.ScheduleDeletion(entry.Receipt);
            _entries.Remove(entry);
            await _uow.SaveChangesAsync(ct);
        }

        private static void ValidateDirectionCategory(CashFlowDirection direction, CashFlowCategory category)
        {
            var isIncomeCategory = category is CashFlowCategory.RentIncome
                or CashFlowCategory.DepositReceived or CashFlowCategory.SaleProceeds;

            if (direction == CashFlowDirection.Income && !isIncomeCategory)
                throw new ValidationFailedException($"Loại '{category}' không phải khoản thu.");
            if (direction == CashFlowDirection.Expense && isIncomeCategory)
                throw new ValidationFailedException($"Loại '{category}' không phải khoản chi.");
        }

        private static DateTime? SpecifyUtc(DateTime? d)
            => d is null ? null : DateTime.SpecifyKind(d.Value, DateTimeKind.Utc);
    }
    

    public sealed class ReportService : IReportService
    {
        private readonly IRepository<CashFlowEntry> _entries;
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<LeaseContract> _contracts;
        private readonly IRepository<Listing> _listings;
        private readonly ICurrentUserService _currentUser;

        /// <summary>Các loại thuế gộp vào báo cáo thuế theo năm.</summary>
        private static readonly CashFlowCategory[] TaxCategories =
        {
            CashFlowCategory.RegistrationTax,
            CashFlowCategory.NonAgriculturalLandTax,
            CashFlowCategory.BusinessLicenseTax,
            CashFlowCategory.PersonalIncomeTax,
            CashFlowCategory.ValueAddedTax,
            CashFlowCategory.OtherTax
        };

        /// <summary>Tiền cọc — nhận rồi phải trả lại, không vào báo cáo lãi/lỗ.</summary>
        private static bool IsDeposit(CashFlowCategory category)
            => category is CashFlowCategory.DepositReceived or CashFlowCategory.DepositPaid;

        public ReportService(
            IRepository<CashFlowEntry> entries,
            IRepository<Asset> assets,
            IRepository<LeaseContract> contracts,
            IRepository<Listing> listings,
            ICurrentUserService currentUser)
        {
            _entries = entries; _assets = assets; _contracts = contracts;
            _listings = listings; _currentUser = currentUser;
        }

        public async Task<IncomeReportDto> GetIncomeReportAsync(IncomeReportQuery query, CancellationToken ct = default)
        {
            var from = DateTime.SpecifyKind(query.From, DateTimeKind.Utc);
            var to = DateTime.SpecifyKind(query.To, DateTimeKind.Utc);
            if (to <= from) throw new ValidationFailedException("Khoảng thời gian không hợp lệ.");

            var q = _entries.Query().AsNoTracking()
                .Where(e => e.UserId == _currentUser.UserId
                         && e.Category == CashFlowCategory.RentIncome
                         && e.OccurredAt >= from && e.OccurredAt < to);

            if (query.AssetId is not null)
                q = q.Where(e => e.AssetId == query.AssetId);

            // Bước 1 — group + sum, CHỈ trả kiểu vô danh nguyên thuỷ, dịch SQL được
            var grouped = await q
                .GroupBy(e => new { e.OccurredAt.Year, e.OccurredAt.Month })
                .Select(g => new { g.Key.Year, g.Key.Month, Amount = g.Sum(x => x.Amount) })
                .ToListAsync(ct);   // ← SQL chạy TỚI ĐÂY, dữ liệu đã về RAM

            // Bước 2 — map sang DTO + sắp xếp bằng LINQ-to-Objects (không còn là SQL)
            var byMonth = grouped
                .OrderBy(m => m.Year).ThenBy(m => m.Month)
                .Select(m => new MonthlyAmountDto(m.Year, m.Month, m.Amount))
                .ToList();

            return new IncomeReportDto(from, to, byMonth.Sum(m => m.Amount), byMonth);
        }

        public async Task<ProfitReportDto> GetProfitReportAsync(ProfitReportQuery query, CancellationToken ct = default)
        {
            var from = DateTime.SpecifyKind(query.From, DateTimeKind.Utc);
            var to = DateTime.SpecifyKind(query.To, DateTimeKind.Utc);
            if (to <= from) throw new ValidationFailedException("Khoảng thời gian không hợp lệ.");

            var assetName = await _assets.Query().AsNoTracking()
                .Where(a => a.Id == query.AssetId && a.UserId == _currentUser.UserId)
                .Select(a => a.Name)
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("Không tìm thấy tài sản.");

            // Index (AssetId, OccurredAt) → một lần quét khoảng, group 2 chiều.
            // Lọc thêm UserId: quyền sở hữu đã được kiểm ở truy vấn assetName phía trên,
            // nhưng lọc lại ở đây là phòng thủ theo chiều sâu — nếu ai đó sửa đoạn trên,
            // báo cáo vẫn không rò rỉ dữ liệu của user khác.
            var breakdown = await _entries.Query().AsNoTracking()
                .Where(e => e.AssetId == query.AssetId
                         && e.UserId == _currentUser.UserId
                         && e.OccurredAt >= from && e.OccurredAt < to)
                .GroupBy(e => new { e.Direction, e.Category })
                .Select(g => new { g.Key.Direction, g.Key.Category, Amount = g.Sum(x => x.Amount) })
                .ToListAsync(ct);

            // Tiền cọc là khoản phải trả lại, không phải doanh thu/chi phí — tách khỏi P&L.
            // Cộng cọc vào lợi nhuận sẽ thổi phồng con số "lãi thật" mà cả sản phẩm đang bán.
            var deposits = breakdown.Where(b => IsDeposit(b.Category)).ToList();
            var pnl = breakdown.Where(b => !IsDeposit(b.Category)).ToList();

            var income = pnl.Where(b => b.Direction == CashFlowDirection.Income)
                .Select(b => new CategoryAmountDto(b.Category, b.Amount))
                .OrderByDescending(b => b.Amount).ToList();
            var expense = pnl.Where(b => b.Direction == CashFlowDirection.Expense)
                .Select(b => new CategoryAmountDto(b.Category, b.Amount))
                .OrderByDescending(b => b.Amount).ToList();

            var totalIncome = income.Sum(x => x.Amount);
            var totalExpense = expense.Sum(x => x.Amount);

            // Cọc đang giữ = đã nhận của khách thuê − đã đặt cho chủ nhà.
            // Âm nghĩa là đang đặt cọc ra ngoài nhiều hơn nhận vào (thường gặp ở tài sản Leasehold).
            var depositHeld =
                deposits.Where(d => d.Category == CashFlowCategory.DepositReceived).Sum(d => d.Amount)
              - deposits.Where(d => d.Category == CashFlowCategory.DepositPaid).Sum(d => d.Amount);

            return new ProfitReportDto(query.AssetId, assetName, from, to,
                totalIncome, totalExpense, totalIncome - totalExpense, income, expense, depositHeld);
        }

        // ==================== C5. BÀN VẬN HÀNH ====================

        public async Task<OperationsDashboardDto> GetOperationsDashboardAsync(
            int year, int month, CancellationToken ct = default)
        {
            if (year < 2000 || year > DateTime.UtcNow.Year + 1 || month < 1 || month > 12)
                throw new ValidationFailedException("Tháng hoặc năm không hợp lệ.");

            var userId = _currentUser.UserId;
            var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            var to = from.AddMonths(1);

            // ---- Dòng tiền trong kỳ ----
            var grouped = await _entries.Query().AsNoTracking()
                .Where(e => e.UserId == userId && e.OccurredAt >= from && e.OccurredAt < to)
                .GroupBy(e => new { e.Direction, e.Category })
                .Select(g => new { g.Key.Direction, g.Key.Category, Amount = g.Sum(x => x.Amount) })
                .ToListAsync(ct);

            decimal Sum(CashFlowCategory c) => grouped.Where(g => g.Category == c).Sum(g => g.Amount);

            var rentIncome = Sum(CashFlowCategory.RentIncome);
            var rentExpense = Sum(CashFlowCategory.RentExpense);

            // Cọc không phải doanh thu/chi phí — loại khỏi P&L, báo riêng.
            var income = grouped.Where(g => g.Direction == CashFlowDirection.Income && !IsDeposit(g.Category))
                                .Sum(g => g.Amount);
            var expense = grouped.Where(g => g.Direction == CashFlowDirection.Expense && !IsDeposit(g.Category))
                                 .Sum(g => g.Amount);

            var depositHeld = Sum(CashFlowCategory.DepositReceived) - Sum(CashFlowCategory.DepositPaid);

            // ---- Tình trạng lấp đầy ----
            // Đếm theo PHÒNG. Tài sản không chia phòng được tính như một "phòng" duy nhất,
            // nếu không thì nhà phố cho thuê nguyên căn sẽ biến mất khỏi tỉ lệ lấp đầy.
            var unitRows = await _assets.Query().AsNoTracking()
                .Where(a => a.UserId == userId && a.Status != AssetStatus.Sold)
                .SelectMany(a => a.Units.Select(u => new
                {
                    a.Id,
                    AssetName = a.Name,
                    UnitId = (Guid?)u.Id,
                    UnitName = u.Name,
                    u.Area,
                    u.Status
                }))
                .ToListAsync(ct);

            var wholeAssetRows = await _assets.Query().AsNoTracking()
                .Where(a => a.UserId == userId && a.Status != AssetStatus.Sold && !a.Units.Any())
                .Select(a => new
                {
                    a.Id,
                    AssetName = a.Name,
                    UnitId = (Guid?)null,
                    UnitName = "Nguyên căn",
                    a.Area,
                    Status = a.Status == AssetStatus.RentedOut ? UnitStatus.Occupied : UnitStatus.Vacant
                })
                .ToListAsync(ct);

            var allSlots = unitRows.Concat(wholeAssetRows).ToList();

            var occupied = allSlots.Count(x => x.Status == UnitStatus.Occupied);
            var maintenance = allSlots.Count(x => x.Status == UnitStatus.UnderMaintenance);
            var vacantSlots = allSlots.Where(x => x.Status == UnitStatus.Vacant).ToList();

            // ---- Phòng trống từ bao giờ, và đã có tin đăng chưa ----
            // "Trống bao lâu" = hết hợp đồng cho thuê gần nhất. Đây là số ngày doanh thu
            // đang chảy mất, nên hiện ra mới thúc được người dùng hành động.
            var vacantUnitIds = vacantSlots.Where(x => x.UnitId != null).Select(x => x.UnitId!.Value).ToList();
            var vacantAssetIds = vacantSlots.Select(x => x.Id).Distinct().ToList();

            var contractEnds = await _contracts.Query().AsNoTracking()
                .Where(c => c.Direction == ContractDirection.LeaseOut
                         && c.Asset.UserId == userId
                         && (c.Status == ContractStatus.Expired || c.Status == ContractStatus.Terminated)
                         && (c.AssetUnitId == null
                             ? vacantAssetIds.Contains(c.AssetId)
                             : vacantUnitIds.Contains(c.AssetUnitId.Value)))
                .Select(c => new { c.AssetId, c.AssetUnitId, c.EndDate })
                .ToListAsync(ct);

            var liveListingSlots = await _listings.Query().AsNoTracking()
                .Where(l => l.Asset.UserId == userId
                         && (l.Status == ListingStatus.Pending || l.Status == ListingStatus.Approved))
                .Select(l => new { l.AssetId, l.AssetUnitId })
                .ToListAsync(ct);

            var vacantUnits = vacantSlots
                .Select(x =>
                {
                    var since = contractEnds
                        .Where(c => c.AssetUnitId == x.UnitId && c.AssetId == x.Id)
                        .Select(c => (DateTime?)c.EndDate)
                        .DefaultIfEmpty(null)
                        .Max();

                    var hasListing = liveListingSlots
                        .Any(l => l.AssetId == x.Id && l.AssetUnitId == x.UnitId);

                    return new VacantUnitDto(x.Id, x.AssetName, x.UnitId, x.UnitName, x.Area, since, hasListing);
                })
                .OrderBy(v => v.VacantSince ?? DateTime.MaxValue)   // trống lâu nhất lên đầu
                .ToList();

            return new OperationsDashboardDto(
                from, to,
                rentIncome, rentExpense, expense - rentExpense, income - expense, depositHeld,
                allSlots.Count, occupied, vacantSlots.Count, maintenance,
                vacantUnits);
        }

        public async Task<TaxReportDto> GetTaxReportAsync(int year, CancellationToken ct = default)
        {
            if (year < 2000 || year > DateTime.UtcNow.Year + 1)
                throw new ValidationFailedException("Năm không hợp lệ.");

            var from = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var to = from.AddYears(1);

            // Bước 1 — group + sum, kiểu vô danh nguyên thuỷ.
            // Danh sách TƯỜNG MINH thay cho khoảng số enum (>= RegistrationTax && <= OtherTax):
            // thêm một category mới vào khoảng 20–29 mà quên là báo cáo thuế sai âm thầm.
            var grouped = await _entries.Query().AsNoTracking()
                .Where(e => e.UserId == _currentUser.UserId
                         && TaxCategories.Contains(e.Category)
                         && e.OccurredAt >= from && e.OccurredAt < to)
                .GroupBy(e => e.Category)
                .Select(g => new { Category = g.Key, Amount = g.Sum(x => x.Amount) })
                .ToListAsync(ct);   // ← SQL chạy TỚI ĐÂY

            // Bước 2 — map + sắp xếp trong C#
            var byType = grouped
                .OrderByDescending(x => x.Amount)
                .Select(x => new CategoryAmountDto(x.Category, x.Amount))
                .ToList();

            return new TaxReportDto(year, byType.Sum(x => x.Amount), byType);
        }
    }
}
