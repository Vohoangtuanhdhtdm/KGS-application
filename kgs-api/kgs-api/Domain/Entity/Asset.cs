using kgs_api.Common;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.ValueObjects;
using NetTopologySuite.Geometries;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity
{
    public class Asset : BaseAuditableEntity
    {
        [Required] public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        [Required, MaxLength(255)] public string Name { get; set; } = string.Empty;
        public AssetDomainType TypeProperty { get; set; } // bị trùng tên
        public AssetOwnershipType OwnershipType { get; set; } = AssetOwnershipType.Owned;
        public AssetStatus Status { get; set; } = AssetStatus.InUse;

        public Address Address { get; set; } = new();          // Value Object
        public double? Area { get; set; }                       // m²
        public double? Frontage { get; set; }                   // mặt tiền (m) — chuyển từ Property sang

        [Column(TypeName = "decimal(18,2)")] public decimal? CurrentValue { get; set; } // giá trị hiện tại
        public DateTime? AcquisitionDate { get; set; }          // ngày mua (Owned) / ngày bắt đầu thuê (Leasehold)

        public StoredFile? Thumbnail { get; set; }              // thay ThumbnailUrl
        public string? Notes { get; set; }

        // ← THÊM TỪ ĐÂY — 6 trường mô tả chi tiết, dùng cho cả quản lý nội bộ lẫn đăng tin công khai.
        // Đều nullable vì không phải loại tài sản nào cũng có ý nghĩa (VD: Đất không có phòng ngủ/tắm).
        public int? Floors { get; set; }
        public int? Bedrooms { get; set; }
        public int? Bathrooms { get; set; }
        public string? HouseDirection { get; set; }    // "Đông Nam", "Tây Bắc"...
        public string? LegalStatus { get; set; }       // "Sổ hồng riêng", "Đang chờ sổ"...
        public string? FurnitureState { get; set; }    // "Đầy đủ", "Cơ bản", "Không nội thất"

        public Point? Location { get; set; }

        // ---- Mô hình toà nhà 3D ("Toà nhà → Tầng → Căn") ----
        // Không lưu tệp 3D nào: toà nhà được DỰNG từ chính dữ liệu đã có — khung (đường viền
        // trên bản đồ), số tầng (Floors) và các căn đã khai (Units theo FloorNumber). Lưu ở đây
        // chỉ là khung và chiều cao tầng; phần chia căn tính lại ở trình duyệt mỗi lần xem.

        /// <summary>Đường viền toà nhà: mảng [lng, lat] (vòng ngoài, không cần khép kín).</summary>
        public string? FootprintJson { get; set; }
        /// <summary>Chiều cao một tầng (m). Null = mặc định 3,2 m.</summary>
        public double? FloorHeightMeters { get; set; }
        /// <summary>Chủ nhà đã xem trước và cho phép người tìm nhà xem mô hình.</summary>
        public bool BuildingModelPublished { get; set; }

        // Navigations
        public ICollection<AssetUnit> Units { get; set; } = new List<AssetUnit>();
        public ICollection<AssetMedia> Media { get; set; } = new List<AssetMedia>();

        // Tin đăng công khai của tài sản này. Quan hệ đã ĐẢO CHIỀU so với
        // Asset.LinkedPropertyId cũ: nay Listing trỏ về Asset, và một tài sản có thể
        // có nhiều tin — một tin cho nguyên căn, hoặc mỗi phòng một tin.
        public ICollection<Listing> Listings { get; set; } = new List<Listing>();
    }
}
