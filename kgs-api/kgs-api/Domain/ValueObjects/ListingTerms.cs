using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.ValueObjects
{
    /// <summary>Điều kiện thuê thật của một tin đăng.
    ///
    /// Trước đây toàn bộ những thông tin này bị nhét vào ô Description dạng văn xuôi, tức là
    /// KHÔNG truy vấn được. Đó là lý do form đăng tin phải sửa TRƯỚC khi làm AI Agent tìm kiếm:
    /// agent chỉ chuyển được "cho phép nuôi mèo" thành điều kiện lọc nếu PetsAllowed tồn tại
    /// như một cột thật. Nếu để trong văn xuôi, agent buộc phải đoán bằng ngữ nghĩa — và
    /// embedding của "không nuôi thú cưng" gần như trùng với "được nuôi thú cưng".
    /// Vector search không phân biệt được phủ định.
    ///
    /// Mọi trường đều nullable: null nghĩa là chủ tin CHƯA KHAI, khác hẳn với false (đã khai
    /// là không). Bộ lọc cứng chỉ khớp khi giá trị được khai tường minh.</summary>
    [Owned]
    public class ListingTerms
    {
        // ---------- Chi phí thật ----------

        /// <summary>Số tháng tiền cọc (thường 1–2 ở thị trường Việt Nam).</summary>
        [Range(0, 12)] public int? DepositMonths { get; set; }

        [Column(TypeName = "decimal(18,2)")] public decimal? ElectricityPrice { get; set; }  // đ/kWh
        [Column(TypeName = "decimal(18,2)")] public decimal? WaterPrice { get; set; }

        /// <summary>Nước tính theo khối hay theo đầu người — hai cách phổ biến ở nhà trọ VN,
        /// và người thuê so sánh rất khác nhau giữa hai cách.</summary>
        public WaterPricingMode? WaterPricing { get; set; }

        [Column(TypeName = "decimal(18,2)")] public decimal? ServiceFee { get; set; }    // đ/tháng
        [Column(TypeName = "decimal(18,2)")] public decimal? ParkingFee { get; set; }    // đ/tháng
        [Column(TypeName = "decimal(18,2)")] public decimal? InternetFee { get; set; }   // đ/tháng

        // ---------- Điều kiện thuê ----------

        [Range(1, 60)] public int? MinLeaseMonths { get; set; }

        /// <summary>Ngày sớm nhất có thể dọn vào. Dùng để loại sớm những tin không thể thuê
        /// được vào đúng thời điểm khách cần.</summary>
        public DateTime? AvailableFrom { get; set; }

        [Range(1, 20)] public int? MaxOccupants { get; set; }

        // ---------- Nội quy ----------
        // Nhóm nhị phân — chính là nhóm mà tìm kiếm ngữ nghĩa sai nhiều nhất.

        public bool? PetsAllowed { get; set; }
        public bool? CurfewFree { get; set; }        // giờ giấc tự do
        public bool? SharedWithOwner { get; set; }   // ở chung chủ
        public bool? CookingAllowed { get; set; }
    }

    /// <summary>Danh mục tiện nghi cố định. Lưu dưới dạng text[] của PostgreSQL kèm GIN index
    /// nên truy vấn "có máy lạnh VÀ WC riêng" chạy thẳng trên index.
    ///
    /// Khoá được cố định ở đây để backend validate và frontend hiển thị nhãn cùng một nguồn —
    /// tránh cảnh mỗi bên tự gõ một chuỗi rồi lệch nhau.</summary>
    public static class AmenityKeys
    {
        public const string AirConditioner = "air_conditioner";
        public const string WaterHeater = "water_heater";
        public const string PrivateBathroom = "private_bathroom";
        public const string PrivateKitchen = "private_kitchen";
        public const string Loft = "loft";                     // gác lửng
        public const string Balcony = "balcony";
        public const string Window = "window";                 // cửa sổ / thoáng sáng
        public const string Wifi = "wifi";
        public const string Parking = "parking";
        public const string Elevator = "elevator";
        public const string Security = "security";             // bảo vệ / camera
        public const string Furnished = "furnished";
        public const string WashingMachine = "washing_machine";
        public const string Fridge = "fridge";

        public static readonly IReadOnlySet<string> All = new HashSet<string>
        {
            AirConditioner, WaterHeater, PrivateBathroom, PrivateKitchen, Loft, Balcony,
            Window, Wifi, Parking, Elevator, Security, Furnished, WashingMachine, Fridge
        };
    }
}
