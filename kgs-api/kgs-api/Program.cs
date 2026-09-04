using Hangfire;
using kgs_api.Data;
using kgs_api.Extensions;
using kgs_api.Interfaces;
using kgs_api.Services;
using kgs_api.Utility;
using Microsoft.OpenApi.Models;
using static kgs_api.Common.Common;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplicationServices(builder.Configuration, builder.Environment);


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

app.UseHttpsRedirection();

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

// Seed role + admin — chạy một lần lúc khởi động
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
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
// Hangfire Dashboard (optional, cho dev)
if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard();
}


app.Run();
