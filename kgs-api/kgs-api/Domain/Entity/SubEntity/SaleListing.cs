using kgs_api.Common;
using System.ComponentModel.DataAnnotations.Schema;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    // Rao bán
    public class SaleListing : BaseAuditableEntity
    {
        public Guid AssetId { get; set; }                // 1–1 với Asset
        public Asset Asset { get; set; } = null!;

        [Column(TypeName = "decimal(18,2)")] public decimal AskingPrice { get; set; }
        public SaleListingStatus Status { get; set; } = SaleListingStatus.Active;
        public DateTime ListedAt { get; set; }
        public string? AgreementNotes { get; set; }      // "các thoả thuận khác"

        public ICollection<SaleListingBroker> Brokers { get; set; } = new List<SaleListingBroker>();
    }

    // N–N có payload: môi giới đã gửi
    public class SaleListingBroker
    {
        public Guid SaleListingId { get; set; }
        public SaleListing SaleListing { get; set; } = null!;
        public Guid BrokerId { get; set; }               // ContactParty.Type = Broker
        public ContactParty Broker { get; set; } = null!;

        public DateTime SentAt { get; set; }
        public string? Notes { get; set; }
    }
}
