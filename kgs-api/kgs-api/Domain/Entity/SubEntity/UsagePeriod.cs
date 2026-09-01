using kgs_api.Common;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    // Lịch sử sử dụng (bản thân / con cái / người quen)
    public class UsagePeriod : BaseAuditableEntity
    {
        public Guid AssetId { get; set; }
        public Asset Asset { get; set; } = null!;

        public OccupantType OccupantType { get; set; }
        [MaxLength(255)] public string? OccupantName { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }           // null = đang sử dụng
        public string? Notes { get; set; }
    }
}
