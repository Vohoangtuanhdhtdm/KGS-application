using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace kgs_api.Hubs
{
    /// <summary>Kênh đẩy sự kiện tới trình duyệt của MỘT người dùng.
    ///
    /// Trước đây trạng thái tin chỉ đổi trên màn hình chủ tin khi trang tự tải lại — admin
    /// duyệt xong, chủ tin vẫn thấy "Chờ duyệt" cho tới khi đăng nhập lại. Nay mỗi thông báo
    /// trong ứng dụng (duyệt, trả tin, gỡ tin, có người hỏi thuê…) được đẩy ngay qua đây và
    /// giao diện tự làm mới dữ liệu liên quan.
    ///
    /// Hub không nhận lệnh nào từ client: chỉ một chiều máy chủ → trình duyệt. Gửi theo
    /// Clients.User(userId) — SignalR lấy userId từ claim NameIdentifier của JWT.</summary>
    [Authorize]
    public sealed class NotificationsHub : Hub
    {
        public const string Path = "/hubs/notifications";
        public const string EventName = "notification";
    }
}
