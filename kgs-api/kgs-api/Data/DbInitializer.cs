using kgs_api.Data;
using kgs_api.Domain.Entity;
using Microsoft.AspNetCore.Identity;

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
    }
}


