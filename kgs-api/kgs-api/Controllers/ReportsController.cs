using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace kgs_api.Controllers
{
    // ============================================================
    // C2–C4 — BÁO CÁO
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/reports")]
    public sealed class ReportsController : ControllerBase
    {
        private readonly IReportService _reports;
        public ReportsController(IReportService reports) => _reports = reports;

        /// <summary>C2 — Tổng thu nhập cho thuê theo khoảng thời gian tự chọn, group theo tháng.</summary>
        [HttpGet("income")]
        public async Task<ActionResult<IncomeReportDto>> GetIncome(
            [FromQuery] IncomeReportQuery query, CancellationToken ct)
            => Ok(await _reports.GetIncomeReportAsync(query, ct));

        /// <summary>C3 — Lợi nhuận của một tài sản cụ thể (thu − chi + breakdown theo loại).</summary>
        [HttpGet("profit")]
        public async Task<ActionResult<ProfitReportDto>> GetProfit(
            [FromQuery] ProfitReportQuery query, CancellationToken ct)
            => Ok(await _reports.GetProfitReportAsync(query, ct));

        /// <summary>C5 — Bàn vận hành: dòng tiền hai chiều của tháng, cọc đang giữ, và
        /// tình trạng lấp đầy kèm danh sách phòng trống. Gộp một lượt gọi vì đây là MỘT màn hình.</summary>
        [HttpGet("dashboard")]
        public async Task<ActionResult<OperationsDashboardDto>> GetDashboard(
            [FromQuery] int? year, [FromQuery] int? month, CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;
            return Ok(await _reports.GetOperationsDashboardAsync(year ?? now.Year, month ?? now.Month, ct));
        }

        /// <summary>C4 — Tổng thuế phải nộp theo năm, chia theo từng loại thuế.</summary>
        [HttpGet("tax")]
        public async Task<ActionResult<TaxReportDto>> GetTax(
            [FromQuery] int year, CancellationToken ct)
            => Ok(await _reports.GetTaxReportAsync(year, ct));
    }
}
