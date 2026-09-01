// Data/Configurations/UsagePeriodConfiguration.cs
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class UsagePeriodConfiguration : IEntityTypeConfiguration<UsagePeriod>
    {
        public void Configure(EntityTypeBuilder<UsagePeriod> b)
        {
            b.ToTable("UsagePeriods");
            b.HasOne(u => u.Asset).WithMany(a => a.UsagePeriods)
             .HasForeignKey(u => u.AssetId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(u => u.AssetId);
        }
    }
}