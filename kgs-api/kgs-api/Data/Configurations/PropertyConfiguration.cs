using kgs_api.Domain.Entity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class PropertyConfiguration : IEntityTypeConfiguration<Property>
    {
        public void Configure(EntityTypeBuilder<Property> b)
        {
            b.ToTable("Properties");

            // Quan hệ với ApplicationUser — Property.cs đã có [ForeignKey("UserId")] trên
            // navigation User, EF tự nhận diện khoá ngoại từ đó. Khai báo lại ở đây CHỈ để
            // chỉ rõ OnDelete behavior (nếu không khai báo, EF Core suy luận mặc định là
            // Cascade cho quan hệ bắt buộc — ở đây khai báo tường minh cho dễ đọc, khớp với
            // Asset.UserId cũng dùng Cascade: xoá user thì xoá luôn tin đăng của họ).
            b.HasOne(p => p.User)
             .WithMany()
             .HasForeignKey(p => p.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            // ---- Index cho các truy vấn nóng nhất ----

            // Trang "Tin đăng của tôi" (GetMyListingsAsync) — lọc theo UserId
            b.HasIndex(p => p.UserId);

            // Trang marketplace công khai (SearchPublicAsync) — LUÔN lọc theo Status=Approved,
            // thường kèm lọc theo Type (Bán/Cho thuê) — composite index phủ cả 2 điều kiện
            b.HasIndex(p => new { p.Status, p.Type });

            // URL thân thiện /tin-dang/{slug} — BẮT BUỘC unique, đây là khoá tra cứu chính
            // của trang chi tiết công khai (GetPublicBySlugAsync)
            b.HasIndex(p => p.Slug).IsUnique();

            b.Property(p => p.Location).HasColumnType("geography (point, 4326)");
            b.HasIndex(p => p.Location).HasMethod("gist");
        }
    }
}
