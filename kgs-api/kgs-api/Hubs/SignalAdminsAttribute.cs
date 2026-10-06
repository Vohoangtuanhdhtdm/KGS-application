using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.SignalR;

namespace kgs_api.Hubs
{
    /// <summary>Sau một thao tác GHI thành công, báo cho mọi quản trị viên đang mở trang để hàng
    /// đợi duyệt, số báo vi phạm, danh sách người dùng… tự làm mới.
    ///
    /// Trước đây chủ tin gửi duyệt hay người dùng báo vi phạm thì admin không biết cho tới khi
    /// tự tải lại trang; hai admin cùng duyệt thì không thấy tin người kia vừa xử lý. Gắn lên
    /// action/controller thay vì chèn vào từng service: nơi phát sinh việc cho admin nằm rải rác
    /// (gửi duyệt, báo vi phạm, mọi thao tác quản trị) mà sự kiện chỉ có một nghĩa — "hàng đợi
    /// vừa đổi, tải lại đi".
    ///
    /// GET và mọi kết quả lỗi (4xx/5xx, ngoại lệ) không phát gì.</summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public sealed class SignalAdminsAttribute : Attribute, IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var done = await next();
            var http = context.HttpContext;
            if (HttpMethods.IsGet(http.Request.Method)) return;
            if (done.Exception is not null && !done.ExceptionHandled) return;
            if (done.Result is ObjectResult { StatusCode: >= 400 } or StatusCodeResult { StatusCode: >= 400 }) return;

            try
            {
                var hub = http.RequestServices.GetRequiredService<IHubContext<NotificationsHub>>();
                await hub.Clients.Group(NotificationsHub.AdminsGroup)
                    .SendAsync(NotificationsHub.AdminEventName, http.RequestAborted);
            }
            catch (Exception ex)
            {
                http.RequestServices.GetRequiredService<ILogger<SignalAdminsAttribute>>()
                    .LogWarning(ex, "Không đẩy được sự kiện hàng đợi tới quản trị viên");
            }
        }
    }
}
