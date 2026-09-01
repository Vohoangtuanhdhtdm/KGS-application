using Hangfire;
using kgs_api.Data;
using kgs_api.Extensions;
using kgs_api.Interfaces;
using kgs_api.Services;
using kgs_api.Utility;
using Microsoft.OpenApi.Models;
using static kgs_api.Common.Common;
using static Org.BouncyCastle.Math.EC.ECCurve;


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

app.UseCors(builder => builder
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()
    .WithOrigins("http://localhost:8081"));


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
}






app.MapControllers();
app.UseMiddleware<DomainExceptionMiddleware>();
// Hangfire Dashboard (optional, cho dev)
if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard();
}


app.Run();
