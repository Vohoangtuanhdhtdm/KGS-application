using kgs_api.Dtos;
using static kgs_api.Common.Common;

namespace kgs_api.Interfaces
{
    /// <summary>Phía CUNG của marketplace: đăng tin, sửa, gỡ, tìm kiếm công khai.
    /// Phía CẦU (lưu tin, yêu cầu xem nhà) nằm ở IMarketplaceEngagementService.</summary>
    public interface IListingService
    {
        Task<OwnerListingDto> CreateAsync(Guid assetId, CreateListingRequest request, CancellationToken ct = default);
        Task<OwnerListingDto> UpdateAsync(Guid listingId, UpdateListingRequest request, CancellationToken ct = default);

        // ==================== Luồng đăng tin trực tiếp (Giai đoạn 1) ====================

        /// <summary>Tạo tin ở trạng thái Draft, đồng thời tạo Asset ngầm từ dữ liệu địa chỉ.
        /// Người đăng không cần biết tới khái niệm tài sản.</summary>
        Task<OwnerListingDto> CreateDirectAsync(CreateListingDirectRequest request, CancellationToken ct = default);

        /// <summary>Thêm ảnh vào tin. Tách khỏi bước tạo để form hiển thị được tiến trình
        /// tải từng ảnh, và để bản nháp không bị chặn bởi một lần upload nặng.</summary>
        Task<IReadOnlyList<ListingImageDto>> AddImagesAsync(Guid listingId, IFormFileCollection files, CancellationToken ct = default);

        Task<IReadOnlyList<ListingImageDto>> GetImagesAsync(Guid listingId, CancellationToken ct = default);
        Task RemoveImageAsync(Guid listingId, Guid imageId, CancellationToken ct = default);

        /// <summary>Gửi bản nháp đi duyệt. Đây là nơi kiểm tra các điều kiện tối thiểu —
        /// bản nháp cố tình cho phép thiếu, chỉ khi gửi mới bắt buộc đủ.
        /// Cũng dùng để GỬI LẠI một tin đã bị từ chối sau khi sửa.</summary>
        Task<OwnerListingDto> SubmitAsync(Guid listingId, CancellationToken ct = default);

        // ==================== Vòng đời tin đăng (nhiệm vụ 1.4) ====================

        /// <summary>Toàn bộ dữ liệu cần để nạp lại vào biểu mẫu đăng tin — dùng cho cả
        /// việc soạn tiếp bản nháp lẫn sửa tin đã đăng.</summary>
        Task<EditListingDto> GetForEditAsync(Guid listingId, CancellationToken ct = default);

        /// <summary>Đẩy tin lên đầu danh sách. Có giới hạn tần suất để tránh spam.</summary>
        Task<OwnerListingDto> BumpAsync(Guid listingId, CancellationToken ct = default);

        /// <summary>Mở lại tin đã đóng: đưa về bản nháp để sửa rồi gửi duyệt lại.</summary>
        Task<OwnerListingDto> ReopenAsync(Guid listingId, CancellationToken ct = default);

        /// <summary>Xoá hẳn — CHỈ với bản nháp. Tin đã từng công khai thì đóng chứ không xoá,
        /// để giữ lịch sử và số liệu.</summary>
        Task DeleteDraftAsync(Guid listingId, CancellationToken ct = default);

        /// <summary>Đóng tin (đã có khách / đã bán). Không xoá — giữ lịch sử và lượt xem.</summary>
        Task CloseAsync(Guid listingId, CancellationToken ct = default);

        Task<IReadOnlyList<OwnerListingDto>> GetMyListingsAsync(CancellationToken ct = default);
        Task<IReadOnlyList<OwnerListingDto>> GetByAssetAsync(Guid assetId, CancellationToken ct = default);

        Task<PagedResult<PublicListingSummaryDto>> SearchPublicAsync(PublicListingSearchQuery query, CancellationToken ct = default);
        Task<PublicListingDetailDto> GetPublicBySlugAsync(string slug, CancellationToken ct = default);

        /// <summary>Hai dải gợi ý dưới trang chi tiết: tin tương tự và tin khác của cùng
        /// người đăng. Gộp một lần gọi vì cả hai đều suy ra từ chính tin đang xem.</summary>
        Task<RelatedListingsDto> GetRelatedAsync(string slug, CancellationToken ct = default);
    }
}
