using kgs_api.Data;
using kgs_api.Domain.Entity;
using Microsoft.EntityFrameworkCore;

namespace kgs_api.Services
{
    /// <summary>
    /// Xoá refresh token đã hết hạn hoặc bị thu hồi quá lâu.
    /// Bảng RefreshTokens phình nhanh nếu không dọn (mỗi lần refresh sinh 1 dòng mới).
    /// </summary>
    public sealed class RefreshTokenCleanupJob
    {
        private const int RetentionDays = 30;   // giữ token đã thu hồi 30 ngày để audit

        private readonly ApplicationDbContext _db;
        private readonly ILogger<RefreshTokenCleanupJob> _logger;

        public RefreshTokenCleanupJob(ApplicationDbContext db, ILogger<RefreshTokenCleanupJob> logger)
        {
            _db = db;
            _logger = logger;
        }

        public async Task RunAsync(CancellationToken ct)
        {
            var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);

            var deleted = await _db.Set<RefreshToken>()
                .Where(t => t.ExpiresAt < cutoff || (t.RevokedAt != null && t.RevokedAt < cutoff))
                .ExecuteDeleteAsync(ct);      // EF Core 7+ — xoá thẳng, không load vào memory

            if (deleted > 0)
                _logger.LogInformation("Đã dọn {Count} refresh token hết hạn.", deleted);
        }
    }
}
