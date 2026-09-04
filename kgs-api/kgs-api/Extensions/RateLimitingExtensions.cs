using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace kgs_api.Extensions
{
    /// <summary>Giới hạn tần suất cho các thao tác dễ bị lạm dụng (nhiệm vụ 1.10).
    ///
    /// Mỗi endpoint ở đây đều tạo ra thứ gì đó mà người khác phải đọc: tin đăng vào hàng
    /// đợi kiểm duyệt, yêu cầu xem nhà vào hộp thư chủ nhà, báo vi phạm vào hàng đợi quản
    /// trị. Không chặn thì một script chạy vài phút là đủ làm cả ba hàng đợi vô dụng — và
    /// người phải dọn là con người, không phải máy.
    ///
    /// Cố ý KHÔNG giới hạn các endpoint đọc: tìm kiếm và xem tin là thứ nền tảng muốn có
    /// càng nhiều càng tốt, và chặn nhầm ở đó thì hỏng đúng việc chính.</summary>
    public static class RateLimitingExtensions
    {
        /// <summary>Đăng tin và gửi tin đi duyệt.</summary>
        public const string CreateListing = "create-listing";

        /// <summary>Yêu cầu xem nhà và báo vi phạm — thứ rơi thẳng vào hộp thư người khác.</summary>
        public const string ContactOthers = "contact-others";

        /// <summary>Đăng nhập, quên mật khẩu — chặn dò mật khẩu.</summary>
        public const string Auth = "auth";

        public static IServiceCollection AddKgsRateLimiting(this IServiceCollection services)
        {
            services.AddRateLimiter(options =>
            {
                // 429 kèm Retry-After, thay vì 503 mặc định. Client phải phân biệt được
                // "bạn gửi quá nhanh" với "máy chủ hỏng" — hai thứ đó cần hai cách xử lý
                // hoàn toàn khác nhau ở phía giao diện.
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.OnRejected = async (ctx, ct) =>
                {
                    if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                        ctx.HttpContext.Response.Headers.RetryAfter =
                            ((int)retryAfter.TotalSeconds).ToString();

                    await ctx.HttpContext.Response.WriteAsJsonAsync(new
                    {
                        message = "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút."
                    }, ct);
                };

                // Cửa sổ TRƯỢT chứ không phải cố định. Với cửa sổ cố định, ai cũng dồn được
                // gấp đôi hạn mức quanh mốc chuyển cửa sổ — 10 lần cuối phút này cộng 10 lần
                // đầu phút sau là 20 lần trong vài giây.
                options.AddPolicy(CreateListing, PartitionByUserOrIp(limit: 10, minutes: 10));
                options.AddPolicy(ContactOthers, PartitionByUserOrIp(limit: 20, minutes: 10));
                options.AddPolicy(Auth, PartitionByUserOrIp(limit: 10, minutes: 5));
            });

            return services;
        }

        /// <summary>Chia ngăn theo người dùng khi đã đăng nhập, theo IP khi chưa.
        ///
        /// Chỉ chia theo IP thì cả một văn phòng hay cả một nhà mạng dùng NAT sẽ dùng chung
        /// một hạn mức — người thứ hai trong công ty đăng tin sẽ bị chặn vì người thứ nhất.
        /// Chỉ chia theo người dùng thì endpoint đăng nhập không chia được, vì lúc đó chưa
        /// có ai cả.</summary>
        private static Func<HttpContext, RateLimitPartition<string>> PartitionByUserOrIp(
            int limit, int minutes)
        {
            return ctx =>
            {
                var userId = ctx.User?.FindFirst(
                    System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

                var key = !string.IsNullOrEmpty(userId)
                    ? $"u:{userId}"
                    : $"ip:{ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";

                return RateLimitPartition.GetSlidingWindowLimiter(key, _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = limit,
                    Window = TimeSpan.FromMinutes(minutes),
                    SegmentsPerWindow = 6,
                    QueueLimit = 0   // vượt hạn mức thì từ chối ngay, không bắt chờ
                });
            };
        }
    }
}
