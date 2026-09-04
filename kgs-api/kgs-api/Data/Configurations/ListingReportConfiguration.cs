using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using static kgs_api.Domain.Enums;

namespace kgs_api.Data.Configurations
{
    public class ListingReportConfiguration : IEntityTypeConfiguration<ListingReport>
    {
        public void Configure(EntityTypeBuilder<ListingReport> b)
        {
            b.ToTable("ListingReports");

            b.HasOne(x => x.Listing).WithMany()
             .HasForeignKey(x => x.ListingId)
             .OnDelete(DeleteBehavior.Cascade);   // gỡ tin → báo cáo về tin đó không còn nghĩa

            b.HasOne(x => x.Reporter).WithMany()
             .HasForeignKey(x => x.ReporterUserId)
             // Giữ báo cáo lại khi tài khoản người báo bị xoá: hàng đợi kiểm duyệt không
             // được rỗng đi vì một người dùng rời nền tảng.
             .OnDelete(DeleteBehavior.Restrict);

            // Hàng đợi kiểm duyệt: các báo cáo chưa xử lý, cũ nhất trước.
            b.HasIndex(x => new { x.Status, x.CreatedAt });

            // Một người chỉ có MỘT báo cáo đang chờ trên mỗi tin. Không có ràng buộc này,
            // một người bực mình có thể bấm báo hai chục lần và đẩy tin đó lên đầu hàng đợi
            // như thể cả chục người khác nhau cùng phản ánh.
            //
            // Chặn ở tầng CSDL chứ không chỉ ở service: hai request gửi song song sẽ cùng
            // vượt qua bước kiểm tra "đã có chưa" rồi cùng ghi.
            b.HasIndex(x => new { x.ListingId, x.ReporterUserId })
             .IsUnique()
             .HasFilter($"\"Status\" = {(int)ListingReportStatus.Pending}")
             .HasDatabaseName("UX_ListingReports_OnePendingPerReporter");
        }
    }
}
