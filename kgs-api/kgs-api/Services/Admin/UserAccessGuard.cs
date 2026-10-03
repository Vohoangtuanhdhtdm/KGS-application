using kgs_api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace kgs_api.Services.Admin
{
    /// <summary>Cho thao tác khoá tài khoản và thu quyền Admin có hiệu lực NGAY, không đợi
    /// access token hết hạn.
    ///
    /// Vai trò và trạng thái nằm trong JWT sống 60 phút: không có lớp này, người vừa bị khoá
    /// vì lừa đảo vẫn đăng tin, nhắn tin thêm gần một giờ; người vừa bị thu quyền vẫn vào được
    /// trang quản trị. Mỗi request đã xác thực được đối chiếu với CSDL — qua bộ nhớ đệm 30 giây
    /// để không thêm một truy vấn cho mọi request, và bị xoá ngay khi admin đổi trạng thái.</summary>
    public sealed class UserAccessGuard
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);
        private readonly IMemoryCache _cache;
        private readonly IServiceScopeFactory _scopes;

        public UserAccessGuard(IMemoryCache cache, IServiceScopeFactory scopes)
        {
            _cache = cache; _scopes = scopes;
        }

        public sealed record Access(bool Exists, bool LockedByAdmin, bool IsAdmin);

        public async Task<Access> GetAsync(string userId, CancellationToken ct)
        {
            if (_cache.TryGetValue(Key(userId), out Access? hit) && hit is not null) return hit;

            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var now = DateTimeOffset.UtcNow;
            var row = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    Locked = u.AdminLockedAt != null && u.LockoutEnd != null && u.LockoutEnd > now,
                    Admin = db.UserRoles.Any(ur => ur.UserId == u.Id
                        && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == "Admin")),
                })
                .FirstOrDefaultAsync(ct);

            var access = row is null ? new Access(false, false, false) : new Access(true, row.Locked, row.Admin);
            _cache.Set(Key(userId), access, Ttl);
            return access;
        }

        /// <summary>Gọi ngay sau khi khoá/mở khoá/đổi quyền.</summary>
        public void Invalidate(string userId) => _cache.Remove(Key(userId));

        private static string Key(string userId) => $"access:{userId}";
    }
}
