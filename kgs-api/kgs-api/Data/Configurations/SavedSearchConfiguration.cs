using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class SavedSearchConfiguration : IEntityTypeConfiguration<SavedSearch>
    {
        public void Configure(EntityTypeBuilder<SavedSearch> b)
        {
            b.ToTable("SavedSearches");

            b.Property(x => x.CriteriaJson).HasColumnType("jsonb");

            b.HasOne(x => x.User).WithMany()
             .HasForeignKey(x => x.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            // Danh sách bộ lọc đã lưu của một người, mới nhất trước.
            b.HasIndex(x => new { x.UserId, x.CreatedAt });

            // Job đối chiếu chỉ đụng tới các bộ lọc còn bật thông báo. Lọc ngay trên index
            // để job không phải quét cả bảng khi phần lớn người dùng đã tắt báo.
            b.HasIndex(x => x.LastCheckedAt)
             .HasFilter("\"NotifyEnabled\"");
        }
    }
}
