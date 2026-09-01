using kgs_api.Common;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    // Trang thiết bị
    public class Equipment : BaseAuditableEntity
    {
        public Guid AssetId { get; set; }
        public Asset Asset { get; set; } = null!;
        public Guid? AssetUnitId { get; set; }
        public AssetUnit? AssetUnit { get; set; }

        [Required, MaxLength(255)] public string Name { get; set; } = string.Empty;
        public int Quantity { get; set; } = 1;
        public EquipmentCondition Condition { get; set; } = EquipmentCondition.Good;
        public EquipmentSource Source { get; set; } = EquipmentSource.OwnerProvided;
        public string? Notes { get; set; }
    }
}
