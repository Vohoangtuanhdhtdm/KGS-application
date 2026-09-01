using kgs_api.Dtos;

namespace kgs_api.Interfaces
{
    // ============================================================
    // C2–C4 — BÁO CÁO (chỉ đọc, GROUP BY trên sổ cái)
    // ============================================================
    public interface IReportService
    {
        /// <summary>C2 — Tổng thu nhập cho thuê theo khoảng thời gian tự chọn, group theo tháng.</summary>
        Task<IncomeReportDto> GetIncomeReportAsync(IncomeReportQuery query, CancellationToken ct = default);

        /// <summary>C3 — Lợi nhuận của MỘT tài sản: thu − chi + breakdown theo loại.</summary>
        Task<ProfitReportDto> GetProfitReportAsync(ProfitReportQuery query, CancellationToken ct = default);

        /// <summary>C4 — Tổng thuế phải nộp theo năm, chia theo từng loại thuế.</summary>
        Task<TaxReportDto> GetTaxReportAsync(int year, CancellationToken ct = default);
    }
}
