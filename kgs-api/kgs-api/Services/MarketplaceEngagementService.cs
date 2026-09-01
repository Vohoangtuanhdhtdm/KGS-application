using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    public sealed class MarketplaceEngagementService : IMarketplaceEngagementService
    {
        private readonly IRepository<Listing> _listings;
        private readonly IRepository<SavedListing> _saved;
        private readonly IRepository<ListingInquiry> _inquiries;
        private readonly IRepository<ContactParty> _contacts;
        private readonly IRepository<ApplicationUser> _users;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;

        public MarketplaceEngagementService(
            IRepository<Listing> listings,
            IRepository<SavedListing> saved,
            IRepository<ListingInquiry> inquiries,
            IRepository<ContactParty> contacts,
            IRepository<ApplicationUser> users,
            IUnitOfWork uow,
            ICurrentUserService currentUser)
        {
            _listings = listings; _saved = saved; _inquiries = inquiries;
            _contacts = contacts; _users = users; _uow = uow; _currentUser = currentUser;
        }

        // ==================== E1. TIN ĐÃ LƯU ====================

        public async Task SaveAsync(Guid listingId, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            // Chỉ lưu được tin đã duyệt — tin Pending/Rejected không tồn tại với người xem.
            var exists = await _listings.Query()
                .AnyAsync(l => l.Id == listingId && l.Status == ListingStatus.Approved, ct);
            if (!exists) throw new NotFoundException("Không tìm thấy tin đăng.");

            // Idempotent: lưu lại tin đã lưu là no-op, không phải lỗi.
            var already = await _saved.Query()
                .AnyAsync(s => s.UserId == userId && s.ListingId == listingId, ct);
            if (already) return;

            await _saved.AddAsync(new SavedListing
            {
                UserId = userId,
                ListingId = listingId,
                SavedAt = DateTime.UtcNow
            }, ct);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task UnsaveAsync(Guid listingId, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;
            var row = await _saved.Query()
                .FirstOrDefaultAsync(s => s.UserId == userId && s.ListingId == listingId, ct);
            if (row is null) return;   // idempotent

            _saved.Remove(row);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task<IReadOnlyList<SavedListingDto>> GetSavedAsync(CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            return await _saved.Query().AsNoTracking()
                .Where(s => s.UserId == userId && s.Listing.Status == ListingStatus.Approved)
                .OrderByDescending(s => s.SavedAt)
                .Select(s => new SavedListingDto(
                    s.ListingId, s.Listing.Slug!, s.Listing.Title, s.Listing.Type,
                    s.Listing.Price, s.Listing.RentPaymentCycle,
                    // Địa chỉ và đặc điểm đọc xuyên qua Listing.Asset — không còn cột trùng lặp
                    s.Listing.Asset.Address.City, s.Listing.Asset.Address.District,
                    s.Listing.Asset.Bedrooms,
                    s.Listing.AssetUnit != null ? s.Listing.AssetUnit.Area : s.Listing.Asset.Area,
                    s.Listing.Images.OrderBy(i => i.SortOrder).Select(i => i.File.Url).FirstOrDefault(),
                    s.SavedAt))
                .ToListAsync(ct);
        }

        // ==================== E2. YÊU CẦU XEM NHÀ ====================

        public async Task<SentInquiryDto> CreateInquiryAsync(string slug, CreateInquiryRequest request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            var listing = await _listings.Query().AsNoTracking()
                .Where(l => l.Slug == slug && l.Status == ListingStatus.Approved)
                .Select(l => new { l.Id, OwnerId = l.Asset.UserId, l.Title })
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            if (listing.OwnerId == userId)
                throw new ValidationFailedException("Đây là tin đăng của bạn — không thể tự gửi yêu cầu cho chính mình.");

            // Chống spam: một yêu cầu đang mở trên mỗi tin. Yêu cầu đã Đóng hoặc đã
            // Chuyển thành khách thuê thì được gửi lại (khách quay lại hỏi lần nữa).
            var hasOpen = await _inquiries.Query().AnyAsync(i =>
                i.ListingId == listing.Id
                && i.FromUserId == userId
                && (i.Status == InquiryStatus.New
                    || i.Status == InquiryStatus.Contacted
                    || i.Status == InquiryStatus.Viewed), ct);
            if (hasOpen)
                throw new ConflictException("Bạn đã gửi một yêu cầu cho tin đăng này và chủ nhà chưa xử lý xong.");

            var inquiry = new ListingInquiry
            {
                ListingId = listing.Id,
                FromUserId = userId,
                ToUserId = listing.OwnerId,
                Message = request.Message?.Trim(),
                PreferredViewingAt = request.PreferredViewingAt is null
                    ? null
                    : DateTime.SpecifyKind(request.PreferredViewingAt.Value, DateTimeKind.Utc),
                Status = InquiryStatus.New
            };

            await _inquiries.AddAsync(inquiry, ct);
            await _uow.SaveChangesAsync(ct);

            return await ProjectSent(_inquiries.Query().AsNoTracking().Where(i => i.Id == inquiry.Id))
                .FirstAsync(ct);
        }

        public async Task<IReadOnlyList<SentInquiryDto>> GetSentInquiriesAsync(CancellationToken ct = default)
            => await ProjectSent(_inquiries.Query().AsNoTracking()
                    .Where(i => i.FromUserId == _currentUser.UserId)
                    .OrderByDescending(i => i.CreatedAt))
                .ToListAsync(ct);

        public async Task<IReadOnlyList<ReceivedInquiryDto>> GetReceivedInquiriesAsync(InquiryStatus? status, CancellationToken ct = default)
        {
            var q = _inquiries.Query().AsNoTracking()
                .Where(i => i.ToUserId == _currentUser.UserId);

            if (status is not null) q = q.Where(i => i.Status == status);

            return await ProjectReceived(q.OrderByDescending(i => i.CreatedAt)).ToListAsync(ct);
        }

        public async Task<ReceivedInquiryDto> UpdateInquiryStatusAsync(Guid inquiryId, UpdateInquiryStatusRequest request, CancellationToken ct = default)
        {
            var inquiry = await GetReceivedInquiryAsync(inquiryId, ct);

            // Converted chỉ được đặt bởi luồng ConvertInquiryAsync — nó phải sinh ContactParty
            // cùng lúc, nếu cho đặt tay thì trạng thái sẽ nói dối về việc đã kết nối xong.
            if (request.Status == InquiryStatus.Converted)
                throw new ValidationFailedException(
                    "Dùng chức năng Chuyển thành khách thuê để chuyển sang trạng thái này.");

            inquiry.Status = request.Status;
            await _uow.SaveChangesAsync(ct);

            return await ProjectReceived(_inquiries.Query().AsNoTracking().Where(i => i.Id == inquiryId))
                .FirstAsync(ct);
        }

        // ==================== CẦU NỐI: YÊU CẦU → ĐỐI TÁC → HỢP ĐỒNG ====================

        public async Task<ConvertInquiryResultDto> ConvertInquiryAsync(Guid inquiryId, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;
            var inquiry = await GetReceivedInquiryAsync(inquiryId, ct);

            if (inquiry.ConvertedContactPartyId is not null)
                throw new ConflictException("Yêu cầu này đã được chuyển thành khách thuê rồi.");

            var sender = await _users.Query().AsNoTracking()
                .Where(u => u.Id == inquiry.FromUserId)
                .Select(u => new { u.Name, u.PhoneNumber, u.Email })
                .FirstOrDefaultAsync(ct)
                ?? throw new NotFoundException("Không tìm thấy người gửi yêu cầu.");

            // Nếu chủ nhà đã có sẵn đối tác trùng số điện thoại thì dùng lại, tránh
            // sinh bản ghi trùng mỗi lần cùng một người hỏi thuê nhiều tin khác nhau.
            ContactParty? contact = null;
            if (!string.IsNullOrWhiteSpace(sender.PhoneNumber))
            {
                contact = await _contacts.Query()
                    .FirstOrDefaultAsync(c => c.UserId == userId && c.Phone == sender.PhoneNumber, ct);
            }

            if (contact is null)
            {
                contact = new ContactParty
                {
                    UserId = userId,
                    Type = ContactType.Tenant,
                    FullName = string.IsNullOrWhiteSpace(sender.Name) ? "Khách thuê" : sender.Name,
                    Phone = sender.PhoneNumber,
                    Email = sender.Email,
                    Notes = $"Tạo tự động từ yêu cầu xem nhà ngày {DateTime.UtcNow:dd/MM/yyyy}."
                };
                await _contacts.AddAsync(contact, ct);
            }

            // Gán qua navigation chứ không qua khoá ngoại: ContactParty mới chưa có Id
            // trong CSDL cho tới khi SaveChanges chạy, EF tự nối khoá sau khi insert.
            inquiry.ConvertedContactParty = contact;
            inquiry.Status = InquiryStatus.Converted;

            // Một SaveChanges: đối tác + trạng thái yêu cầu nằm trong cùng transaction.
            await _uow.SaveChangesAsync(ct);

            return new ConvertInquiryResultDto(inquiry.Id, contact.Id, contact.FullName);
        }

        // ==================== Helpers ====================

        private async Task<ListingInquiry> GetReceivedInquiryAsync(Guid inquiryId, CancellationToken ct)
            => await _inquiries.Query()
                   .FirstOrDefaultAsync(i => i.Id == inquiryId && i.ToUserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy yêu cầu.");

        private static IQueryable<SentInquiryDto> ProjectSent(IQueryable<ListingInquiry> q) =>
            q.Select(i => new SentInquiryDto(
                i.Id, i.ListingId, i.Listing.Slug!, i.Listing.Title,
                i.Listing.Images.OrderBy(x => x.SortOrder).Select(x => x.File.Url).FirstOrDefault(),
                i.Message, i.PreferredViewingAt, i.Status, i.CreatedAt));

        private static IQueryable<ReceivedInquiryDto> ProjectReceived(IQueryable<ListingInquiry> q) =>
            q.Select(i => new ReceivedInquiryDto(
                i.Id, i.ListingId, i.Listing.Slug!, i.Listing.Title,
                i.FromUser.Name, i.FromUser.PhoneNumber, i.FromUser.Email,
                i.Message, i.PreferredViewingAt, i.Status, i.ConvertedContactPartyId, i.CreatedAt));
    }
}
