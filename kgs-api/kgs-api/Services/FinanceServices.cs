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
        private readonly ICurrentUserService _currentUser;

        public ReportService(IRepository<CashFlowEntry> entries, IRepository<Asset> assets, ICurrentUserService currentUser)
        {
            _entries = entries; _assets = assets; _currentUser = currentUser;
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

            // Index (AssetId, OccurredAt) → một lần quét khoảng, group 2 chiều
            var breakdown = await _entries.Query().AsNoTracking()
                .Where(e => e.AssetId == query.AssetId
                         && e.OccurredAt >= from && e.OccurredAt < to)
                .GroupBy(e => new { e.Direction, e.Category })
                .Select(g => new { g.Key.Direction, g.Key.Category, Amount = g.Sum(x => x.Amount) })
                .ToListAsync(ct);

            var income = breakdown.Where(b => b.Direction == CashFlowDirection.Income)
                .Select(b => new CategoryAmountDto(b.Category, b.Amount))
                .OrderByDescending(b => b.Amount).ToList();
            var expense = breakdown.Where(b => b.Direction == CashFlowDirection.Expense)
                .Select(b => new CategoryAmountDto(b.Category, b.Amount))
                .OrderByDescending(b => b.Amount).ToList();

            var totalIncome = income.Sum(x => x.Amount);
            var totalExpense = expense.Sum(x => x.Amount);

            return new ProfitReportDto(query.AssetId, assetName, from, to,
                totalIncome, totalExpense, totalIncome - totalExpense, income, expense);
        }

        public async Task<TaxReportDto> GetTaxReportAsync(int year, CancellationToken ct = default)
        {
            if (year < 2000 || year > DateTime.UtcNow.Year + 1)
                throw new ValidationFailedException("Năm không hợp lệ.");

            var from = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var to = from.AddYears(1);

            // Bước 1 — group + sum, kiểu vô danh nguyên thuỷ
            var grouped = await _entries.Query().AsNoTracking()
                .Where(e => e.UserId == _currentUser.UserId
                         && e.Category >= CashFlowCategory.RegistrationTax
                         && e.Category <= CashFlowCategory.OtherTax
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
