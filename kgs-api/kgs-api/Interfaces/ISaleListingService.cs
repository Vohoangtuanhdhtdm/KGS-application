using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    // ============================================================
    // D6 — RAO BÁN + DANH SÁCH MÔI GIỚI ĐÃ GỬI
    // ============================================================
    public interface ISaleListingService
    {
        Task<SaleListingDto> CreateAsync(Guid assetId, SaleListingCreateRequest request, CancellationToken ct = default);
        Task<SaleListingDto> UpdateAsync(Guid assetId, SaleListingUpdateRequest request, CancellationToken ct = default);
        Task<SaleListingDto> GetByAssetAsync(Guid assetId, CancellationToken ct = default);
        Task<SaleListingDto> AddBrokerAsync(Guid assetId, SaleListingBrokerRequest request, CancellationToken ct = default);
        Task<SaleListingDto> RemoveBrokerAsync(Guid assetId, Guid brokerId, CancellationToken ct = default);
        Task MarkSoldAsync(Guid assetId, CancellationToken ct = default);
        Task<IReadOnlyList<MySaleListingDto>> GetAllForCurrentUserAsync(CancellationToken ct = default);
    }
}
