using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    // ============================================================
    // A4 — ẢNH THEO THỜI GIAN
    // ============================================================
    public interface IAssetMediaService
    {
        Task<IReadOnlyList<AssetMediaDto>> UploadAsync(Guid assetId, AssetMediaUploadRequest request, CancellationToken ct = default);
        Task<IReadOnlyList<AssetMediaDto>> GetGalleryAsync(Guid assetId, CancellationToken ct = default);
        Task DeleteAsync(Guid assetId, Guid mediaId, CancellationToken ct = default);
        Task SetThumbnailAsync(Guid assetId, IFormFile file, CancellationToken ct = default);
        /// <summary>Đặt một ảnh gallery làm ảnh đại diện — chỉ copy tham chiếu, không upload lại.</summary>
        Task SetThumbnailFromMediaAsync(Guid assetId, Guid mediaId, CancellationToken ct = default);
    }
}
