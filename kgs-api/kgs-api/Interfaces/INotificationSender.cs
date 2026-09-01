namespace kgs_api.Interfaces
{
    // ============================================================
    // D2 — BACKGROUND JOB (Hangfire/Quartz gọi định kỳ, VD mỗi 15 phút)
    // ============================================================

    /// <summary>Abstraction gửi thông báo — thay bằng FCM/APNs/Email khi tích hợp thật.</summary>
    public interface INotificationSender
    {
        Task SendAsync(string userId, string title, string body, CancellationToken ct = default);
    }
}
