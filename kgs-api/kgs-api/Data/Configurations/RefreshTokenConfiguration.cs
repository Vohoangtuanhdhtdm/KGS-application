using kgs_api.Domain.Entity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
    {
        public void Configure(EntityTypeBuilder<RefreshToken> b)
        {
            b.ToTable("RefreshTokens");

            b.Property(x => x.Token).HasMaxLength(200).IsRequired();
            b.Property(x => x.ReplacedByToken).HasMaxLength(200);
            b.Property(x => x.CreatedByIp).HasMaxLength(64);

            b.HasOne(x => x.User)
             .WithMany(u => u.RefreshTokens)
             .HasForeignKey(x => x.UserId)
             .OnDelete(DeleteBehavior.Cascade);   // xoá user → xoá token của họ

            // Tra token khi refresh — truy vấn nóng nhất của bảng này
            b.HasIndex(x => x.Token).IsUnique();

            // Dọn token hết hạn + liệt kê phiên đang hoạt động của 1 user
            b.HasIndex(x => new { x.UserId, x.ExpiresAt });

            // Bỏ qua computed properties
            b.Ignore(x => x.IsExpired);
            b.Ignore(x => x.IsActive);
        }
    }
}
