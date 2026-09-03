using kgs_api.Domain.Entity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class ListingConfiguration : IEntityTypeConfiguration<Listing>
    {
        public void Configure(EntityTypeBuilder<Listing> b)
        {
            b.ToTable("Listings", t =>
                t.HasCheckConstraint("CK_Listing_Price", "\"Price\" >= 0"));

            b.OwnsOne(l => l.Terms);
            b.Navigation(l => l.Terms).IsRequired();

            // text[] + GIN: truy vấn "có máy lạnh VÀ WC riêng" chạy thẳng trên index thay vì
            // quét bảng. Đây là cột mà AI Agent sẽ lọc cứng nhiều nhất.
            b.Property(l => l.Amenities).HasColumnType("text[]");
            b.HasIndex(l => l.Amenities).HasMethod("gin");

            // Nhánh từ khoá của tìm kiếm lai. f_unaccent là hàm bọc IMMUTABLE quanh
            // unaccent() — bản gốc không IMMUTABLE nên PostgreSQL từ chối dùng nó trong
            // generated column. Hàm này được tạo ở migration cùng lượt.
            b.Property(l => l.SearchVector)
             .HasComputedColumnSql(
                 @"to_tsvector('simple', f_unaccent(coalesce(""Title"", '') || ' ' || coalesce(""Description"", '')))",
                 stored: true);
            b.HasIndex(l => l.SearchVector).HasMethod("gin");

            b.HasOne(l => l.Asset).WithMany(a => a.Listings)
             .HasForeignKey(l => l.AssetId)
             .OnDelete(DeleteBehavior.Cascade);          // xoá tài sản → gỡ tin đăng của nó

            b.HasOne(l => l.AssetUnit).WithMany()
             .HasForeignKey(l => l.AssetUnitId)
             .OnDelete(DeleteBehavior.Cascade);          // xoá phòng → gỡ tin đăng của phòng đó

            // Trang marketplace công khai LUÔN lọc Status = Approved, thường kèm Type
            b.HasIndex(l => new { l.Status, l.Type });

            // /tin-dang/{slug} là khoá tra cứu chính của trang chi tiết công khai
            b.HasIndex(l => l.Slug).IsUnique();

            // "Tin đăng của tôi" và trang chi tiết tài sản đều lọc theo tài sản
            b.HasIndex(l => l.AssetId);

            // Một tài sản (hoặc một phòng) chỉ được có MỘT tin đang sống tại một thời điểm.
            // Partial unique index: tin đã Rejected/Closed không chặn việc đăng lại.
            b.HasIndex(l => new { l.AssetId, l.AssetUnitId })
             .IsUnique()
             .HasDatabaseName("UX_Listings_OneLivePerSlot")
             .HasFilter("\"Status\" IN (1, 2)");
        }
    }
}
