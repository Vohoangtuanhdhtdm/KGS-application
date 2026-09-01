using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class PropertyImageConfiguration : IEntityTypeConfiguration<PropertyImages>
    {
        public void Configure(EntityTypeBuilder<PropertyImages> b)
        {
            b.ToTable("PropertyImages"); // đổi tên số nhiều cho nhất quán

            b.HasOne(x => x.Property)
             .WithMany(p => p.Images)
             .HasForeignKey(x => x.PropertyId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => x.PropertyId); // KHÔNG unique — 1 property nhiều ảnh
        }
    }
}
