using kgs_api.Common;
using System.ComponentModel.DataAnnotations.Schema;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Entity.SubEntity
{
    // Hợp đồng thuê — MỘT bảng cho cả hai chiều
    public class LeaseContract : BaseAuditableEntity
    {
        public Guid AssetId { get; set; }
        public Asset Asset { get; set; } = null!;

        public Guid? AssetUnitId { get; set; }           // null = nguyên căn; có giá trị = theo tầng/phòng
        public AssetUnit? AssetUnit { get; set; }

        public ContractDirection Direction { get; set; } // LeaseOut: user cho thuê | LeaseIn: user đi thuê
        public ContractStatus Status { get; set; } = ContractStatus.Draft;

        public Guid CounterpartyId { get; set; }         // LeaseOut → người thuê; LeaseIn → chủ nhà
        public ContactParty Counterparty { get; set; } = null!;

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        [Column(TypeName = "decimal(18,2)")] public decimal RentAmount { get; set; }
        public PaymentCycle PaymentCycle { get; set; } = PaymentCycle.Monthly;
        public int PaymentDueDay { get; set; } = 1;      // ngày thanh toán trong kỳ (1–31)
        [Column(TypeName = "decimal(18,2)")] public decimal? DepositAmount { get; set; }
        public DateTime? NextRentIncreaseDate { get; set; }  // "thời gian tăng giá tiếp theo"
        public TaxResponsibility TaxResponsibility { get; set; } = TaxResponsibility.Landlord;

        // Chuỗi gia hạn: HĐ mới / phụ lục trỏ về HĐ gốc → "lịch sử cho thuê" tự nhiên
        public Guid? ParentContractId { get; set; }
        public LeaseContract? ParentContract { get; set; }

        public string? Notes { get; set; }
        public ICollection<AssetDocument> Documents { get; set; } = new List<AssetDocument>();
    }
}
