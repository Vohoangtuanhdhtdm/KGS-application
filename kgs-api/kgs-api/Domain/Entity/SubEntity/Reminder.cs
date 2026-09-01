using kgs_api.Common;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    // Nhắc lịch
    public class Reminder : BaseAuditableEntity
    {
        [Required] public string UserId { get; set; } = string.Empty; // denormalize — job quét theo user
        public Guid? AssetId { get; set; }
        public Asset? Asset { get; set; }
        public Guid? LeaseContractId { get; set; }
        public LeaseContract? LeaseContract { get; set; }

        public ReminderType Type { get; set; }
        [Required, MaxLength(255)] public string Title { get; set; } = string.Empty;
        public DateTime DueDate { get; set; }            // lần đến hạn KẾ TIẾP
        public RecurrenceCycle Cycle { get; set; } = RecurrenceCycle.None;
        public int NotifyDaysBefore { get; set; } = 3;
        public bool IsActive { get; set; } = true;
        public DateTime? LastNotifiedAt { get; set; }
    }
}
