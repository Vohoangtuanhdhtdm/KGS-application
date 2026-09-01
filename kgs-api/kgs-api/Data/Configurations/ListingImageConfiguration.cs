using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class ListingImageConfiguration : IEntityTypeConfiguration<ListingImage>
    {
        public void Configure(EntityTypeBuilder<ListingImage> b)
        {
            b.ToTable("ListingImages");

            b.OwnsOne(x => x.File);

            b.HasOne(x => x.Listing).WithMany(l => l.Images)
             .HasForeignKey(x => x.ListingId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => x.ListingId);   // KHÔNG unique — một tin nhiều ảnh
        }
    }
}
