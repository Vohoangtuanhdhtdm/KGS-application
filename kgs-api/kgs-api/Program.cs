using Hangfire;
using kgs_api.Data;
using kgs_api.Extensions;
using kgs_api.Interfaces;
using kgs_api.Services;
using kgs_api.Utility;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using static kgs_api.Common.Common;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplicationServices(builder.Configuration, builder.Environment);
builder.Services.AddKgsRateLimiting();


builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "KGS API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. \r\n\r\n Nhập từ khóa 'Bearer' [khoảng trắng] và dán Token của bạn vào bên dưới.\r\n\r\nVí dụ: 'Bearer eyJhbGci...'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = ParameterLocation.Header
            },
            new List<string>()
        }
    });
});


var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Sau reverse proxy (nginx trên EC2, CloudFront phía trước), request tới Kestrel là HTTP
// thuần và mang IP của proxy chứ không phải của người dùng. Không đọc X-Forwarded-* thì ba
// thứ hỏng cùng lúc: chuyển hướng HTTPS quay vòng, liên kết tuyệt đối sinh ra "http://",
// và bộ giới hạn tốc độ gom mọi người dùng vào đúng một ngăn theo IP của proxy.
var forwarded = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
};
// Mặc định ASP.NET chỉ tin proxy ở loopback. Trong Docker, nginx nằm ở container khác nên
// địa chỉ của nó không phải loopback — không xoá hai danh sách này thì header bị bỏ qua
// hoàn toàn, lặng lẽ, và triệu chứng chỉ hiện ra dưới dạng vòng lặp chuyển hướng.
forwarded.KnownNetworks.Clear();
forwarded.KnownProxies.Clear();
app.UseForwardedHeaders(forwarded);

// Trong container, TLS kết thúc ở nginx/CloudFront; Kestrel không có chứng chỉ nào để
// chuyển hướng sang, nên bật chuyển hướng HTTPS ở đây chỉ tạo ra vòng lặp vô hạn. Biến
// DOTNET_RUNNING_IN_CONTAINER do chính ảnh nền của Microsoft đặt sẵn.
if (Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER") != "true")
{
    app.UseHttpsRedirection();
}

// Đặt TRƯỚC MapControllers cho rõ ý: mọi DomainException từ service được map sang
// ProblemDetails 400/404/409 thay vì rơi ra ngoài thành 500.
app.UseMiddleware<DomainExceptionMiddleware>();

// Origin đọc từ cấu hình — hard-code localhost:8081 sẽ chặn đứng frontend sau khi
// deploy lên AWS/CloudFront. Xem appsettings.json > Cors:AllowedOrigins.
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:8081" };

app.UseCors(policy => policy
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()
    .WithOrigins(allowedOrigins));


app.UseAuthentication();
app.UseAuthorization();

// SAU UseAuthentication: chính sách chia ngăn theo user id khi đã đăng nhập, mà danh tính
// chỉ tồn tại sau khi token được giải mã. Đặt trước thì mọi request đều rơi vào ngăn IP, và
// cả văn phòng dùng chung NAT sẽ chia nhau một hạn mức.
app.UseRateLimiter();

// Seed role + admin — chạy một lần lúc khởi động
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    // Áp migration khi được bật TƯỜNG MINH qua RunMigrations=true.
    //
    // Không bật mặc định vì nó chỉ an toàn khi có đúng một tiến trình: nhân bản lên hai
    // container mà cùng chạy migration lúc khởi động thì hai tiến trình cùng sửa schema.
    // Ở quy mô một máy EC2 như hiện tại, đây là cách triển khai gọn nhất — schema luôn khớp
    // với mã vừa deploy, không cần một bước thủ công mà ai đó sẽ quên.
    //
    // Phải chạy TRƯỚC seed: SeedRolesAndAdminAsync ghi vào bảng Identity, mà những bảng đó
    // chỉ tồn tại sau khi migration chạy xong.
    if (builder.Configuration.GetValue("RunMigrations", false))
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        logger.LogInformation("Đang áp migration cơ sở dữ liệu…");
        await db.Database.MigrateAsync();
        logger.LogInformation("Đã áp xong migration.");
    }

    await DbInitializer.SeedRolesAndAdminAsync(app.Services, builder.Configuration, logger);

    var recurringJobs = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();
    recurringJobs.AddOrUpdate<RefreshTokenCleanupJob>(
        "refresh-token-cleanup", j => j.RunAsync(CancellationToken.None), Cron.Daily);
    recurringJobs.AddOrUpdate<ReminderProcessingJob>(
        "reminders", j => j.RunAsync(CancellationToken.None), "*/15 * * * *");
    recurringJobs.AddOrUpdate<FileCleanupJob>(
        "file-cleanup", j => j.RunAsync(CancellationToken.None), "*/30 * * * *");

    // 00:30 UTC = 07:30 giờ Việt Nam — đóng hợp đồng hết hạn trước giờ làm việc,
    // để danh sách phòng trống buổi sáng đã đúng.
    recurringJobs.AddOrUpdate<ContractExpiryJob>(
        "contract-expiry", j => j.RunAsync(CancellationToken.None), "30 0 * * *");

    // 01:00 UTC = 08:00 gio Viet Nam — dong tin qua han truoc gio nguoi dung vao xem,
    // de marketplace buoi sang khong con tin da cho thue tu lau.
    recurringJobs.AddOrUpdate<ListingExpiryJob>(
        "listing-expiry", j => j.RunAsync(CancellationToken.None), "0 1 * * *");

    // 01:30 UTC = 08:30 gio Viet Nam — gui sau job dong tin qua han, de email khong bao ve
    // mot tin vua bi dong ngay sang hom do.
    recurringJobs.AddOrUpdate<SavedSearchAlertJob>(
        "saved-search-alerts", j => j.RunAsync(CancellationToken.None), "30 1 * * *");
}






app.MapControllers();

// Thăm dò sống-chết cho Docker và nginx.
//
// Cố ý KHÔNG chạm cơ sở dữ liệu và KHÔNG trả về chi tiết nào. Endpoint này công khai trên
// internet, nên nó không được lộ trạng thái hạ tầng; và một healthcheck truy vấn DB mỗi 30
// giây vừa tự tạo tải, vừa biến một sự cố DB thoáng qua thành việc container bị khai tử và
// khởi động lại — đúng lúc hệ thống cần nó đứng vững nhất.
// (Endpoint chẩn đoán đầy đủ nằm ở /api/diagnostics/health và chỉ bật ở môi trường Development.)
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

// Hangfire Dashboard (optional, cho dev)
if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard();
}


app.Run();
