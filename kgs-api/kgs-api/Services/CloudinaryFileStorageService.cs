using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Domain.ValueObjects;
using kgs_api.Storage;
using Microsoft.EntityFrameworkCore;
using kgs_api.Utility;
using Microsoft.Extensions.Options;
using static kgs_api.Common.Common;

namespace kgs_api.Services
{
    /// <summary>
    /// Cùng pattern IOptions&lt;CloudinarySettings&gt; như PhotoService hiện có —
    /// KHÔNG cần đăng ký thêm Cloudinary làm singleton trong Program.cs.
    /// </summary>
    public sealed class CloudinaryFileStorageService : IFileStorageService
    {
        private const long MaxImageBytes = 10 * 1024 * 1024;   // 10MB
        private const long MaxDocumentBytes = 25 * 1024 * 1024; // 25MB

        private static readonly HashSet<string> AllowedImageTypes = new(StringComparer.OrdinalIgnoreCase)
            { "image/jpeg", "image/png", "image/webp", "image/heic" };

        private readonly Cloudinary _cloudinary;
        private readonly ApplicationDbContext _db;

        public CloudinaryFileStorageService(IOptions<CloudinarySettings> config, ApplicationDbContext db)
        {
            var acc = new Account(
                config.Value.CloudName,
                config.Value.ApiKey,
                config.Value.ApiSecret);
            _cloudinary = new Cloudinary(acc);
            _db = db;
        }

        public async Task<StoredFile> UploadImageAsync(IFormFile file, string folder = "assets", CancellationToken ct = default)
        {
            if (file.Length == 0) throw new ValidationFailedException("File rỗng.");
            if (file.Length > MaxImageBytes) throw new ValidationFailedException("Ảnh vượt quá 10MB.");
            if (!AllowedImageTypes.Contains(file.ContentType))
                throw new ValidationFailedException($"Định dạng ảnh không hỗ trợ: {file.ContentType}");

            await using var stream = file.OpenReadStream();
            var uploadResult = await _cloudinary.UploadAsync(new ImageUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = folder,
                Transformation = new Transformation().Quality("auto").FetchFormat("auto")
            });
            // Lưu ý: nếu bản CloudinaryDotNet bạn dùng có overload UploadAsync(params, ct),
            // hãy truyền ct vào để hỗ trợ huỷ request — SDK cũ không có tham số này.

            return ToStoredFile(uploadResult, file);
        }

        public async Task<StoredFile> UploadDocumentAsync(IFormFile file, string folder = "documents", CancellationToken ct = default)
        {
            if (file.Length == 0) throw new ValidationFailedException("File rỗng.");
            if (file.Length > MaxDocumentBytes) throw new ValidationFailedException("Tài liệu vượt quá 25MB.");

            await using var stream = file.OpenReadStream();
            var uploadResult = await _cloudinary.UploadAsync(new RawUploadParams
            {
                File = new FileDescription(file.FileName, stream),
                Folder = folder
            });

            return ToStoredFile(uploadResult, file);
        }

        public void ScheduleDeletion(StoredFile? file)
        {
            if (file is null || string.IsNullOrEmpty(file.PublicId)) return;

            _db.Set<FileDeletionQueueItem>().Add(new FileDeletionQueueItem
            {
                PublicId = file.PublicId,
                ResourceType = file.ContentType?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) == true
                    ? "image" : "raw"
            });
            // Caller gọi SaveChanges → bản ghi DB bị xoá và item hàng đợi được ghi NGUYÊN TỬ.
        }

        private static StoredFile ToStoredFile(RawUploadResult result, IFormFile file)
        {
            if (result.Error is not null)
                throw new ValidationFailedException($"Upload Cloudinary thất bại: {result.Error.Message}");

            return new StoredFile
            {
                Url = result.SecureUrl.ToString(),
                PublicId = result.PublicId,
                FileName = file.FileName,
                ContentType = file.ContentType,
                SizeBytes = file.Length
            };
        }
    }

    // ============================================================
    // Background job dọn file — chạy định kỳ qua Hangfire/Quartz
    // (khuyến nghị mỗi 30 phút, xem đăng ký RecurringJob trong KE-HOACH.md).
    // ============================================================
    public sealed class FileCleanupJob
    {
        private const int BatchSize = 50;
        private const int MaxAttempts = 10;

        private readonly ApplicationDbContext _db;
        private readonly Cloudinary _cloudinary;
        private readonly ILogger<FileCleanupJob> _logger;

        public FileCleanupJob(IOptions<CloudinarySettings> config, ApplicationDbContext db, ILogger<FileCleanupJob> logger)
        {
            var acc = new Account(config.Value.CloudName, config.Value.ApiKey, config.Value.ApiSecret);
            _cloudinary = new Cloudinary(acc);
            _db = db;
            _logger = logger;
        }

        public async Task RunAsync(CancellationToken ct)
        {
            var batch = await _db.Set<FileDeletionQueueItem>()
                .Where(x => x.Attempts < MaxAttempts)
                .OrderBy(x => x.EnqueuedAt)
                .Take(BatchSize)
                .ToListAsync(ct);

            foreach (var item in batch)
            {
                item.Attempts++;
                item.LastAttemptAt = DateTime.UtcNow;
                try
                {
                    var result = await _cloudinary.DestroyAsync(new DeletionParams(item.PublicId)
                    {
                        ResourceType = item.ResourceType == "raw" ? ResourceType.Raw : ResourceType.Image
                    });

                    // "ok" = xoá thành công, "not found" = đã không còn → đều coi là xong
                    if (result.Result is "ok" or "not found")
                        _db.Remove(item);
                    else
                        item.LastError = result.Result;
                }
                catch (Exception ex)
                {
                    item.LastError = ex.Message;
                    _logger.LogWarning(ex, "Xoá file Cloudinary {PublicId} thất bại (lần {Attempts})",
                        item.PublicId, item.Attempts);
                }
            }

            await _db.SaveChangesAsync(ct);
        }
    }
}
