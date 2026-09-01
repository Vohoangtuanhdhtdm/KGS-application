using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class CashFlowEntryConfiguration : IEntityTypeConfiguration<CashFlowEntry>
    {
        public void Configure(EntityTypeBuilder<CashFlowEntry> b)
        {
            b.ToTable("CashFlowEntries", t =>
                t.HasCheckConstraint("CK_CashFlow_Amount", "\"Amount\" > 0"));

            b.OwnsOne(e => e.Receipt);

            b.HasOne(e => e.Asset).WithMany(a => a.CashFlows)
             .HasForeignKey(e => e.AssetId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(e => e.LeaseContract).WithMany()
             .HasForeignKey(e => e.LeaseContractId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(e => e.AssetUnit).WithMany()
             .HasForeignKey(e => e.AssetUnitId).OnDelete(DeleteBehavior.SetNull);

            // Ba index phục vụ ba dạng báo cáo trong tài liệu
            b.HasIndex(e => new { e.AssetId, e.OccurredAt });                 // báo cáo theo tài sản + khoảng thời gian
            b.HasIndex(e => new { e.UserId, e.OccurredAt });                  // tổng thu nhập theo thời gian tự chọn
            b.HasIndex(e => new { e.UserId, e.Category, e.OccurredAt });      // tổng thuế theo năm
        }
    }
}
