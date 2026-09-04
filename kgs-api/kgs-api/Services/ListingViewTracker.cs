using System.Security.Cryptography;
using System.Text;
using kgs_api.Data;
using kgs_api.Interfaces;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace kgs_api.Services
{
    public sealed class ListingViewTracker : IListingViewTracker
    {
        private readonly ApplicationDbContext _db;
        private readonly IHttpContextAccessor _http;
        private readonly IConfiguration _config;
        private readonly ILogger<ListingViewTracker> _logger;

        public ListingViewTracker(
            ApplicationDbContext db,
            IHttpContextAccessor http,
            IConfiguration config,
            ILogger<ListingViewTracker> logger)
        {
            _db = db; _http = http; _config = config; _logger = logger;
        }

        public async Task<bool> TrackAsync(Guid listingId, CancellationToken ct = default)
        {
            try
            {
                var ctx = _http.HttpContext;
                if (ctx is null) return false;   // gọi ngoài request (job nền) — không phải lượt xem

                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var userId = ctx.User?.Identity?.IsAuthenticated == true
                    ? ctx.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                    : null;

                var hash = ComputeViewerHash(ctx, userId, today);

                // INSERT ... ON CONFLICT DO NOTHING thay vì "kiểm tra rồi ghi".
                //
                // Không chỉ vì tránh cuộc đua giữa hai tab: nếu để EF ném lỗi khoá trùng thì
                // DbContext hỏng luôn — thực thể vẫn nằm ở trạng thái Added và mọi
                // SaveChanges sau đó trong CÙNG request sẽ ném lại đúng lỗi cũ. Ở đây là
                // request công khai nên chưa chết ai, nhưng đó là loại lỗi rất khó truy.
                // ON CONFLICT liet ke CỘT chu khong phai ON CONSTRAINT <ten>: EF tao ra
                // unique INDEX, ma dang ON CONSTRAINT chi chap nhan mot CONSTRAINT that su.
                // Viet nham dang kia thi PostgreSQL bao "constraint does not exist" — va no
                // chi no luc chay, khong phai luc build.
                var inserted = await _db.Database.ExecuteSqlRawAsync(
                    """
                    INSERT INTO "ListingViews" ("Id", "ListingId", "ViewerHash", "ViewerUserId", "ViewedAt", "ViewedOn")
                    VALUES (@id, @listingId, @hash, @userId, @viewedAt, @viewedOn)
                    ON CONFLICT ("ListingId", "ViewerHash", "ViewedOn") DO NOTHING
                    """,
                    new[]
                    {
                        new NpgsqlParameter("id", Guid.NewGuid()),
                        new NpgsqlParameter("listingId", listingId),
                        new NpgsqlParameter("hash", hash),
                        new NpgsqlParameter("userId", (object?)userId ?? DBNull.Value),
                        new NpgsqlParameter("viewedAt", DateTime.UtcNow),
                        new NpgsqlParameter("viewedOn", NpgsqlDbType.Date) { Value = today }
                    },
                    ct);

                if (inserted == 0) return false;   // người này đã xem tin đó hôm nay

                await _db.Database.ExecuteSqlRawAsync(
                    """UPDATE "Listings" SET "ViewCount" = "ViewCount" + 1 WHERE "Id" = @id""",
                    new[] { new NpgsqlParameter("id", listingId) },
                    ct);

                return true;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Đếm lượt xem hỏng thì trang chi tiết vẫn phải mở được. Một thống kê thiếu
                // vài lượt còn hơn một trang trắng.
                _logger.LogError(ex, "Không ghi được lượt xem cho tin {ListingId}.", listingId);
                return false;
            }
        }

        /// <summary>Dấu vân người xem: SHA-256 của (muối ngày + IP + user agent + user id).
        ///
        /// Không lưu IP thô — nó là dữ liệu cá nhân, mà thứ ta cần chỉ là trả lời "có phải
        /// người này vừa xem không". Muối đổi theo ngày nên kể cả có cả bảng trong tay cũng
        /// không lần ngược được một người qua nhiều ngày.
        ///
        /// Người đã đăng nhập thì id của họ vào thẳng dấu vân: cùng một người mở trên máy
        /// tính rồi mở lại trên 4G vẫn phải là một lượt.</summary>
        private string ComputeViewerHash(HttpContext ctx, string? userId, DateOnly day)
        {
            var salt = _config["Analytics:ViewerHashSalt"] ?? "kgs-default-viewer-salt";

            // X-Forwarded-For trước, RemoteIpAddress sau. Đứng sau reverse proxy mà chỉ đọc
            // RemoteIpAddress thì MỌI khách vãng lai đều mang cùng một IP (của proxy) và
            // gộp lại thành đúng một lượt xem mỗi ngày cho cả nền tảng.
            //
            // Header này giả mạo được, nhưng hậu quả tệ nhất là ai đó tự thổi phồng lượt xem
            // tin của chính mình — việc họ vốn đã làm được bằng cách đổi mạng.
            var forwarded = ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            var ip = !string.IsNullOrWhiteSpace(forwarded)
                ? forwarded.Split(',')[0].Trim()
                : ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

            var ua = ctx.Request.Headers.UserAgent.ToString();

            var raw = $"{salt}|{day:yyyy-MM-dd}|{ip}|{ua}|{userId ?? ""}";
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));

            return Convert.ToHexString(bytes)[..32].ToLowerInvariant();
        }
    }
}
