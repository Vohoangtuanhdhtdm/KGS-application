using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Controllers
{
    // ============================================================
    // B1 — SỔ ĐỐI TÁC
    // ============================================================
    [ApiController]
    [Authorize]
    [Route("api/contacts")]
    public sealed class ContactsController : ControllerBase
    {
        private readonly IContactPartyService _contacts;
        public ContactsController(IContactPartyService contacts) => _contacts = contacts;

        [HttpPost]
        public async Task<ActionResult<ContactPartyDto>> Create(
            [FromBody] ContactPartyRequest request, CancellationToken ct)
        {
            var result = await _contacts.CreateAsync(request, ct);
            return CreatedAtAction(nameof(List), new { }, result);
        }

        [HttpPut("{contactId:guid}")]
        public async Task<ActionResult<ContactPartyDto>> Update(
            Guid contactId, [FromBody] ContactPartyRequest request, CancellationToken ct)
            => Ok(await _contacts.UpdateAsync(contactId, request, ct));

        [HttpDelete("{contactId:guid}")]
        public async Task<IActionResult> Delete(Guid contactId, CancellationToken ct)
        {
            await _contacts.DeleteAsync(contactId, ct);
            return NoContent();
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<ContactPartyDto>>> List(
            [FromQuery] ContactType? type, [FromQuery] string? keyword,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
            => Ok(await _contacts.ListAsync(type, keyword, page, pageSize, ct));
    }
}
