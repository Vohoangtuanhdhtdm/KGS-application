using kgs_api.Data;
using kgs_api.Domain.Entity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace kgs_api.Data
{
    public static class DbInitializer
    {
        public static readonly string[] Roles = { "Admin", "User" };

        public static async Task SeedRolesAndAdminAsync(
            IServiceProvider services, IConfiguration config, ILogger logger)
        {
            using var scope = services.CreateScope();
            var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

            // 1. Tạo role nếu chưa có
            foreach (var role in Roles)
            {
                if (!await roleManager.RoleExistsAsync(role))
                {
                    await roleManager.CreateAsync(new IdentityRole(role));
                    logger.LogInformation("Đã tạo role: {Role}", role);
                }
            }

            // 2. Tạo tài khoản Admin đầu tiên (chỉ khi cấu hình có và chưa tồn tại)
            var adminEmail = config["SeedAdmin:Email"];
            var adminPassword = config["SeedAdmin:Password"];

            if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword))
            {
                logger.LogInformation("Bỏ qua seed Admin — chưa cấu hình SeedAdmin:Email/Password.");
                return;
            }

            adminEmail = adminEmail.Trim().ToLowerInvariant();

            if (await userManager.FindByEmailAsync(adminEmail) is not null)
                return;   // đã tồn tại

            var admin = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                Name = config["SeedAdmin:Name"] ?? "Quản trị viên",
                EmailConfirmed = true,           // admin không cần xác thực email
                CreatedAt = DateTime.UtcNow
            };

            var result = await userManager.CreateAsync(admin, adminPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRolesAsync(admin, new[] { "Admin", "User" });
                logger.LogWarning("Đã tạo tài khoản Admin: {Email}. HÃY ĐỔI MẬT KHẨU NGAY.", adminEmail);
            }
            else
            {
                logger.LogError("Không tạo được Admin: {Errors}",
                    string.Join(", ", result.Errors.Select(e => e.Description)));
            }
        }

        /// <summary>Tính lại địa chỉ mới (sau sắp xếp 2025) cho mọi tài sản — để dữ liệu cũ có cột
        /// mới, và để những phường cũ bị chia được phân định lại khi có thêm ranh giới phường.
        /// Chỉ ghi những dòng thực sự đổi. Quét toàn bảng là ổn ở quy mô đồ án (vài trăm tài sản);
        /// dữ liệu lớn thì chuyển thành việc chạy một lần sau mỗi lần cập nhật danh mục.</summary>
        public static async Task BackfillNewAddressesAsync(IServiceProvider services, ILogger logger)
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var assets = await db.Assets.ToListAsync();
            foreach (var a in assets) a.Address.SyncNewUnits(a.Location);
            var changed = db.ChangeTracker.Entries().Count(e => e.State == EntityState.Modified);
            if (changed == 0) return;
            await db.SaveChangesAsync();
            logger.LogInformation("Đã cập nhật địa chỉ mới (2025) cho {Count} tài sản.", changed);
        }
    }
}


