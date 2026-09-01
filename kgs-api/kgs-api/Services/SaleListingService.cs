using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace kgs_api.Services
{
    public sealed class SaleListingService : ISaleListingService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<SaleListing> _listings;
        private readonly IRepository<SaleListingBroker> _brokers;
        private readonly IRepository<ContactParty> _contacts;
        private readonly IRepository<Property> _properties;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public SaleListingService(IRepository<Asset> assets, IRepository<SaleListing> listings,
            IRepository<SaleListingBroker> brokers, IRepository<ContactParty> contacts, IRepository<Property> properties,
            IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _properties = properties;
            _assets = assets; _listings = listings; _brokers = brokers;
            _contacts = contacts; _uow = uow; _currentUser = currentUser;
        }

        public async Task<SaleListingDto> CreateAsync(Guid assetId, SaleListingCreateRequest request, CancellationToken ct = default)
        {
            var asset = await GetOwnedAssetAsync(assetId, ct);

            var exists = await _listings.Query().AnyAsync(l => l.AssetId == assetId, ct);
            if (exists)
                throw new ConflictException("Tài sản đã có thông tin rao bán — hãy cập nhật thay vì tạo mới.");

            var listing = new SaleListing
            {
                AssetId = assetId,
                AskingPrice = request.AskingPrice,
                Status = SaleListingStatus.Active,
                ListedAt = DateTime.UtcNow,
                AgreementNotes = request.AgreementNotes
            };
            await _listings.AddAsync(listing, ct);

            asset.Status = AssetStatus.ForSale;

            await _uow.SaveChangesAsync(ct);
            return await GetByAssetAsync(assetId, ct);
        }

        public async Task<SaleListingDto> UpdateAsync(Guid assetId, SaleListingUpdateRequest request, CancellationToken ct = default)
        {
            await GetOwnedAssetAsync(assetId, ct);
            var listing = await GetListingAsync(assetId, ct);

            listing.AskingPrice = request.AskingPrice;
            listing.Status = request.Status;
            listing.AgreementNotes = request.AgreementNotes;

            await _uow.SaveChangesAsync(ct);
            return await GetByAssetAsync(assetId, ct);
        }

        public async Task<SaleListingDto> GetByAssetAsync(Guid assetId, CancellationToken ct = default)
        {
            await GetOwnedAssetAsync(assetId, ct);

            var dto = await _listings.Query().AsNoTracking()
                .Where(l => l.AssetId == assetId)
                .Select(l => new SaleListingDto(
                    l.Id, l.AssetId, l.AskingPrice, l.Status, l.ListedAt, l.AgreementNotes,
                    l.Brokers.OrderBy(b => b.SentAt)
                        .Select(b => new SaleListingBrokerDto(
                            b.BrokerId, b.Broker.FullName, b.Broker.Phone, b.SentAt, b.Notes))
                        .ToList()))
                .FirstOrDefaultAsync(ct);

            return dto ?? throw new NotFoundException("Tài sản chưa có thông tin rao bán.");
        }

        public async Task<SaleListingDto> AddBrokerAsync(Guid assetId, SaleListingBrokerRequest request, CancellationToken ct = default)
        {
            await GetOwnedAssetAsync(assetId, ct);
            var listing = await GetListingAsync(assetId, ct);

            var broker = await _contacts.Query()
                .FirstOrDefaultAsync(c => c.Id == request.BrokerId && c.UserId == _currentUser.UserId, ct)
                ?? throw new NotFoundException("Không tìm thấy môi giới trong sổ đối tác.");
            if (broker.Type != ContactType.Broker)
                throw new ValidationFailedException("Đối tác này không phải môi giới.");

            var already = await _brokers.Query()
                .AnyAsync(b => b.SaleListingId == listing.Id && b.BrokerId == broker.Id, ct);
            if (already)
                throw new ConflictException("Đã gửi tài sản này cho môi giới đó rồi.");

            await _brokers.AddAsync(new SaleListingBroker
            {
                SaleListingId = listing.Id,
                BrokerId = broker.Id,
                SentAt = DateTime.UtcNow,
                Notes = request.Notes
            }, ct);

            await _uow.SaveChangesAsync(ct);
            return await GetByAssetAsync(assetId, ct);
        }

        public async Task<SaleListingDto> RemoveBrokerAsync(Guid assetId, Guid brokerId, CancellationToken ct = default)
        {
            await GetOwnedAssetAsync(assetId, ct);
            var listing = await GetListingAsync(assetId, ct);

            var link = await _brokers.Query()
                .FirstOrDefaultAsync(b => b.SaleListingId == listing.Id && b.BrokerId == brokerId, ct)
                ?? throw new NotFoundException("Môi giới này chưa được gửi tài sản.");

            _brokers.Remove(link);
            await _uow.SaveChangesAsync(ct);
            return await GetByAssetAsync(assetId, ct);
        }

        public async Task MarkSoldAsync(Guid assetId, CancellationToken ct = default)
        {
            var asset = await GetOwnedAssetAsync(assetId, ct);
            var listing = await GetListingAsync(assetId, ct);

            listing.Status = SaleListingStatus.Sold;
            asset.Status = AssetStatus.Sold;

            // ⚠️ SỬA — KHÔNG dùng _properties.FindAsync(...) vì Property.Id là int,
            // IRepository<T>.FindAsync cố định nhận Guid → lỗi biên dịch nếu gọi trực tiếp.
            // Dùng Query().FirstOrDefaultAsync() thay thế — hoạt động với MỌI kiểu khoá chính.
            if (asset.LinkedPropertyId is not null)
            {
                var property = await _properties.Query()
                    .FirstOrDefaultAsync(p => p.Id == asset.LinkedPropertyId.Value, ct);
                if (property is not null) property.Status = PropertyStatus.Sold;
            }

            await _uow.SaveChangesAsync(ct);
        }
        /// <summary>Toàn bộ SaleListing (theo dõi môi giới nội bộ) của user, gộp từ MỌI tài sản —
        /// dùng cho trang "Rao bán" ở sidebar (khác tab "Rao bán" trong chi tiết từng tài sản).</summary>
        public async Task<IReadOnlyList<MySaleListingDto>> GetAllForCurrentUserAsync(CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            return await _listings.Query().AsNoTracking()
                .Where(l => l.Asset.UserId == userId)
                .OrderByDescending(l => l.ListedAt)
                .Select(l => new MySaleListingDto(
                    l.Id, l.AssetId, l.Asset.Name, l.Asset.Address.City, l.Asset.Address.District,
                    l.Asset.Thumbnail == null ? null : l.Asset.Thumbnail.Url,
                    l.AskingPrice, l.Status, l.ListedAt, l.AgreementNotes,
                    l.Brokers.OrderBy(b => b.SentAt)
                        .Select(b => new SaleListingBrokerDto(b.BrokerId, b.Broker.FullName, b.Broker.Phone, b.SentAt, b.Notes))
                        .ToList()))
                .ToListAsync(ct);

            // Ghi chú: đây là Select THẲNG (không GroupBy) — KHÔNG dính lỗi dịch LINQ đã gặp ở
            // ReportService/AdminStats (lỗi đó chỉ xảy ra với GroupBy + gọi hàm trên g.Key/g.Sum
            // ngay trong Select). Dựng record trực tiếp trong Select thẳng là pattern đã dùng an
            // toàn ở hàng chục chỗ khác trong project (AssetSummaryDto, ContactPartyDto...).
        }
        private async Task<Asset> GetOwnedAssetAsync(Guid assetId, CancellationToken ct)
            => await _assets.Query()
                   .FirstOrDefaultAsync(a => a.Id == assetId && a.UserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy tài sản.");

        private async Task<SaleListing> GetListingAsync(Guid assetId, CancellationToken ct)
            => await _listings.Query().FirstOrDefaultAsync(l => l.AssetId == assetId, ct)
               ?? throw new NotFoundException("Tài sản chưa có thông tin rao bán.");
    }
}
