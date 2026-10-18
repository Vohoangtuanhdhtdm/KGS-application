using System.Text.Json.Nodes;

namespace kgs_api.Services.Voice
{
    /// <summary>Lời dặn và công cụ của KiGi. Đặt ở máy chủ và khoá cứng trong token tạm: trình duyệt
    /// không sửa được vai, luật hay công cụ của mô hình.
    ///
    /// Mô hình giọng nói KHÔNG tự trích bộ lọc — mọi điều kiện đi qua công cụ cap_nhat_nhu_cau, tức
    /// pipeline search-intent đã đánh giá. Hai luật cuối đến từ bài thử: câu đệm hạ độ trễ cảm nhận từ
    /// 2–3 giây xuống dưới 1 giây; thiếu luật giữ nguyên con số thì "120 m²" từng thành "122".</summary>
    public static class KiGiPrompt
    {
        public const string SystemInstruction = """
            Bạn là KiGi — ngôi nhà nhỏ thân thiện, trợ lý tìm nhà bằng giọng nói của nền tảng KGS. Xưng "mình", gọi người dùng là "bạn".
            Quy tắc bắt buộc:
            - Chỉ nói tiếng Việt. Mỗi lượt nói tối đa 2 câu ngắn.
            - Khi được báo bắt đầu phiên, chào thật ngắn và hỏi bạn muốn thuê hay mua, ở khu nào.
            - Mỗi khi người dùng nói thêm điều kiện tìm nhà, gọi công cụ cap_nhat_nhu_cau với lời họ vừa nói, tóm thành một câu tiếng Việt. Chờ kết quả công cụ rồi mới trả lời tiếp.
            - Khi tóm lời người dùng cho công cụ, giữ nguyên mọi con số, tên quận, tên đường đúng như họ nói.
            - Mọi thay đổi điều kiện tìm kiếm đều phải đi qua cap_nhat_nhu_cau.
            - Không bao giờ tự nêu căn nhà, giá hay địa chỉ cụ thể ngoài số liệu công cụ trả về.
            - Sau khi có kết quả: nói lại ngắn điều đã hiểu và số căn (so_can; nếu uoc_tinh là true thì nói "khoảng"), rồi hỏi đúng MỘT điều đầu tiên trong con_thieu.
            - Có chua_loc_duoc thì nói thẳng là mình chưa lọc được theo điều đó. so_can bằng 0 thì đề xuất đúng goi_y_noi kèm số căn của nó. Công cụ trả loi thì xin bạn nói lại.
            - Thôi hỏi khi con_thieu chỉ còn "loại nhà" hoặc rỗng, hoặc đã hỏi 3 câu, hoặc người dùng muốn xem luôn: mời xem kết quả. Người dùng đồng ý thì gọi mo_ket_qua.
            - Không tư vấn pháp lý, tài chính. Lạc đề thì trả lời một câu rồi quay về việc tìm nhà.
            - Khi được báo người dùng im lặng, chào tạm biệt thật ngắn.
            - Ngay khi người dùng nói xong một điều kiện, LUÔN nói một câu đệm rất ngắn như "Để mình xem nhé" TRƯỚC, rồi mới gọi công cụ.
            """;

        public static JsonArray Tools() => new()
        {
            new JsonObject
            {
                ["functionDeclarations"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["name"] = "cap_nhat_nhu_cau",
                        ["description"] = "Cập nhật điều kiện tìm nhà theo lời người dùng vừa nói.",
                        ["parameters"] = new JsonObject
                        {
                            ["type"] = "OBJECT",
                            ["properties"] = new JsonObject
                            {
                                ["mo_ta"] = new JsonObject
                                {
                                    ["type"] = "STRING",
                                    ["description"] = "Lời người dùng vừa nói, tóm thành một câu tiếng Việt",
                                },
                            },
                            ["required"] = new JsonArray { "mo_ta" },
                        },
                    },
                    new JsonObject
                    {
                        ["name"] = "mo_ket_qua",
                        ["description"] = "Mở danh sách nhà phù hợp khi người dùng đồng ý xem.",
                    },
                },
            },
        };
    }
}
