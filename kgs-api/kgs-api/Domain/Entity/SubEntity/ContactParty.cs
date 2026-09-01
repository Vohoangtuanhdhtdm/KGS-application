using kgs_api.Common;
using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    // Đối tác: người thuê, chủ nhà, môi giới, nhà thầu
    public class ContactParty : BaseAuditableEntity
    {
        [Required] public string UserId { get; set; } = string.Empty;  // sổ địa chỉ riêng của từng user
        public ApplicationUser User { get; set; } = null!;

        public ContactType Type { get; set; }
        [Required, MaxLength(255)] public string FullName { get; set; } = string.Empty;
        [MaxLength(20)] public string? Phone { get; set; }
        [MaxLength(255)] public string? Email { get; set; }
        [MaxLength(20)] public string? IdNumber { get; set; }         // CCCD — cân nhắc mã hoá cột nếu yêu cầu bảo mật cao
        public string? Notes { get; set; }
    }
}
