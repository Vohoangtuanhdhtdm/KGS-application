using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class AssetDocumentConfiguration : IEntityTypeConfiguration<AssetDocument>
    {
        public void Configure(EntityTypeBuilder<AssetDocument> b)
        {
            b.OwnsOne(d => d.File);
            b.HasIndex(d => new { d.AssetId, d.Type });
            b.HasIndex(d => d.ExpiryDate);               // quét giấy tờ sắp hết hạn
            b.HasOne(d => d.LeaseContract).WithMany(c => c.Documents)
             .HasForeignKey(d => d.LeaseContractId).OnDelete(DeleteBehavior.SetNull);
        }
    }
}
