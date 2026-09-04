using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Interfaces;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace kgs_api.Services
{
    /// <summary>Báo cho người đã lưu bộ lọc khi có tin mới khớp bộ lọc đó.
    ///
    /// Đây là nửa còn lại của việc lưu bộ lọc, và là nửa quan trọng hơn. Lưu bộ lọc mà không
    /// báo gì thì vẫn bắt người dùng phải nhớ tự quay lại kiểm tra — tức là vẫn chưa giải
    /// quyết được điều khiến họ bỏ đi. Có báo thì nền tảng chủ động kéo họ trở lại đúng lúc
    /// có thứ đáng xem, và chủ tin có người xem tin sớm hơn.
    ///
    /// Mỗi ngày một lần là đủ: tin phải qua kiểm duyệt mới hiển thị nên không có chuyện
    /// "vừa đăng đã có ngay", và gửi dày hơn thì email biến thành thứ bị bỏ qua.</summary>
    public sealed class SavedSearchAlertJob
    {
        /// <summary>Số tin liệt kê trong email. Nhiều hơn nữa thì email thành danh sách chứ
        /// không còn là lời nhắc — phần còn lại để trên web.</summary>
        private const int PreviewCount = 5;

        private readonly ApplicationDbContext _db;
        private readonly INotificationSender _notifier;
        private readonly GeometryFactory _geometryFactory;
        private readonly ILogger<SavedSearchAlertJob> _logger;

        public SavedSearchAlertJob(
            ApplicationDbContext db,
            INotificationSender notifier,
            GeometryFactory geometryFactory,
            ILogger<SavedSearchAlertJob> logger)
        {
            _db = db; _notifier = notifier;
            _geometryFactory = geometryFactory; _logger = logger;
        }

        public async Task RunAsync(CancellationToken ct)
        {
            var searches = await _db.Set<SavedSearch>()
                .Where(s => s.NotifyEnabled)
                .ToListAsync(ct);

            if (searches.Count == 0) return;

            var sent = 0;

            foreach (var search in searches)
            {
                ct.ThrowIfCancellationRequested();

                var now = DateTime.UtcNow;
                var criteria = SavedSearchService.Deserialize(search.CriteriaJson);

                List<string> titles;
                int total;
                try
                {
                    var matches = SavedSearchService
                        .BuildMatchQuery(_db.Set<Listing>().AsNoTracking(), criteria, _geometryFactory)
                        .Where(l => (l.PublishedAt ?? l.CreatedAt) > search.LastCheckedAt);

                    total = await matches.CountAsync(ct);
                    titles = total == 0
                        ? new List<string>()
                        : await matches
                            .OrderByDescending(l => l.PublishedAt ?? l.CreatedAt)
                            .ThenBy(l => l.Id)
                            .Take(PreviewCount)
                            .Select(l => l.Title)
                            .ToListAsync(ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // Một bộ lọc dựng ra truy vấn hỏng không được kéo theo mọi bộ lọc khác.
                    _logger.LogError(ex,
                        "SavedSearchAlertJob: bỏ qua bộ lọc {SearchId} vì truy vấn lỗi.", search.Id);
                    continue;
                }

                if (total == 0)
                {
                    // Không có tin nào thì vẫn đẩy mốc lên, để lần sau không quét lại quãng cũ.
                    search.LastCheckedAt = now;
                    continue;
                }

                try
                {
                    await _notifier.SendAsync(search.UserId, BuildTitle(total, search.Name),
                        BuildBody(search.Name, total, titles), ct);
                    sent++;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // KHÔNG đẩy mốc khi gửi hỏng, và đây là chỗ cố tình làm ngược với các
                    // luồng khác trong dự án (vốn lưu trước rồi mới gửi). Ở đây "đã báo cho
                    // người dùng" CHÍNH LÀ thứ mốc này ghi lại — đẩy mốc sau một lần gửi hỏng
                    // là xoá vĩnh viễn những tin đó khỏi tầm mắt họ. Giữ nguyên mốc thì lần
                    // chạy sau gộp chung vào một email, chậm một ngày nhưng không mất gì.
                    _logger.LogError(ex,
                        "SavedSearchAlertJob: gửi thông báo cho bộ lọc {SearchId} thất bại, giữ nguyên mốc để thử lại.",
                        search.Id);
                    continue;
                }

                search.LastCheckedAt = now;
                search.LastNotifiedAt = now;
            }

            await _db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "SavedSearchAlertJob: đã đối chiếu {Total} bộ lọc, gửi {Sent} thông báo.",
                searches.Count, sent);
        }

        private static string BuildTitle(int total, string name)
            => $"{total} tin mới khớp bộ lọc \"{name}\"";

        /// <summary>Nội dung email, cố ý gói gọn trong MỘT đoạn văn.
        ///
        /// <see cref="EmailNotificationSender"/> nhét trọn body vào một thẻ p rồi HTML-encode,
        /// nên mọi ký tự xuống dòng ở đây sẽ bị nuốt và danh sách gạch đầu dòng biến thành
        /// một dòng dính liền. Muốn xuống dòng thật thì phải sửa chính bộ gửi — mà nó đang
        /// dùng chung với nhắc lịch hợp đồng, nên không phải việc của nhiệm vụ này.</summary>
        private static string BuildBody(string name, int total, IReadOnlyList<string> titles)
        {
            var preview = string.Join(", ", titles);

            var remaining = total - titles.Count;
            var tail = remaining > 0 ? $" và {remaining} tin khác" : string.Empty;

            return $"Bộ lọc \"{name}\" của bạn có {total} tin đăng mới: {preview}{tail}. "
                 + "Mở mục \"Bộ lọc đã lưu\" trên trang tìm kiếm để xem đầy đủ.";
        }
    }
}
