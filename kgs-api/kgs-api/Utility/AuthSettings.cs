namespace kgs_api.Utility
{
    public class AuthSettings
    {
        /// <summary>Thời hạn access token (phút). Ngắn để giảm thiệt hại khi token bị lộ.</summary>
        public int AccessTokenMinutes { get; set; } = 60;

        /// <summary>Thời hạn refresh token (ngày).</summary>
        public int RefreshTokenDays { get; set; } = 7;

        /// <summary>Base URL của frontend — dùng để dựng link xác thực email / đặt lại mật khẩu.</summary>
        public string ClientBaseUrl { get; set; } = "http://localhost:5173";

        /// <summary>Bắt buộc xác thực email mới cho đăng nhập? Đặt false ở dev để test nhanh.</summary>
        public bool RequireConfirmedEmail { get; set; } = false;
    }
}
