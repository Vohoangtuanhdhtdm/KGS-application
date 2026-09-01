using kgs_api.Domain.ValueObjects;

namespace kgs_api.Storage
{
    // ============================================================
    // IFileStorageService — dùng CHO MODULE QUẢN LÝ TÀI SẢN, đứng
    // CẠNH IPhotoService cũ (không xoá IPhotoService — chỗ nào đang
    // dùng IPhotoService cho Property thì giữ nguyên, không phải sửa).
    //
    // Khác biệt so với IPhotoService:
    //  - Trả về StoredFile (Url + PublicId + metadata) để nhúng thẳng
    //    vào owned type (AssetMedia.File, AssetDocument.File, ...),
    //    thay vì trả nguyên ImageUploadResult của Cloudinary.
    //  - Có UploadDocumentAsync (resource_type=raw) cho PDF/giấy tờ —
    //    IPhotoService cũ chỉ upload ảnh.
    //  - ScheduleDeletion KHÔNG gọi Cloudinary ngay trong request: ghi
    //    PublicId vào bảng FileDeletionQueue (outbox) CÙNG transaction
    //    với việc xoá bản ghi DB → không bao giờ có file mồ côi kể cả
    //    khi Cloudinary lỗi tạm thời. FileCleanupJob xử lý + retry.
    // ============================================================
    public interface IFileStorageService
    {
        Task<StoredFile> UploadImageAsync(IFormFile file, string folder = "assets", CancellationToken ct = default);

        /// <summary>PDF, docx, hồ sơ scan... — dùng resource_type=raw của Cloudinary.</summary>
        Task<StoredFile> UploadDocumentAsync(IFormFile file, string folder = "documents", CancellationToken ct = default);

        /// <summary>Ghi PublicId vào hàng đợi xoá. KHÔNG SaveChanges — caller tự save cùng transaction
        /// với thao tác xoá bản ghi DB (Asset/AssetMedia/AssetDocument/CashFlowEntry...).</summary>
        void ScheduleDeletion(StoredFile? file);
    }
}
