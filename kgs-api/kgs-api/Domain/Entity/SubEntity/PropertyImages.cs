using kgs_api.Common;
using kgs_api.Domain.ValueObjects;

namespace kgs_api.Domain.Entity.SubEntity
{
    public class PropertyImages : BaseAuditableEntity
    {
        public int PropertyId { get; set; }
        public Property Property { get; set; } = null!;
        public StoredFile File { get; set; } = new();
        public int SortOrder { get; set; }
    }
}
