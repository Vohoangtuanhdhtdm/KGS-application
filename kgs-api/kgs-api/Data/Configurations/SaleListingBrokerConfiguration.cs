// Data/Configurations/SaleListingBrokerConfiguration.cs
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class SaleListingBrokerConfiguration : IEntityTypeConfiguration<SaleListingBroker>
    {
        public void Configure(EntityTypeBuilder<SaleListingBroker> b)
        {
            b.ToTable("SaleListingBrokers");
            b.HasKey(x => new { x.SaleListingId, x.BrokerId });   // BẮT BUỘC — khoá tổ hợp

            b.HasOne(x => x.SaleListing)
             .WithMany(s => s.Brokers)
             .HasForeignKey(x => x.SaleListingId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Broker)
             .WithMany()
             .HasForeignKey(x => x.BrokerId)
             .OnDelete(DeleteBehavior.Restrict);
        }
    }
}