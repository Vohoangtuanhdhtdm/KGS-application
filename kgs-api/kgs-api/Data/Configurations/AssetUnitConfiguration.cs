// Data/Configurations/AssetUnitConfiguration.cs
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class AssetUnitConfiguration : IEntityTypeConfiguration<AssetUnit>
    {
        public void Configure(EntityTypeBuilder<AssetUnit> b)
        {
            b.ToTable("AssetUnits");
            b.HasOne(u => u.Asset).WithMany(a => a.Units)
             .HasForeignKey(u => u.AssetId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(u => u.AssetId);
        }
    }
}