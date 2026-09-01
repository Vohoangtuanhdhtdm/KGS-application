// Data/Configurations/SaleListingConfiguration.cs
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class SaleListingConfiguration : IEntityTypeConfiguration<SaleListing>
    {
        public void Configure(EntityTypeBuilder<SaleListing> b)
        {
            b.ToTable("SaleListings");
            b.HasIndex(s => s.AssetId).IsUnique();   // 1–1 với Asset
        }
    }
}