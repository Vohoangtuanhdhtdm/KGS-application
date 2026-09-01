using kgs_api.Dtos;
using static kgs_api.Domain.Enums;

namespace kgs_api.Interfaces
{
    // ============================================================
    // A5 — GIẤY TỜ PHÁP LÝ / HỢP ĐỒNG DỊCH VỤ
    // ============================================================
    public interface IAssetDocumentService
    {
        Task<AssetDocumentDto> UploadAsync(Guid assetId, AssetDocumentUploadRequest request, CancellationToken ct = default);
        Task<IReadOnlyList<AssetDocumentDto>> GetByAssetAsync(Guid assetId, DocumentType? type, CancellationToken ct = default);
        Task DeleteAsync(Guid assetId, Guid documentId, CancellationToken ct = default);

        /// <summary>Giấy tờ/hợp đồng dịch vụ sắp hết hạn trong N ngày — trên TOÀN BỘ tài sản của user.</summary>
        Task<IReadOnlyList<ExpiringDocumentDto>> GetExpiringAsync(int withinDays, CancellationToken ct = default);
    }
}
