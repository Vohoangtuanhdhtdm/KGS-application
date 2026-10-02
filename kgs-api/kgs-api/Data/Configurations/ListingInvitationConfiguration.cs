using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class ListingInvitationConfiguration : IEntityTypeConfiguration<ListingInvitation>
    {
        public void Configure(EntityTypeBuilder<ListingInvitation> b)
        {
            b.ToTable("ListingInvitations");

            b.HasOne(x => x.Listing).WithMany()
             .HasForeignKey(x => x.ListingId)
             .OnDelete(DeleteBehavior.Cascade);

            // Người tìm xoá bộ lọc thì lời mời vẫn ở lại hộp thư của họ.
            b.HasOne(x => x.SavedSearch).WithMany()
             .HasForeignKey(x => x.SavedSearchId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(x => x.Seeker).WithMany()
             .HasForeignKey(x => x.SeekerUserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Inquiry).WithMany()
             .HasForeignKey(x => x.InquiryId)
             .OnDelete(DeleteBehavior.SetNull);

            // Chống làm phiền: một tin chỉ mời một nhu cầu MỘT lần. Bị từ chối thì thôi —
            // không có đường mời lại.
            b.HasIndex(x => new { x.ListingId, x.SavedSearchId })
             .IsUnique()
             .HasFilter("\"SavedSearchId\" IS NOT NULL");

            // Hai truy vấn nóng: hộp lời mời của người tìm, và hạn mức lời mời mỗi ngày của chủ tin.
            b.HasIndex(x => new { x.SeekerUserId, x.CreatedAt });
            b.HasIndex(x => new { x.OwnerUserId, x.CreatedAt });
        }
    }
}
