using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class LeaseContractConfiguration : IEntityTypeConfiguration<LeaseContract>
    {
        public void Configure(EntityTypeBuilder<LeaseContract> b)
        {
            b.ToTable("LeaseContracts", t =>
            {
                t.HasCheckConstraint("CK_LeaseContract_Dates", "\"EndDate\" > \"StartDate\"");
                t.HasCheckConstraint("CK_LeaseContract_DueDay", "\"PaymentDueDay\" BETWEEN 1 AND 31");
                t.HasCheckConstraint("CK_LeaseContract_Rent", "\"RentAmount\" >= 0");
            });

            b.HasOne(c => c.Asset).WithMany(a => a.Contracts)
             .HasForeignKey(c => c.AssetId).OnDelete(DeleteBehavior.Cascade);

            b.HasOne(c => c.AssetUnit).WithMany()
             .HasForeignKey(c => c.AssetUnitId).OnDelete(DeleteBehavior.SetNull);

            b.HasOne(c => c.Counterparty).WithMany()
             .HasForeignKey(c => c.CounterpartyId)
             .OnDelete(DeleteBehavior.Restrict);         // không cho xoá contact còn dính hợp đồng

            b.HasOne(c => c.ParentContract).WithMany()
             .HasForeignKey(c => c.ParentContractId).OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(c => c.AssetId);
            b.HasIndex(c => new { c.Status, c.EndDate }); // job quét HĐ sắp hết hạn
                                                          // Partial index PostgreSQL: chỉ index HĐ đang hiệu lực
            b.HasIndex(c => c.EndDate)
             .HasDatabaseName("IX_LeaseContracts_Active_EndDate")
             .HasFilter("\"Status\" = 2"); // ContractStatus.Active
        }
    }
}
