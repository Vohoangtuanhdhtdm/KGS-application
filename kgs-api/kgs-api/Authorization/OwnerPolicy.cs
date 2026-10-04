using System.Security.Claims;
using kgs_api.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Authorization
{
    public static class AppPolicies
    {
        /// <summary>Chức năng của Chủ nhà: đăng/sửa/quản lý tin, tài sản, hợp đồng, thu chi,
        /// hộp thư người hỏi thuê. Mọi tài khoản đã đăng nhập TRỪ quản trị viên.</summary>
        public const string Owner = "Owner";
    }

    /// <summary>Tài khoản quản trị không đồng thời là Chủ nhà.
    ///
    /// Admin duyệt tin của người khác; nếu chính họ cũng đăng tin thì tin đó do ai duyệt, và
    /// số liệu "tin của tôi" lẫn với số liệu toàn hệ thống. Tách hẳn hai vai trò: tài khoản
    /// quản trị chỉ quản trị.</summary>
    public sealed class NotAdminRequirement : IAuthorizationRequirement
    {
        public const string Message =
            "Tài khoản quản trị không dùng chức năng Chủ nhà. Hãy dùng một tài khoản thường để đăng và quản lý tin.";
    }

    /// <summary>Đối chiếu với CSDL qua UserAccessGuard thay vì chỉ đọc claim trong JWT: người
    /// VỪA được cấp quyền Admin còn cầm token cũ (không có claim Admin) vẫn bị chặn ngay.</summary>
    public sealed class NotAdminHandler : AuthorizationHandler<NotAdminRequirement>
    {
        private readonly UserAccessGuard _guard;
        private readonly IHttpContextAccessor _http;

        public NotAdminHandler(UserAccessGuard guard, IHttpContextAccessor http)
        {
            _guard = guard; _http = http;
        }

        protected override async Task HandleRequirementAsync(
            AuthorizationHandlerContext context, NotAdminRequirement requirement)
        {
            var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userId is null || context.User.IsInRole("Admin")) return;
            var ct = _http.HttpContext?.RequestAborted ?? CancellationToken.None;
            var access = await _guard.GetAsync(userId, ct);
            if (!access.IsAdmin) context.Succeed(requirement);
        }
    }

    /// <summary>403 mặc định không có nội dung — giao diện chỉ hiện được "lỗi không xác định".
    /// Với chính sách Chủ nhà, trả ProblemDetails nói rõ vì sao.</summary>
    public sealed class OwnerForbiddenResultHandler : IAuthorizationMiddlewareResultHandler
    {
        private readonly AuthorizationMiddlewareResultHandler _default = new();

        public async Task HandleAsync(
            RequestDelegate next, HttpContext context, AuthorizationPolicy policy, PolicyAuthorizationResult result)
        {
            if (result.Forbidden
                && result.AuthorizationFailure?.FailedRequirements.OfType<NotAdminRequirement>().Any() == true)
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Không có quyền",
                    Detail = NotAdminRequirement.Message,
                }, options: null, contentType: "application/problem+json");
                return;
            }
            await _default.HandleAsync(next, context, policy, result);
        }
    }
}
