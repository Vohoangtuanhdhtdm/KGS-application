using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    /// <summary>Đóng các hợp đồng đã quá hạn và trả trạng thái phòng/tài sản về đúng thực tế.
    ///
    /// Trước khi có job này, ContractStatus.Expired KHÔNG BAO GIỜ được gán ở bất kỳ đâu:
    /// hợp đồng hết hạn từ nửa năm trước vẫn mang trạng thái Active, kéo theo AssetUnit
    /// kẹt ở Occupied vĩnh viễn — nghĩa là màn hình "phòng trống cần tìm khách" luôn sai,
    /// và nhánh gia hạn từ trạng thái Expired trong RenewAsync là code không bao giờ chạy tới.
    ///
    /// Chạy hằng ngày, dùng partial index IX_LeaseContracts_Active_EndDate.</summary>
    public sealed class ContractExpiryJob
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<ContractExpiryJob> _logger;

        public ContractExpiryJob(ApplicationDbContext db, ILogger<ContractExpiryJob> logger)
        {
            _db = db; _logger = logger;
        }

        public async Task RunAsync(CancellationToken ct)
        {
            var now = DateTime.UtcNow;

            var expired = await _db.Set<LeaseContract>()
                .Where(c => c.Status == ContractStatus.Active && c.EndDate < now)
                .ToListAsync(ct);

            if (expired.Count == 0) return;

            foreach (var c in expired)
                c.Status = ContractStatus.Expired;

            // Tắt nhắc lịch gắn với các hợp đồng vừa đóng — nếu không, người dùng vẫn
            // bị nhắc thu tiền của một hợp đồng đã kết thúc.
            var expiredIds = expired.Select(c => c.Id).ToList();
            var reminders = await _db.Set<Reminder>()
                .Where(r => r.IsActive
                         && r.LeaseContractId != null
                         && expiredIds.Contains(r.LeaseContractId.Value))
                .ToListAsync(ct);

            foreach (var r in reminders)
                r.IsActive = false;

            // Lưu TRƯỚC khi tính lại tình trạng trống: các truy vấn "còn hợp đồng Active nào
            // khác không" bên dưới phải nhìn thấy trạng thái Expired vừa gán, nếu không
            // chúng sẽ đọc lại chính những hợp đồng này và kết luận sai là vẫn còn khách.
            await _db.SaveChangesAsync(ct);

            await ReleaseUnitsAsync(expired, ct);
            await ReleaseAssetsAsync(expired, ct);

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "ContractExpiryJob: đã đóng {Count} hợp đồng hết hạn, tắt {Reminders} nhắc lịch.",
                expired.Count, reminders.Count);
        }

        /// <summary>Trả phòng về Vacant khi không còn hợp đồng cho thuê nào hiệu lực trên phòng đó.</summary>
        private async Task ReleaseUnitsAsync(List<LeaseContract> expired, CancellationToken ct)
        {
            var unitIds = expired
                .Where(c => c.Direction == ContractDirection.LeaseOut && c.AssetUnitId is not null)
                .Select(c => c.AssetUnitId!.Value)
                .Distinct()
                .ToList();

            if (unitIds.Count == 0) return;

            var stillOccupied = await _db.Set<LeaseContract>()
                .Where(c => c.AssetUnitId != null
                         && unitIds.Contains(c.AssetUnitId.Value)
                         && c.Direction == ContractDirection.LeaseOut
                         && c.Status == ContractStatus.Active)
                .Select(c => c.AssetUnitId!.Value)
                .Distinct()
                .ToListAsync(ct);

            var toRelease = unitIds.Except(stillOccupied).ToList();
            if (toRelease.Count == 0) return;

            var units = await _db.Set<AssetUnit>()
                .Where(u => toRelease.Contains(u.Id) && u.Status == UnitStatus.Occupied)
                .ToListAsync(ct);

            foreach (var u in units)
                u.Status = UnitStatus.Vacant;
        }

        /// <summary>Cập nhật trạng thái tài sản: hết cho thuê nguyên căn thì về Vacant;
        /// hết hợp đồng ĐI THUÊ thì về LeaseEnded (mình không còn quyền sử dụng nữa).</summary>
        private async Task ReleaseAssetsAsync(List<LeaseContract> expired, CancellationToken ct)
        {
            var assetIds = expired.Select(c => c.AssetId).Distinct().ToList();

            var activeByAsset = await _db.Set<LeaseContract>()
                .Where(c => assetIds.Contains(c.AssetId) && c.Status == ContractStatus.Active)
                .Select(c => new { c.AssetId, c.Direction })
                .ToListAsync(ct);

            var assets = await _db.Set<Asset>()
                .Where(a => assetIds.Contains(a.Id))
                .ToListAsync(ct);

            foreach (var asset in assets)
            {
                var hasActiveLeaseOut = activeByAsset
                    .Any(x => x.AssetId == asset.Id && x.Direction == ContractDirection.LeaseOut);
                var hasActiveLeaseIn = activeByAsset
                    .Any(x => x.AssetId == asset.Id && x.Direction == ContractDirection.LeaseIn);

                if (!hasActiveLeaseOut && asset.Status == AssetStatus.RentedOut)
                    asset.Status = AssetStatus.Vacant;

                // Tài sản đi thuê mà hợp đồng với chủ nhà đã hết: không còn quyền sử dụng.
                if (asset.OwnershipType == AssetOwnershipType.Leasehold && !hasActiveLeaseIn)
                    asset.Status = AssetStatus.LeaseEnded;
            }
        }
    }
}
