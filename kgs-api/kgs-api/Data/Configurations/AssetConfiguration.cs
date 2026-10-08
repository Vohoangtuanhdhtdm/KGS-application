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
                addr.Property(x => x.NewProvinceCode).HasColumnName("NewProvinceCode").HasMaxLength(10);
                addr.Property(x => x.NewProvince).HasColumnName("NewProvince").HasMaxLength(100);
                addr.Property(x => x.NewWardCode).HasColumnName("NewWardCode").HasMaxLength(10);
                addr.Property(x => x.NewWard).HasColumnName("NewWard").HasMaxLength(100);
                // Lọc theo phường/tỉnh mới đi qua chỉ mục, như lọc theo tỉnh/quận cũ.
                addr.HasIndex(x => x.NewWardCode);
                addr.HasIndex(x => x.NewProvinceCode);
            });
            b.Property(a => a.Location).HasColumnType("geography (point, 4326)");
            b.Property(a => a.FootprintJson).HasColumnType("jsonb");
            b.HasIndex(a => a.Location).HasMethod("gist");
            b.Navigation(a => a.Address).IsRequired();

            b.OwnsOne(a => a.Thumbnail);                 // Thumbnail_Url, Thumbnail_PublicId...

            b.HasOne(a => a.User)
             .WithMany()
             .HasForeignKey(a => a.UserId)
             .OnDelete(DeleteBehavior.Cascade);          // xoá user → xoá tài sản riêng tư của họ

            // Index cho các truy vấn nóng nhất
            b.HasIndex(a => a.UserId);
            b.HasIndex(a => new { a.UserId, a.Status });
            b.HasIndex(a => new { a.UserId, a.TypeProperty });
        }
    }
}
