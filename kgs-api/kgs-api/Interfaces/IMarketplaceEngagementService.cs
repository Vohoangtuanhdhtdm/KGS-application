using kgs_api.Dtos;
using static kgs_api.Domain.Enums;

namespace kgs_api.Interfaces
{
    /// <summary>Phía CẦU của marketplace: lưu tin và gửi yêu cầu xem nhà.
    /// Tách khỏi IPropertyListingService (phía cung — đăng tin, kiểm duyệt, tìm kiếm)
    /// để hai chiều của thị trường không dồn vào một service.</summary>
    public interface IMarketplaceEngagementService
    {
        // ---- Tin đã lưu ----
        Task SaveAsync(int propertyId, CancellationToken ct = default);
        Task UnsaveAsync(int propertyId, CancellationToken ct = default);
        Task<IReadOnlyList<SavedListingDto>> GetSavedAsync(CancellationToken ct = default);

        // ---- Yêu cầu xem nhà ----
        Task<SentInquiryDto> CreateInquiryAsync(string slug, CreateInquiryRequest request, CancellationToken ct = default);
        Task<IReadOnlyList<SentInquiryDto>> GetSentInquiriesAsync(CancellationToken ct = default);
        Task<IReadOnlyList<ReceivedInquiryDto>> GetReceivedInquiriesAsync(InquiryStatus? status, CancellationToken ct = default);
        Task<ReceivedInquiryDto> UpdateInquiryStatusAsync(Guid inquiryId, UpdateInquiryStatusRequest request, CancellationToken ct = default);

        /// <summary>Cầu nối: sinh ContactParty từ hồ sơ người gửi yêu cầu.</summary>
        Task<ConvertInquiryResultDto> ConvertInquiryAsync(Guid inquiryId, CancellationToken ct = default);
    }
}
