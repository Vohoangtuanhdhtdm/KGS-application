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

        // Liên kết tin đăng công khai — giữ nguyên từ UserAsset
        public int? LinkedPropertyId { get; set; }
        public Property? LinkedProperty { get; set; }
        public Point? Location { get; set; }

        // Navigations
        public ICollection<AssetUnit> Units { get; set; } = new List<AssetUnit>();
        public ICollection<AssetMedia> Media { get; set; } = new List<AssetMedia>();
        public ICollection<AssetDocument> Documents { get; set; } = new List<AssetDocument>();
        public ICollection<LeaseContract> Contracts { get; set; } = new List<LeaseContract>();
        public ICollection<Equipment> Equipments { get; set; } = new List<Equipment>();
        public ICollection<MaintenanceRecord> MaintenanceRecords { get; set; } = new List<MaintenanceRecord>();
        public ICollection<CashFlowEntry> CashFlows { get; set; } = new List<CashFlowEntry>();
        public ICollection<UsagePeriod> UsagePeriods { get; set; } = new List<UsagePeriod>();
        public SaleListing? SaleListing { get; set; }
    }
}
