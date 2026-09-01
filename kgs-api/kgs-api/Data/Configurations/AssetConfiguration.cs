using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class AssetConfiguration : IEntityTypeConfiguration<Asset>
    {
        public void Configure(EntityTypeBuilder<Asset> b)
        {
            b.ToTable("Assets");

            b.OwnsOne(a => a.Address, addr =>
            {
                addr.Property(x => x.City).HasColumnName("City").HasMaxLength(100).IsRequired();
                addr.Property(x => x.District).HasColumnName("District").HasMaxLength(100).IsRequired();
                addr.Property(x => x.Ward).HasColumnName("Ward").HasMaxLength(100).IsRequired();
                addr.Property(x => x.Detail).HasColumnName("AddressDetail").HasMaxLength(500);
            });
            b.Property(a => a.Location).HasColumnType("geography (point, 4326)");
            b.HasIndex(a => a.Location).HasMethod("gist");
            b.Navigation(a => a.Address).IsRequired();

            b.OwnsOne(a => a.Thumbnail);                 // Thumbnail_Url, Thumbnail_PublicId...

            b.HasOne(a => a.User)
             .WithMany()
             .HasForeignKey(a => a.UserId)
             .OnDelete(DeleteBehavior.Cascade);          // xoá user → xoá tài sản riêng tư của họ

            b.HasOne(a => a.LinkedProperty)
             .WithMany()
             .HasForeignKey(a => a.LinkedPropertyId)
             .OnDelete(DeleteBehavior.SetNull);          // xoá tin đăng KHÔNG xoá tài sản

            b.HasOne(a => a.SaleListing)
             .WithOne(s => s.Asset)
             .HasForeignKey<SaleListing>(s => s.AssetId);

            // Index cho các truy vấn nóng nhất
            b.HasIndex(a => a.UserId);
            b.HasIndex(a => new { a.UserId, a.Status });
            b.HasIndex(a => new { a.UserId, a.TypeProperty });
        }
    }
}
