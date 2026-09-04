using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    /// <summary>Bộ lọc đã lưu của người đi tìm thuê (nhiệm vụ 1.6b).</summary>
    public interface ISavedSearchService
    {
        /// <summary>Danh sách bộ lọc đã lưu, kèm số tin mới khớp từng bộ.</summary>
        Task<IReadOnlyList<SavedSearchDto>> GetMineAsync(CancellationToken ct = default);

        Task<SavedSearchDto> CreateAsync(CreateSavedSearchRequest request, CancellationToken ct = default);

        /// <summary>Bật/tắt báo tin mới cho một bộ lọc.</summary>
        Task<SavedSearchDto> SetNotifyAsync(Guid id, bool enabled, CancellationToken ct = default);

        /// <summary>Đánh dấu đã xem — đưa mốc "tin mới" về hiện tại, huy hiệu về 0.</summary>
        Task MarkSeenAsync(Guid id, CancellationToken ct = default);

        Task DeleteAsync(Guid id, CancellationToken ct = default);
    }
}
