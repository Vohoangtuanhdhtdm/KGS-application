using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class ListingInquiryConfiguration : IEntityTypeConfiguration<ListingInquiry>
    {
        public void Configure(EntityTypeBuilder<ListingInquiry> b)
        {
            b.ToTable("ListingInquiries");

            b.HasOne(x => x.Property).WithMany()
             .HasForeignKey(x => x.PropertyId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.FromUser).WithMany()
             .HasForeignKey(x => x.FromUserId)
             .OnDelete(DeleteBehavior.Cascade);

            // Restrict: đã chuyển thành khách thuê rồi thì không cho xoá đối tác
            // mà vẫn giữ yêu cầu trỏ vào khoảng không.
            b.HasOne(x => x.ConvertedContactParty).WithMany()
             .HasForeignKey(x => x.ConvertedContactPartyId)
             .OnDelete(DeleteBehavior.Restrict);

            // Hai truy vấn nóng: hộp thư của chủ nhà, và "yêu cầu tôi đã gửi".
            b.HasIndex(x => new { x.ToUserId, x.CreatedAt });
            b.HasIndex(x => new { x.FromUserId, x.CreatedAt });

            // Chống spam: mỗi người chỉ một yêu cầu ĐANG MỞ trên một tin.
            // Partial unique index — yêu cầu đã Đóng/Đã chuyển không chặn gửi lại.
            b.HasIndex(x => new { x.PropertyId, x.FromUserId })
             .IsUnique()
             .HasDatabaseName("UX_ListingInquiries_OpenPerUser")
             .HasFilter("\"Status\" IN (1, 2, 3)");
        }
    }
}
