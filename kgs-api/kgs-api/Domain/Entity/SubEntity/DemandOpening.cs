using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace kgs_api.Domain.Entity.SubEntity
{
    /// <summary>Một lần người tìm mở một nhu cầu cho chủ nhà (đăng mới hoặc bật lại).
    ///
    /// Giới hạn "đăng dày" (DemandScreening.BurstLimit) đếm trên bảng này chứ không đếm nhu cầu
    /// còn tồn tại: xoá rồi đăng lại vẫn bị tính. Không có khoá ngoại tới SavedSearch — xoá nhu cầu
    /// phải giữ lại dòng ghi.</summary>
    [Index(nameof(UserId), nameof(OpenedAt))]
    public class DemandOpening
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        [Required] public string UserId { get; set; } = string.Empty;
        public Guid SavedSearchId { get; set; }
        public DateTime OpenedAt { get; set; }
    }
}
