using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class ListingModerationEventConfiguration : IEntityTypeConfiguration<ListingModerationEvent>
    {
        public void Configure(EntityTypeBuilder<ListingModerationEvent> b)
        {
            b.ToTable("ListingModerationEvents");

            b.HasOne(x => x.Listing).WithMany()
             .HasForeignKey(x => x.ListingId)
             .OnDelete(DeleteBehavior.Cascade);   // gỡ tin → lịch sử kiểm duyệt của nó hết nghĩa

            b.HasOne(x => x.Moderator).WithMany()
             .HasForeignKey(x => x.ModeratorUserId)
             // Giữ lại lịch sử khi tài khoản kiểm duyệt viên bị xoá. Lưu vết mà biến mất
             // cùng người thực hiện thì không còn là lưu vết.
             .OnDelete(DeleteBehavior.Restrict);

            // Đọc lịch sử của một tin, mới nhất trước — truy vấn duy nhất mà cả trang quản
            // trị lẫn trang của chủ tin đều dùng.
            b.HasIndex(x => new { x.ListingId, x.CreatedAt });

            // Mảng enum map sang integer[] của PostgreSQL, giống cách Listing.Amenities map
            // sang text[]. Không dựng bảng nối riêng: các lý do luôn được đọc trọn gói theo
            // sự kiện, không bao giờ truy vấn ngược từ lý do ra sự kiện.
            b.Property(x => x.Reasons).HasColumnType("integer[]");
        }
    }
}
