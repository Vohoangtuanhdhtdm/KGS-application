namespace kgs_api.Services.Voice
{
    /// <summary>Cấu hình Gemini Live cho trợ lý giọng nói KiGi (mục "Gemini" trong appsettings).
    /// Khoá thật chỉ đặt trong appsettings.Development.json (đã gitignore), giống khoá Groq.</summary>
    public sealed class GeminiSettings
    {
        public string ApiKey { get; set; } = "";

        /// <summary>Mô hình nghe–nói. Dự phòng: "gemini-3.1-flash-live-preview".</summary>
        public string LiveModel { get; set; } = "gemini-3.8-live";

        /// <summary>Giọng đọc — chọn sau bài thử tiếng Việt (Leda, Aoede, Kore, Puck).</summary>
        public string Voice { get; set; } = "Kore";

        /// <summary>Thời lượng tối đa một phiên; token còn hiệu lực thêm 1 phút cho chắc.</summary>
        public int SessionMinutes { get; set; } = 3;
    }
}
