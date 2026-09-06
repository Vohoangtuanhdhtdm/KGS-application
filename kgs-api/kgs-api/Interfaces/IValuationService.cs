using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    /// <summary>Định giá bất động sản qua dịch vụ ML (nhiem vu 2.5).</summary>
    public interface IValuationService
    {
        /// <summary>Trả về null khi dịch vụ định giá không dùng được — KHÔNG ném lỗi.
        /// Đây là tính năng có thì tốt, không được phép chặn việc đăng tin.</summary>
        Task<ValuationResult?> EstimateAsync(ValuationRequest request, CancellationToken ct = default);

        Task<ValuationModelInfo> GetModelInfoAsync(CancellationToken ct = default);

        /// <summary>Chỉ số giá theo tuần. Có quận thì trả chuỗi riêng của quận nếu dựng
        /// được, không thì lùi về chuỗi toàn quốc.</summary>
        Task<PriceIndexDto> GetPriceIndexAsync(
            string? province, string? district, CancellationToken ct = default);
    }
}
