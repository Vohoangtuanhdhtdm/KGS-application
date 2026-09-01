// Data/Configurations/EquipmentConfiguration.cs
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class EquipmentConfiguration : IEntityTypeConfiguration<Equipment>
    {
        public void Configure(EntityTypeBuilder<Equipment> b)
        {
            b.ToTable("Equipments");
            b.HasOne(e => e.Asset).WithMany(a => a.Equipments)
             .HasForeignKey(e => e.AssetId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(e => e.AssetUnit).WithMany()
             .HasForeignKey(e => e.AssetUnitId).OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(e => e.AssetId);
        }
    }
}