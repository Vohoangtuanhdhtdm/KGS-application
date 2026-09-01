using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace kgs_api.Common.Filters
{
    /// <summary>
    /// Gắn lên controller/action chỉ được phép chạy ở môi trường Development.
    /// Ở môi trường khác trả 404 (không phải 403) — không tiết lộ sự tồn tại của endpoint.
    ///
    /// Dùng: [DevelopmentOnly] trên class DiagnosticsController và SeedController.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public sealed class DevelopmentOnlyAttribute : ActionFilterAttribute
    {
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            var env = context.HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>();

            if (!env.IsDevelopment())
            {
                context.Result = new NotFoundResult();
                return;
            }

            base.OnActionExecuting(context);
        }
    }
}


