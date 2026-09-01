using kgs_api.Domain.Entity.SubEntity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace kgs_api.Data.Configurations
{
    public class ContactPartyConfiguration : IEntityTypeConfiguration<ContactParty>
    {
        public void Configure(EntityTypeBuilder<ContactParty> b)
        {
            b.HasIndex(c => new { c.UserId, c.Type });
            b.HasOne(c => c.User).WithMany()
             .HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
        }
    }
}
