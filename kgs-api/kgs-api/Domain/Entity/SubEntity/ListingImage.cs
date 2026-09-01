using kgs_api.Common;
using kgs_api.Domain.ValueObjects;

namespace kgs_api.Domain.Entity.SubEntity
{
    public class ListingImage : BaseAuditableEntity
    {
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; } = null!;
        public StoredFile File { get; set; } = new();
        public int SortOrder { get; set; }
    }
}
