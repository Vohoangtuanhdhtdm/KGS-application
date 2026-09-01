using kgs_api.Common;
using kgs_api.Domain.ValueObjects;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    // SỔ CÁI THU/CHI — trái tim của mọi báo cáo (thu nhập, lợi nhuận, thuế)
    public class CashFlowEntry : BaseAuditableEntity
    {
        // Denormalize UserId: báo cáo tổng hợp toàn bộ tài sản của user
        // không phải JOIN qua Assets — quyết định có chủ đích (xem Phần 3)
        [Required] public string UserId { get; set; } = string.Empty;

        public Guid AssetId { get; set; }
        public Asset Asset { get; set; } = null!;
        public Guid? AssetUnitId { get; set; }
        public AssetUnit? AssetUnit { get; set; }
        public Guid? LeaseContractId { get; set; }       // tiền thuê gắn với HĐ nào
        public LeaseContract? LeaseContract { get; set; }

        public CashFlowDirection Direction { get; set; }
        public CashFlowCategory Category { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal Amount { get; set; }  // luôn dương, Direction quyết định dấu
        public DateTime OccurredAt { get; set; }
        public DateTime? PeriodStart { get; set; }       // kỳ mà khoản tiền này chi trả (VD: tiền thuê T7/2026)
        public DateTime? PeriodEnd { get; set; }

        [MaxLength(500)] public string? Description { get; set; }
        public StoredFile? Receipt { get; set; }         // hoá đơn / biên lai đính kèm
    }
}
