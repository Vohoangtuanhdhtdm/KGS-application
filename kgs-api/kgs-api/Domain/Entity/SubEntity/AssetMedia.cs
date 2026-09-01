using kgs_api.Common;
using kgs_api.Domain.ValueObjects;
using System.ComponentModel.DataAnnotations;

namespace kgs_api.Domain.Entity.SubEntity
{
    public class AssetMedia : BaseAuditableEntity
    {
        public Guid AssetId { get; set; }
        public Asset Asset { get; set; } = null!;

        public StoredFile File { get; set; } = new();   // Url + PublicId
        [MaxLength(500)] public string? Caption { get; set; }
        public DateTime TakenAt { get; set; }            // "hình ảnh theo thời gian"
        public int SortOrder { get; set; }
    }
}
