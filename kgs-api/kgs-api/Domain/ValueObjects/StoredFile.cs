using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace kgs_api.Domain.ValueObjects
{
    [Owned]
    public class StoredFile
    {
        [Required, MaxLength(1000)] public string Url { get; set; } = string.Empty;
        [Required, MaxLength(255)] public string PublicId { get; set; } = string.Empty; // để gọi DeletePhotoAsync
        [MaxLength(255)] public string? FileName { get; set; }
        [MaxLength(100)] public string? ContentType { get; set; }
        public long? SizeBytes { get; set; }
    }
}
