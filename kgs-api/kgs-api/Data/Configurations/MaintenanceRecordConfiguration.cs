// Data/Configurations/MaintenanceRecordConfiguration.cs
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class MaintenanceRecordConfiguration : IEntityTypeConfiguration<MaintenanceRecord>
    {
        public void Configure(EntityTypeBuilder<MaintenanceRecord> b)
        {
            b.ToTable("MaintenanceRecords");
            b.HasOne(m => m.Asset).WithMany(a => a.MaintenanceRecords)
             .HasForeignKey(m => m.AssetId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(m => m.AssetUnit).WithMany()
             .HasForeignKey(m => m.AssetUnitId).OnDelete(DeleteBehavior.SetNull);
            b.HasOne(m => m.Vendor).WithMany()
             .HasForeignKey(m => m.VendorId).OnDelete(DeleteBehavior.Restrict);
            b.HasIndex(m => m.AssetId);
        }
    }
}