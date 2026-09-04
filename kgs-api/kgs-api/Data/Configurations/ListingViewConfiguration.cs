using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class ListingViewConfiguration : IEntityTypeConfiguration<ListingView>
    {
        public void Configure(EntityTypeBuilder<ListingView> b)
        {
            b.ToTable("ListingViews");

            b.HasOne(x => x.Listing).WithMany()
             .HasForeignKey(x => x.ListingId)
             .OnDelete(DeleteBehavior.Cascade);

            // Một người, một tin, một ngày = một lượt.
            //
            // Chặn ở tầng CSDL chứ không chỉ ở service, vì đây đúng là chỗ hay có request
            // song song nhất: người dùng bấm F5 liên tục, hoặc mở trang ở hai tab. Kiểm tra
            // "đã có chưa" rồi mới ghi sẽ thua cuộc đua đó.
            b.HasIndex(x => new { x.ListingId, x.ViewerHash, x.ViewedOn })
             .IsUnique()
             .HasDatabaseName("UX_ListingViews_OnePerViewerPerDay");

            // Biểu đồ lượt xem theo ngày của một tin quét đúng theo cặp cột này.
            b.HasIndex(x => new { x.ListingId, x.ViewedOn });
        }
    }
}
