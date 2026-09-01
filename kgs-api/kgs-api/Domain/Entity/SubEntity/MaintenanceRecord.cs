using kgs_api.Common;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace kgs_api.Domain.Entity.SubEntity
{
    // Lịch sử sửa chữa / cải tạo
    public class MaintenanceRecord : BaseAuditableEntity
    {
        public Guid AssetId { get; set; }
        public Asset Asset { get; set; } = null!;
        public Guid? AssetUnitId { get; set; }
        public AssetUnit? AssetUnit { get; set; }

        [Required, MaxLength(255)] public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? CompletedDate { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal? Cost { get; set; }

        public Guid? VendorId { get; set; }              // nhà thầu (ContactParty.Type = Vendor)
        public ContactParty? Vendor { get; set; }
        public string? Notes { get; set; }
    }
}
