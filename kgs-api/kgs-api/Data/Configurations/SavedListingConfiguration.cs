using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class SavedListingConfiguration : IEntityTypeConfiguration<SavedListing>
    {
        public void Configure(EntityTypeBuilder<SavedListing> b)
        {
            b.ToTable("SavedListings");

            // Khoá tổ hợp → thao tác lưu tin idempotent ở ngay tầng CSDL.
            b.HasKey(x => new { x.UserId, x.ListingId });

            b.HasOne(x => x.User).WithMany()
             .HasForeignKey(x => x.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Listing).WithMany()
             .HasForeignKey(x => x.ListingId)
             .OnDelete(DeleteBehavior.Cascade);   // gỡ tin → mọi lượt lưu biến mất theo

            // Danh sách "tin đã lưu" luôn sắp xếp theo thời điểm lưu, mới nhất trước.
            b.HasIndex(x => new { x.UserId, x.SavedAt });
        }
    }
}
