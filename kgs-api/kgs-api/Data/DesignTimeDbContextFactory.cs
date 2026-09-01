using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace kgs_api.Data
{
    /// <summary>Cho phép `dotnet ef migrations add` dựng DbContext mà KHÔNG chạy Program.cs.
    ///
    /// Nếu thiếu factory này, EF Tools phải khởi động toàn bộ host để lấy service provider —
    /// kéo theo Hangfire, seeding và các recurring job, tất cả đều đòi một PostgreSQL đang
    /// chạy thật. Tạo migration là việc offline, không nên phụ thuộc database.</summary>
    public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
    {
        public ApplicationDbContext CreateDbContext(string[] args)
        {
            var config = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: true)
                .AddJsonFile("appsettings.Development.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            // Chuỗi kết nối chỉ dùng để EF biết provider là Npgsql — lệnh migrations add
            // không mở kết nối nào.
            var connectionString = config.GetConnectionString("PostgresDb")
                ?? "Host=localhost;Port=5432;Database=kgs_db;Username=postgres;Password=postgres";

            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(connectionString, o => o.UseNetTopologySuite())
                .Options;

            return new ApplicationDbContext(options);
        }
    }
}
