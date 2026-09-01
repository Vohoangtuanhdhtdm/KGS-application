using kgs_api.Common;
using kgs_api.Domain.ValueObjects;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    // Giấy tờ pháp lý & hợp đồng dịch vụ
    public class AssetDocument : BaseAuditableEntity
    {
        public Guid AssetId { get; set; }
        public Asset Asset { get; set; } = null!;

        public DocumentType Type { get; set; }
        [Required, MaxLength(255)] public string Title { get; set; } = string.Empty;
        public StoredFile File { get; set; } = new();

        public DateTime? IssueDate { get; set; }
        public DateTime? ExpiryDate { get; set; }        // HĐ điện/nước/thuê có thời hạn
        public string? Notes { get; set; }

        // Phụ lục / HĐ thuê gắn với hợp đồng cụ thể
        public Guid? LeaseContractId { get; set; }
        public LeaseContract? LeaseContract { get; set; }
    }
}
