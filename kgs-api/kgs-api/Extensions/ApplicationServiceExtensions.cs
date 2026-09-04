using Hangfire;
using Hangfire.PostgreSql;
using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Infrastructure.Persistence.Interceptors;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using kgs_api.Services;
using kgs_api.Storage;
using kgs_api.Utility;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using NetTopologySuite;
using System.Text;
using static kgs_api.Common.Common;

namespace kgs_api.Extensions
{
    public static class ApplicationServiceExtensions
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration config, IWebHostEnvironment env)
        {
            var connectionString = config.GetConnectionString("PostgresDb") ?? throw new InvalidOperationException("Connection string 'PostgresDb' not found.");

            services.AddHttpContextAccessor();
            services.AddScoped<ICurrentUserService, CurrentUserService>();

            // Database — interceptor tự điền CreatedAt/UpdatedAt/CreatedBy/UpdatedBy.
            // Trước đây interceptor được viết nhưng KHÔNG đăng ký, nên toàn bộ cột audit
            // giữ nguyên default(DateTime) và AssetService.SearchAsync sắp xếp theo
            // CreatedAt trả về thứ tự vô nghĩa.
            services.AddScoped<AuditableEntityInterceptor>();
            services.AddDbContext<ApplicationDbContext>((sp, options) =>
                options.UseNpgsql(connectionString, o => o.UseNetTopologySuite())
                       .AddInterceptors(sp.GetRequiredService<AuditableEntityInterceptor>()));

            services.AddSingleton(NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326));

            // Token Provider Tool
            services.AddDataProtection();
            services.AddScoped<RefreshTokenCleanupJob>();

            // Identity
            services.AddIdentityCore<ApplicationUser>(options =>
            {
                // Mật khẩu
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = false;      // nới lỏng cho dễ dùng ở VN
                options.Password.RequireNonAlphanumeric = false;

                // Khoá tài khoản khi sai mật khẩu nhiều lần — chống brute force
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;

                // Email là duy nhất
                options.User.RequireUniqueEmail = true;

                // Bắt buộc xác thực email mới đăng nhập được (điều khiển qua AuthSettings ở tầng service)
                options.SignIn.RequireConfirmedEmail = false;
            })
                .AddRoles<IdentityRole>()
                .AddEntityFrameworkStores<ApplicationDbContext>()
                .AddDefaultTokenProviders();

            services.Configure<AuthSettings>(config.GetSection("AuthSettings"));
            services.AddScoped<IAuthService, AuthService>();

            //Đăng ký DI
            services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
            services.AddScoped<IUnitOfWork, EfUnitOfWork>();

            services.AddScoped<IListingService, ListingService>();
            services.AddScoped<IListingRetrievalService, ListingRetrievalService>();
            services.AddScoped<ISavedSearchService, SavedSearchService>();
            services.AddScoped<IListingReportService, ListingReportService>();
          


            services.Configure<CloudinarySettings>(config.GetSection("CloudinarySettings"));
            services.AddScoped<IFileStorageService, CloudinaryFileStorageService>();

            // mail-server
            services.Configure<SmtpSettings>(config.GetSection("SmtpSettings"));
            //if (env.IsDevelopment())
            //    services.AddScoped<IEmailSender, ConsoleEmailSender>();
            //else
            services.AddScoped<IEmailSender, SmtpEmailSender>();

            services.AddScoped<IAssetService, AssetService>();
            services.AddScoped<IAssetMediaService, AssetMediaService>();
            services.AddScoped<IAssetDocumentService, AssetDocumentService>();
            services.AddScoped<IAssetUnitService, AssetUnitService>();
            services.AddScoped<IContactPartyService, ContactPartyService>();
            services.AddScoped<ILeaseContractService, LeaseContractService>();
            services.AddScoped<ICashFlowService, CashFlowService>();
            services.AddScoped<IReportService, ReportService>();
            services.AddScoped<IReminderService, ReminderService>();
            services.AddScoped<IMarketplaceEngagementService, MarketplaceEngagementService>();
            services.AddScoped<INotificationSender, EmailNotificationSender>();
            services.Configure<GoogleAuthSettings>(config.GetSection("GoogleAuth"));


            //___
            services.AddControllers();
            services.AddHttpClient();
            services.AddCors();

            // Services
            services.AddScoped<ITokenService, TokenService>();

            // Đăng ký PhotoService
            services.AddScoped<IPhotoService, PhotoService>();

            // Ensure the JWT token is valid
            var secretKey = config["AppSettings:TokenKey"];
            if (string.IsNullOrEmpty(secretKey))
            {
                throw new InvalidOperationException("TokenKey is not configured.");
            }

            // Configure JWT authentication
            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
                        ValidateIssuer = false,
                        ValidateAudience = false,
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.Zero        // mặc định là 5 phút — token sẽ sống lâu hơn expires 5'
                    };
                });

            services.AddHangfire(configuration =>
                configuration
                    .SetDataCompatibilityLevel(CompatibilityLevel.Version_170)
                    .UseSimpleAssemblyNameTypeSerializer()
                    .UseRecommendedSerializerSettings()
                    .UsePostgreSqlStorage(c => c.UseNpgsqlConnection(connectionString)));

            // Thêm Hangfire Server
            services.AddHangfireServer();

            // Đăng ký các background job
            services.AddScoped<ReminderProcessingJob>();
            services.AddScoped<FileCleanupJob>();
            services.AddScoped<ContractExpiryJob>();
            services.AddScoped<ListingExpiryJob>();
            services.AddScoped<SavedSearchAlertJob>();

           

            return services;
        }
    }
}
