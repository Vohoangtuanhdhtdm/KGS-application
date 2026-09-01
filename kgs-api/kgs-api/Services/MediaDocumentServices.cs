using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using kgs_api.Storage;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;
using kgs_api.Interfaces;

namespace kgs_api.Services
{
    public sealed class AssetMediaService : IAssetMediaService
    {
        private const int MaxFilesPerUpload = 10;

        private readonly IRepository<Asset> _assets;
        private readonly IRepository<AssetMedia> _media;
        private readonly IUnitOfWork _uow;
        private readonly IFileStorageService _files;
        private readonly ICurrentUserService _currentUser;

        public AssetMediaService(IRepository<Asset> assets, IRepository<AssetMedia> media,
            IUnitOfWork uow, IFileStorageService files, ICurrentUserService currentUser)
        {
            _assets = assets; _media = media; _uow = uow; _files = files; _currentUser = currentUser;
        }

        public async Task<IReadOnlyList<AssetMediaDto>> UploadAsync(Guid assetId, AssetMediaUploadRequest request, CancellationToken ct = default)
        {
            if (request.Files.Count == 0)
                throw new ValidationFailedException("Chưa chọn file nào.");
            if (request.Files.Count > MaxFilesPerUpload)
                throw new ValidationFailedException($"Tối đa {MaxFilesPerUpload} ảnh mỗi lần upload.");

            var asset = await GetOwnedAssetAsync(assetId, ct);

            var maxSort = await _media.Query()
                .Where(m => m.AssetId == assetId)
                .MaxAsync(m => (int?)m.SortOrder, ct) ?? 0;

            var created = new List<AssetMedia>();
            foreach (var file in request.Files)
            {
                // Upload tuần tự trước khi ghi DB. Nếu file thứ k lỗi: các file đã upload
                // được đẩy vào hàng đợi xoá để không tạo rác Cloudinary, sau đó ném lỗi.
                StoredFile stored;
                try
                {
                    stored = await _files.UploadImageAsync(file, folder: $"assets/{assetId}", ct);
                }
                catch
                {
                    foreach (var m in created) _files.ScheduleDeletion(m.File);
                    if (created.Count > 0) await _uow.SaveChangesAsync(ct);
                    throw;
                }

                created.Add(new AssetMedia
                {
                    AssetId = asset.Id,
                    File = stored,
                    Caption = request.Caption,
                    TakenAt = EnsureUtc(request.TakenAt) ?? DateTime.UtcNow,
                    SortOrder = ++maxSort
                });
            }

            await _media.AddRangeAsync(created, ct);
            await _uow.SaveChangesAsync(ct);

            return created.Select(ToDto).ToList();
        }

        public async Task SetThumbnailFromMediaAsync(Guid assetId, Guid mediaId, CancellationToken ct = default)
        {
            var asset = await GetOwnedAssetAsync(assetId, ct);   // tracking

            var media = await _media.Query().AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == mediaId && m.AssetId == assetId, ct)
                ?? throw new NotFoundException("Không tìm thấy ảnh.");

            // Xoá file thumbnail CŨ trên Cloudinary — nhưng CHỈ khi nó không
            // được ảnh gallery nào dùng chung (xem cạm bẫy (1) ở đầu file)
            await ScheduleOldThumbnailDeletionIfSafeAsync(asset, ct);

            // Copy THAM CHIẾU — cùng PublicId, không tạo file mới trên Cloudinary
            asset.Thumbnail = new StoredFile
            {
                Url = media.File.Url,
                PublicId = media.File.PublicId,
                FileName = media.File.FileName,
                ContentType = media.File.ContentType,
                SizeBytes = media.File.SizeBytes
            };

            await _uow.SaveChangesAsync(ct);
        }
        public async Task<IReadOnlyList<AssetMediaDto>> GetGalleryAsync(Guid assetId, CancellationToken ct = default)
        {
            await GetOwnedAssetAsync(assetId, ct);

            return await _media.Query().AsNoTracking()
                .Where(m => m.AssetId == assetId)
                .OrderByDescending(m => m.TakenAt)   // "hình ảnh theo thời gian"
                .Select(m => new AssetMediaDto(m.Id,
                    new StoredFileDto(m.File.Url, m.File.FileName, m.File.ContentType, m.File.SizeBytes),
                    m.Caption, m.TakenAt, m.SortOrder))
                .ToListAsync(ct);
        }

        public async Task DeleteAsync(Guid assetId, Guid mediaId, CancellationToken ct = default)
        {
            var asset = await GetOwnedAssetAsync(assetId, ct);   // tracking — cần để clear thumbnail

            var media = await _media.Query()
                .FirstOrDefaultAsync(m => m.Id == mediaId && m.AssetId == assetId, ct)
                ?? throw new NotFoundException("Không tìm thấy ảnh.");

            // ← THÊM đoạn này: ảnh sắp xoá đang được dùng làm thumbnail?
            if (asset.Thumbnail?.PublicId == media.File.PublicId)
                asset.Thumbnail = null;   // clear tham chiếu — file sẽ bị xoá ngay bên dưới

            _files.ScheduleDeletion(media.File);   // cùng transaction
            _media.Remove(media);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task SetThumbnailAsync(Guid assetId, IFormFile file, CancellationToken ct = default)
        {
            var asset = await GetOwnedAssetAsync(assetId, ct);

            var newThumbnail = await _files.UploadImageAsync(file, folder: $"assets/{assetId}", ct);
            await ScheduleOldThumbnailDeletionIfSafeAsync(asset, ct);   // ← ĐỔI dòng này
            asset.Thumbnail = newThumbnail;

            await _uow.SaveChangesAsync(ct);
        }

        private async Task<Asset> GetOwnedAssetAsync(Guid assetId, CancellationToken ct)
            => await _assets.Query()
                   .FirstOrDefaultAsync(a => a.Id == assetId && a.UserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy tài sản.");

        // ==================== HELPER MỚI ====================

        /// <summary>Đưa thumbnail cũ vào hàng đợi xoá Cloudinary, TRỪ KHI PublicId của nó
        /// vẫn đang được một ảnh gallery của asset này dùng (file dùng chung — xoá sẽ làm chết ảnh gallery).</summary>
        private async Task ScheduleOldThumbnailDeletionIfSafeAsync(Asset asset, CancellationToken ct)
        {
            var old = asset.Thumbnail;
            if (old is null || string.IsNullOrEmpty(old.PublicId)) return;

            var sharedWithGallery = await _media.Query()
                .AnyAsync(m => m.AssetId == asset.Id && m.File.PublicId == old.PublicId, ct);

            if (!sharedWithGallery)
                _files.ScheduleDeletion(old);
            // Nếu shared: chỉ ghi đè tham chiếu, file vật lý vẫn thuộc về ảnh gallery
        }
        private static DateTime? EnsureUtc(DateTime? d)
            => d is null ? null : DateTime.SpecifyKind(d.Value, DateTimeKind.Utc);

        private static AssetMediaDto ToDto(AssetMedia m) => new(m.Id,
            new StoredFileDto(m.File.Url, m.File.FileName, m.File.ContentType, m.File.SizeBytes),
            m.Caption, m.TakenAt, m.SortOrder);
    }

    public sealed class AssetDocumentService : IAssetDocumentService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<AssetDocument> _documents;
        private readonly IRepository<LeaseContract> _contracts;
        private readonly IUnitOfWork _uow;
        private readonly IFileStorageService _files;
        private readonly ICurrentUserService _currentUser;

        public AssetDocumentService(IRepository<Asset> assets, IRepository<AssetDocument> documents,
            IRepository<LeaseContract> contracts, IUnitOfWork uow,
            IFileStorageService files, ICurrentUserService currentUser)
        {
            _assets = assets; _documents = documents; _contracts = contracts;
            _uow = uow; _files = files; _currentUser = currentUser;
        }

        public async Task<AssetDocumentDto> UploadAsync(Guid assetId, AssetDocumentUploadRequest request, CancellationToken ct = default)
        {
            var asset = await GetOwnedAssetAsync(assetId, ct);

            if (request.LeaseContractId is not null)
            {
                var contractBelongs = await _contracts.Query()
                    .AnyAsync(c => c.Id == request.LeaseContractId && c.AssetId == assetId, ct);
                if (!contractBelongs)
                    throw new ValidationFailedException("Hợp đồng không thuộc tài sản này.");
            }

            // Ảnh chụp giấy tờ → upload dạng image; PDF/scan → raw
            var isImage = request.File.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase);
            var stored = isImage
                ? await _files.UploadImageAsync(request.File, folder: $"documents/{assetId}", ct)
                : await _files.UploadDocumentAsync(request.File, folder: $"documents/{assetId}", ct);

            var doc = new AssetDocument
            {
                AssetId = asset.Id,
                Type = request.Type,
                Title = request.Title.Trim(),
                File = stored,
                IssueDate = EnsureUtc(request.IssueDate),
                ExpiryDate = EnsureUtc(request.ExpiryDate),
                LeaseContractId = request.LeaseContractId,
                Notes = request.Notes
            };

            await _documents.AddAsync(doc, ct);
            await _uow.SaveChangesAsync(ct);

            return ToDto(doc);
        }

        public async Task<IReadOnlyList<AssetDocumentDto>> GetByAssetAsync(Guid assetId, DocumentType? type, CancellationToken ct = default)
        {
            await GetOwnedAssetAsync(assetId, ct);

            var q = _documents.Query().AsNoTracking().Where(d => d.AssetId == assetId);
            if (type is not null) q = q.Where(d => d.Type == type);

            return await q
                .OrderByDescending(d => d.CreatedAt)
                .Select(d => new AssetDocumentDto(d.Id, d.Type, d.Title,
                    new StoredFileDto(d.File.Url, d.File.FileName, d.File.ContentType, d.File.SizeBytes),
                    d.IssueDate, d.ExpiryDate, d.LeaseContractId, d.Notes))
                .ToListAsync(ct);
        }

        public async Task DeleteAsync(Guid assetId, Guid documentId, CancellationToken ct = default)
        {
            await GetOwnedAssetAsync(assetId, ct);

            var doc = await _documents.Query()
                .FirstOrDefaultAsync(d => d.Id == documentId && d.AssetId == assetId, ct)
                ?? throw new NotFoundException("Không tìm thấy giấy tờ.");

            _files.ScheduleDeletion(doc.File);
            _documents.Remove(doc);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task<IReadOnlyList<ExpiringDocumentDto>> GetExpiringAsync(int withinDays, CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;
            var limit = now.AddDays(Math.Clamp(withinDays, 1, 365));

            // Join qua Asset để lọc theo user — dùng index IX_AssetDocuments_ExpiryDate
            return await _documents.Query().AsNoTracking()
                .Where(d => d.Asset.UserId == _currentUser.UserId
                         && d.ExpiryDate != null
                         && d.ExpiryDate >= now && d.ExpiryDate <= limit)
                .OrderBy(d => d.ExpiryDate)
                .Select(d => new ExpiringDocumentDto(
                    d.Id, d.AssetId, d.Asset.Name, d.Type, d.Title, d.ExpiryDate!.Value))
                .ToListAsync(ct);
        }

        private async Task<Asset> GetOwnedAssetAsync(Guid assetId, CancellationToken ct)
            => await _assets.Query()
                   .FirstOrDefaultAsync(a => a.Id == assetId && a.UserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy tài sản.");

        private static DateTime? EnsureUtc(DateTime? d)
            => d is null ? null : DateTime.SpecifyKind(d.Value, DateTimeKind.Utc);

        private static AssetDocumentDto ToDto(AssetDocument d) => new(d.Id, d.Type, d.Title,
            new StoredFileDto(d.File.Url, d.File.FileName, d.File.ContentType, d.File.SizeBytes),
            d.IssueDate, d.ExpiryDate, d.LeaseContractId, d.Notes);
    }

}
