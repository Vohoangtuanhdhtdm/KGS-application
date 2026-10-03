using kgs_api.Dtos;
using kgs_api.Services.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Domain.Enums;

namespace kgs_api.Controllers
{
    /// <summary>Quản trị mọi tin đăng (không chỉ hàng đợi duyệt) và người dùng.</summary>
    [ApiController]
    [Authorize(Roles = "Admin")]
    [Route("api/admin")]
    public sealed class AdminManagementController : ControllerBase
    {
        private readonly AdminManagementService _svc;
        private readonly AdminOverviewService _overview;
        public AdminManagementController(AdminManagementService svc, AdminOverviewService overview)
        {
            _svc = svc; _overview = overview;
        }

        /// <summary>Số liệu trang tổng quan, <paramref name="days"/> ngày gần nhất (7–180).</summary>
        [HttpGet("overview")]
        public async Task<ActionResult<AdminOverviewDto>> Overview([FromQuery] int days = 30, CancellationToken ct = default)
            => Ok(await _overview.GetAsync(days, ct));

        // -------------------- Tin đăng --------------------

        /// <summary>Tìm trong MỌI tin. <paramref name="sort"/>: newest (mặc định) | reports | views | price.</summary>
        [HttpGet("all-listings")]
        public async Task<ActionResult<PagedAdminResult<AdminListingRowDto>>> Listings(
            [FromQuery] string? q, [FromQuery] ListingStatus? status, [FromQuery] ListingType? type,
            [FromQuery] AssetDomainType? assetType, [FromQuery] string? city, [FromQuery] string? ownerId,
            [FromQuery] bool reportedOnly = false, [FromQuery] string? sort = null,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
            => Ok(await _svc.SearchListingsAsync(q, status, type, assetType, city, ownerId, reportedOnly, sort, page, pageSize, ct));

        [HttpPost("all-listings/{listingId:guid}/take-down")]
        public async Task<ActionResult<AdminActionResultDto>> TakeDown(
            Guid listingId, [FromBody] AdminTakeDownRequest request, CancellationToken ct)
            => Ok(await _svc.TakeDownAsync(listingId, request, ct));

        [HttpPost("all-listings/{listingId:guid}/restore")]
        public async Task<ActionResult<AdminActionResultDto>> Restore(
            Guid listingId, [FromBody] AdminRestoreRequest request, CancellationToken ct)
            => Ok(await _svc.RestoreAsync(listingId, request, ct));

        // -------------------- Người dùng --------------------

        /// <summary><paramref name="filter"/>: admin | locked | violations. <paramref name="sort"/>: newest | listings | violations.</summary>
        [HttpGet("users")]
        public async Task<ActionResult<PagedAdminResult<AdminUserRowDto>>> Users(
            [FromQuery] string? q, [FromQuery] string? filter, [FromQuery] string? sort,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
            => Ok(await _svc.SearchUsersAsync(q, filter, sort, page, pageSize, ct));

        [HttpGet("users/{userId}")]
        public async Task<ActionResult<AdminUserDetailDto>> GetUser(string userId, CancellationToken ct)
            => Ok(await _svc.GetUserAsync(userId, ct));

        [HttpPost("users/{userId}/lock")]
        public async Task<ActionResult<AdminActionResultDto>> Lock(
            string userId, [FromBody] AdminLockUserRequest request, CancellationToken ct)
            => Ok(await _svc.LockAsync(userId, request, ct));

        [HttpPost("users/{userId}/unlock")]
        public async Task<ActionResult<AdminActionResultDto>> Unlock(
            string userId, [FromBody] AdminUnlockUserRequest request, CancellationToken ct)
            => Ok(await _svc.UnlockAsync(userId, request, ct));

        [HttpPut("users/{userId}/admin-role")]
        public async Task<ActionResult<AdminActionResultDto>> SetAdmin(
            string userId, [FromBody] AdminSetRoleRequest request, CancellationToken ct)
            => Ok(await _svc.SetAdminAsync(userId, request.Admin, ct));
    }
}
