using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
    {
        public void Configure(EntityTypeBuilder<Notification> b)
        {
            b.ToTable("Notifications");

            b.HasOne(x => x.User).WithMany()
             .HasForeignKey(x => x.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            // Hai truy vấn duy nhất: danh sách mới nhất của một người, và đếm chưa đọc.
            b.HasIndex(x => new { x.UserId, x.CreatedAt });
            b.HasIndex(x => new { x.UserId, x.ReadAt });
        }
    }
}
