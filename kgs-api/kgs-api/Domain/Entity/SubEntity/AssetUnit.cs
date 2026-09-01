using kgs_api.Common;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    public class AssetUnit : BaseAuditableEntity
    {
        public Guid AssetId { get; set; }
        public Asset Asset { get; set; } = null!;

        [Required, MaxLength(100)] public string Name { get; set; } = string.Empty; // "Tầng 2", "Phòng 301"
        public int? FloorNumber { get; set; }
        public double? Area { get; set; }
        public UnitStatus Status { get; set; } = UnitStatus.Vacant;
        public string? Notes { get; set; }
    }
}
