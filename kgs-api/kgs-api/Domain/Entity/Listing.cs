using kgs_api.Common;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.ValueObjects;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity
{
    /// <summary>Tin đăng công khai — BẢN ĐĂNG của một tài sản, không phải bản sao của nó.
    ///
    /// Trước đây entity này tên là Property và tự giữ 13 trường mô tả vật lý trùng hoàn toàn
    /// với Asset: City, District, Ward, AddressDetail, Area, Location, Floors, Bedrooms,
    /// Bathrooms, HouseDirection, LegalStatus, FurnitureState, UserId. Hai bản ghi mô tả
    /// cùng một căn nhà, sửa một bên thì bên kia lệch âm thầm.
    ///
    /// Nay mọi thuộc tính vật lý đọc qua navigation Asset. Listing chỉ giữ những gì thực sự
    /// thuộc về VIỆC ĐĂNG TIN: tiêu đề, mô tả rao, giá chào, kiểm duyệt, slug, lượt xem, ảnh.
    ///
    /// AssetUnitId mở ra thứ hệ thống cũ không làm được: đăng tin cho TỪNG PHÒNG. Đây đúng
    /// là nghiệp vụ của người thuê nguyên căn rồi chia phòng cho thuê lại.</summary>
    public class Listing : BaseAuditableEntity
    {
        [Required] public Guid AssetId { get; set; }
        public Asset Asset { get; set; } = null!;

        /// <summary>null = đăng nguyên căn; có giá trị = đăng riêng một tầng/phòng.</summary>
        public Guid? AssetUnitId { get; set; }
        public AssetUnit? AssetUnit { get; set; }

        [Required(ErrorMessage = "Tiêu đề không được để trống")]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        /// <summary>Giá chào của TIN ĐĂNG — khác Asset.CurrentValue (giá trị nội bộ ước tính)
        /// và khác LeaseContract.RentAmount (giá đã chốt trên hợp đồng).</summary>
        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal Price { get; set; }

        public ListingType Type { get; set; } = ListingType.Rent;

        /// <summary>Chỉ có giá trị khi Type = Rent.</summary>
        public PaymentCycle? RentPaymentCycle { get; set; }

        public ListingStatus Status { get; set; } = ListingStatus.Pending;

        /// <summary>URL thân thiện, VD: "phong-tro-quan-7-a1b2c3" — tránh lộ khoá chính.</summary>
        [MaxLength(300)] public string? Slug { get; set; }

        public int ViewCount { get; set; }

        /// <summary>Thời điểm được duyệt và hiện công khai. null = chưa từng được duyệt.</summary>
        public DateTime? PublishedAt { get; set; }

        /// <summary>Lý do từ chối / ghi chú của admin. Trước đây lý do từ chối chỉ được
        /// echo lại trong response rồi vứt đi, chủ tin không bao giờ biết vì sao bị loại.</summary>
        [MaxLength(500)] public string? ModerationNote { get; set; }

        /// <summary>Lần "đẩy tin" gần nhất. Marketplace sắp xếp theo mốc này trước, rồi mới
        /// tới PublishedAt — đẩy tin đưa nó lên đầu danh sách mà không cần đăng lại từ đầu.
        ///
        /// Đây cũng là mốc tính hạn hiển thị: tin không được đẩy sẽ tự đóng sau một thời
        /// gian, để marketplace không đầy những tin đã cho thuê từ lâu.</summary>
        public DateTime? BumpedAt { get; set; }

        /// <summary>Điều kiện thuê thật: cọc, điện nước, phí, nội quy. Xem ListingTerms
        /// để biết vì sao đây là điều kiện tiên quyết của AI Agent tìm kiếm.</summary>
        public ListingTerms Terms { get; set; } = new();

        /// <summary>Tiện nghi, map sang text[] của PostgreSQL. Khoá lấy từ AmenityKeys.</summary>
        public List<string> Amenities { get; set; } = new();

        /// <summary>Cột tsvector do PostgreSQL tự sinh từ Title + Description, đã bỏ dấu.
        ///
        /// Là NHÁNH TỪ KHOÁ của tìm kiếm lai. Sinh phía CSDL (generated column) thay vì
        /// tính trong C#: không bao giờ lệch với nội dung, và không cần nhớ cập nhật khi
        /// sửa tin. Bỏ dấu để người gõ "phong tro quan 7" vẫn ra kết quả.
        ///
        /// EF chỉ đọc, không bao giờ ghi cột này.</summary>
        public NpgsqlTypes.NpgsqlTsVector? SearchVector { get; private set; }

        public ICollection<ListingImage> Images { get; set; } = new List<ListingImage>();
    }
}
