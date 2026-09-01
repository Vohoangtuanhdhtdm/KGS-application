using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class AssetMediaConfiguration : IEntityTypeConfiguration<AssetMedia>
    {
        public void Configure(EntityTypeBuilder<AssetMedia> b)
        {
            b.OwnsOne(m => m.File, f =>
                f.HasIndex(x => x.PublicId));            // tra ngược file Cloudinary → bản ghi
            b.HasIndex(m => new { m.AssetId, m.TakenAt });
        }
    }
}
