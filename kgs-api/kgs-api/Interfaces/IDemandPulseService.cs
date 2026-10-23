using kgs_api.Dtos;
using static kgs_api.Domain.Enums;

namespace kgs_api.Interfaces
{
    /// <summary>Nhịp cầu — số người đang mở nhu cầu tìm nhà theo khu vực. Xem DemandPulse.</summary>
    public interface IDemandPulseService
    {
        /// <summary>Nhóm đúng (loại tin, tỉnh, quận); null khi chưa đủ người.</summary>
        Task<DemandPulseDto?> GetAsync(ListingType? type, string? city, string? district, CancellationToken ct = default);

        /// <summary>Các quận đang có nhiều người tìm nhất.</summary>
        Task<IReadOnlyList<DemandPulseDto>> GetTopAsync(ListingType? type, int take, CancellationToken ct = default);
    }
}
