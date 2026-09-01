using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class ReminderConfiguration : IEntityTypeConfiguration<Reminder>
    {
        public void Configure(EntityTypeBuilder<Reminder> b)
        {
            b.ToTable("Reminders");

            b.HasOne(r => r.Asset).WithMany()
             .HasForeignKey(r => r.AssetId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(r => r.LeaseContract).WithMany()
             .HasForeignKey(r => r.LeaseContractId).OnDelete(DeleteBehavior.Cascade);

            // Partial index: background job chỉ quét reminder đang bật, sắp đến hạn
            b.HasIndex(r => r.DueDate)
             .HasDatabaseName("IX_Reminders_Active_DueDate")
             .HasFilter("\"IsActive\" = TRUE");
            b.HasIndex(r => new { r.UserId, r.IsActive });
        }
    }
}
