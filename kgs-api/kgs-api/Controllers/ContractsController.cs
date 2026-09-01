using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Common.Common;

namespace kgs_api.Controllers
{
    // ============================================================
    // B2–B5 — HỢP ĐỒNG THUÊ (2 chiều: LeaseIn / LeaseOut)
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/contracts")]
    public sealed class ContractsController : ControllerBase
    {
        private readonly ILeaseContractService _contracts;
        public ContractsController(ILeaseContractService contracts) => _contracts = contracts;

        /// <summary>B2 — Tạo hợp đồng. Áp dụng cho cả 4 kịch bản: cho thuê nguyên căn/tầng-phòng,
        /// đi thuê từ chủ nhà. Tự sinh reminder thu/đóng tiền + hết hạn HĐ khi ActivateImmediately=true.</summary>
        [HttpPost]
        public async Task<ActionResult<LeaseContractDto>> Create(
            [FromBody] LeaseContractCreateRequest request, CancellationToken ct)
        {
            var result = await _contracts.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { contractId = result.Id }, result);
        }

        [HttpGet("{contractId:guid}")]
        public async Task<ActionResult<LeaseContractDto>> GetById(Guid contractId, CancellationToken ct)
            => Ok(await _contracts.GetByIdAsync(contractId, ct));

        [HttpGet]
        public async Task<ActionResult<PagedResult<LeaseContractDto>>> Search(
            [FromQuery] LeaseContractSearchQuery query, CancellationToken ct)
            => Ok(await _contracts.SearchAsync(query, ct));

        /// <summary>B3a — Gia hạn: tạo HĐ mới nối chuỗi ParentContractId, đóng HĐ cũ (Renewed).</summary>
        [HttpPost("{contractId:guid}/renew")]
        public async Task<ActionResult<LeaseContractDto>> Renew(
            Guid contractId, [FromBody] LeaseContractRenewRequest request, CancellationToken ct)
            => Ok(await _contracts.RenewAsync(contractId, request, ct));

        /// <summary>B3b — Chấm dứt trước hạn.</summary>
        [HttpPost("{contractId:guid}/terminate")]
        public async Task<IActionResult> Terminate(
            Guid contractId, [FromBody] LeaseContractTerminateRequest request, CancellationToken ct)
        {
            await _contracts.TerminateAsync(contractId, request, ct);
            return NoContent();
        }

        /// <summary>B4 — Hợp đồng sắp hết hạn, cần tái ký/phụ lục.</summary>
        [HttpGet("expiring")]
        public async Task<ActionResult<IReadOnlyList<ExpiringContractDto>>> GetExpiring(
            [FromQuery] int days = 30, CancellationToken ct = default)
            => Ok(await _contracts.GetExpiringAsync(days, ct));
    }
}
