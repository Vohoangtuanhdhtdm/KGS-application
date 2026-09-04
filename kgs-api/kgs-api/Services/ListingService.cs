using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using kgs_api.Storage;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using System.Text;
using System.Text.RegularExpressions;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    /// <summary>Quản lý tin đăng công khai.
    ///
    /// Sau khi gộp Property vào Asset, service này KHÔNG còn sao chép thuộc tính vật lý
    /// sang tin đăng. Mọi truy vấn đọc qua navigation Listing.Asset, nên sửa địa chỉ hay
    /// diện tích ở màn hình tài sản là tin đăng đổi theo ngay — trước đây hai bên lệch
    /// nhau âm thầm kể từ lúc đăng.</summary>
    public sealed class ListingService : IListingService
    {
        /// <summary>Trần số ảnh mỗi tin. Batdongsan và Chợ Tốt đều giới hạn quanh mức này;
        /// không giới hạn thì một tin có thể ngốn hết hạn mức lưu trữ.</summary>
        private const int MaxImagesPerListing = 20;

        /// <summary>Khoảng chờ giữa hai lần đẩy tin. Không có nó thì "đẩy tin" biến thành
        /// nút bấm liên tục và thứ tự marketplace chỉ còn phản ánh ai rảnh tay nhất.</summary>
        private static readonly TimeSpan BumpCooldown = TimeSpan.FromHours(24);

        private readonly IRepository<Asset> _assets;
        private readonly IRepository<AssetUnit> _units;
        private readonly IRepository<Listing> _listings;
        private readonly IRepository<ListingImage> _images;
        private readonly IRepository<AssetMedia> _media;
        private readonly IFileStorageService _files;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory;

        public ListingService(
            IRepository<Asset> assets,
            IRepository<AssetUnit> units,
            IRepository<Listing> listings,
            IRepository<ListingImage> images,
            IRepository<AssetMedia> media,
            IFileStorageService files,
            IUnitOfWork uow,
            ICurrentUserService currentUser,
            GeometryFactory geometryFactory)
        {
            _assets = assets; _units = units; _listings = listings; _images = images;
            _media = media; _files = files;
            _uow = uow; _currentUser = currentUser; _geometryFactory = geometryFactory;
        }

        // ==================== ĐĂNG TIN ====================

        public async Task<OwnerListingDto> CreateAsync(Guid assetId, CreateListingRequest request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            var asset = await _assets.Query().AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == assetId && a.UserId == userId, ct)
                ?? throw new NotFoundException("Không tìm thấy tài sản.");

            if (request.Type == ListingType.Rent && request.RentPaymentCycle is null)
                throw new ValidationFailedException("Tin cho thuê bắt buộc phải chọn chu kỳ thanh toán.");

            // Đăng tin theo phòng: phòng phải thuộc đúng tài sản này.
            if (request.AssetUnitId is not null)
            {
                var unitExists = await _units.Query()
                    .AnyAsync(u => u.Id == request.AssetUnitId && u.AssetId == assetId, ct);
                if (!unitExists)
                    throw new NotFoundException("Không tìm thấy tầng/phòng thuộc tài sản này.");
            }

            // Một chỗ chỉ có một tin đang sống. Kiểm ở đây để trả lỗi nghiệp vụ rõ ràng
            // thay vì để partial unique index UX_Listings_OneLivePerSlot ném lỗi DB.
            var hasLive = await _listings.Query().AnyAsync(l =>
                l.AssetId == assetId
                && l.AssetUnitId == request.AssetUnitId
                && (l.Status == ListingStatus.Pending || l.Status == ListingStatus.Approved), ct);
            if (hasLive)
                throw new ConflictException(request.AssetUnitId is null
                    ? "Tài sản này đã có tin đăng đang hiển thị — hãy sửa tin hiện có thay vì tạo mới."
                    : "Phòng này đã có tin đăng đang hiển thị — hãy sửa tin hiện có thay vì tạo mới.");

            var selectedMedia = await _media.Query().AsNoTracking()
                .Where(m => m.AssetId == assetId && request.SelectedAssetMediaIds.Contains(m.Id))
                .ToListAsync(ct);

            if (selectedMedia.Count == 0)
                throw new ValidationFailedException("Cần chọn ít nhất 1 ảnh để đăng tin công khai.");

            var listing = new Listing
            {
                AssetId = assetId,
                AssetUnitId = request.AssetUnitId,
                Title = request.Title.Trim(),
                Description = request.Description,
                Price = request.Price,
                Type = request.Type,
                RentPaymentCycle = request.Type == ListingType.Rent ? request.RentPaymentCycle : null,
                Status = ListingStatus.Pending,
                Slug = await GenerateUniqueSlugAsync(request.Title, ct),
                ViewCount = 0,
                Terms = MapTerms(request.Terms),
                Amenities = NormalizeAmenities(request.Amenities),
                Images = selectedMedia.Select((m, i) => new ListingImage
                {
                    File = new StoredFile
                    {
                        Url = m.File.Url,
                        PublicId = m.File.PublicId,
                        FileName = m.File.FileName,
                        ContentType = m.File.ContentType,
                        SizeBytes = m.File.SizeBytes
                    },
                    SortOrder = i
                }).ToList()
            };

            await _listings.AddAsync(listing, ct);

            // MỘT SaveChanges duy nhất. Trước đây phải gọi hai lần vì Property có khoá int
            // identity và Asset.LinkedPropertyId cần Id thật; nay quan hệ đã đảo chiều nên
            // không còn ràng buộc đó — cũng không còn cửa sổ tạo ra tin đăng mồ côi.
            await _uow.SaveChangesAsync(ct);

            return await GetOwnedDtoAsync(listing.Id, ct);
        }

        public async Task<OwnerListingDto> UpdateAsync(Guid listingId, UpdateListingRequest request, CancellationToken ct = default)
        {
            var listing = await GetOwnedListingAsync(listingId, ct);

            if (listing.Status == ListingStatus.Closed)
                throw new ConflictException("Tin đã đóng — không sửa được. Hãy đăng tin mới.");

            if (listing.Type == ListingType.Rent && request.RentPaymentCycle is null)
                throw new ValidationFailedException("Tin cho thuê bắt buộc phải chọn chu kỳ thanh toán.");

            listing.Title = request.Title.Trim();
            listing.Description = request.Description;
            listing.Price = request.Price;
            listing.RentPaymentCycle = listing.Type == ListingType.Rent ? request.RentPaymentCycle : null;
            listing.Terms = MapTerms(request.Terms);
            listing.Amenities = NormalizeAmenities(request.Amenities);

            await ApplyPropertyFieldsAsync(listing, request, ct);

            // Sửa nội dung thì phải duyệt lại — nếu không, người đăng có thể được duyệt một
            // nội dung sạch rồi thay bằng nội dung khác.
            if (listing.Status == ListingStatus.Approved)
            {
                listing.Status = ListingStatus.Pending;
                listing.ModerationNote = "Tin đã được sửa sau khi duyệt — cần duyệt lại.";
            }

            await _uow.SaveChangesAsync(ct);
            return await GetOwnedDtoAsync(listingId, ct);
        }

        public async Task CloseAsync(Guid listingId, CancellationToken ct = default)
        {
            var listing = await GetOwnedListingAsync(listingId, ct);

            if (listing.Status == ListingStatus.Closed)
                return;   // idempotent

            listing.Status = ListingStatus.Closed;
            await _uow.SaveChangesAsync(ct);
        }

        // ==================== ĐỌC — CHỦ TIN ====================

        public async Task<IReadOnlyList<OwnerListingDto>> GetMyListingsAsync(CancellationToken ct = default)
            => await ProjectOwner(_listings.Query().AsNoTracking()
                    .Where(l => l.Asset.UserId == _currentUser.UserId)
                    .OrderByDescending(l => l.CreatedAt))
                .ToListAsync(ct);

        public async Task<IReadOnlyList<OwnerListingDto>> GetByAssetAsync(Guid assetId, CancellationToken ct = default)
            => await ProjectOwner(_listings.Query().AsNoTracking()
                    .Where(l => l.AssetId == assetId && l.Asset.UserId == _currentUser.UserId)
                    .OrderByDescending(l => l.CreatedAt))
                .ToListAsync(ct);

        // ==================== ĐỌC — CÔNG KHAI ====================

        public async Task<PagedResult<PublicListingSummaryDto>> SearchPublicAsync(PublicListingSearchQuery query, CancellationToken ct = default)
        {
            var q = _listings.Query().AsNoTracking()
                .Where(l => l.Status == ListingStatus.Approved);

            if (query.Type is not null) q = q.Where(l => l.Type == query.Type);
            if (!string.IsNullOrWhiteSpace(query.City)) q = q.Where(l => l.Asset.Address.City == query.City);
            if (!string.IsNullOrWhiteSpace(query.District)) q = q.Where(l => l.Asset.Address.District == query.District);
            if (query.PriceMin is not null) q = q.Where(l => l.Price >= query.PriceMin);
            if (query.PriceMax is not null) q = q.Where(l => l.Price <= query.PriceMax);
            if (query.BedroomsMin is not null) q = q.Where(l => l.Asset.Bedrooms >= query.BedroomsMin);

            // ---- Bộ lọc điều kiện thuê (cũng là hard filter của AI Agent) ----
            // So sánh trên TỔNG chi phí cố định chứ không phải giá thuê trần trụi: một phòng
            // 7 triệu kèm 500k phí dịch vụ đắt hơn phòng 7,2 triệu đã bao trọn gói.
            if (query.TotalCostMax is not null)
                q = q.Where(l => l.Price
                               + (l.Terms.ServiceFee ?? 0)
                               + (l.Terms.ParkingFee ?? 0)
                               + (l.Terms.InternetFee ?? 0) <= query.TotalCostMax);

            // Chỉ khớp khi chủ tin đã KHAI tường minh — tin bỏ trống không được coi là "có".
            if (query.PetsAllowed is not null) q = q.Where(l => l.Terms.PetsAllowed == query.PetsAllowed);
            if (query.CurfewFree is not null) q = q.Where(l => l.Terms.CurfewFree == query.CurfewFree);
            if (query.SharedWithOwner is not null) q = q.Where(l => l.Terms.SharedWithOwner == query.SharedWithOwner);

            if (query.AvailableBy is not null)
            {
                var by = DateTime.SpecifyKind(query.AvailableBy.Value, DateTimeKind.Utc);
                q = q.Where(l => l.Terms.AvailableFrom == null || l.Terms.AvailableFrom <= by);
            }

            // Phải có ĐỦ mọi tiện nghi yêu cầu. Npgsql dịch sang toán tử @> của PostgreSQL,
            // chạy trên GIN index thay vì quét bảng.
            var wantedAmenities = NormalizeAmenities(query.Amenities);
            if (wantedAmenities.Count > 0)
                q = q.Where(l => wantedAmenities.All(a => l.Amenities.Contains(a)));

            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var kw = $"%{query.Keyword.Trim()}%";
                q = q.Where(l => EF.Functions.ILike(l.Title, kw)
                              || EF.Functions.ILike(l.Description, kw)
                              || EF.Functions.ILike(l.Asset.Address.Detail, kw));
            }

            // Toạ độ nay đọc từ Asset.Location — GiST index đã có sẵn trên bảng Assets.
            Point? origin = null;
            var hasGeoSearch = query.Latitude is not null && query.Longitude is not null && query.RadiusMeters is not null;
            if (hasGeoSearch)
            {
                origin = _geometryFactory.CreatePoint(new Coordinate(query.Longitude!.Value, query.Latitude!.Value));
                q = q.Where(l => l.Asset.Location != null
                              && EF.Functions.IsWithinDistance(l.Asset.Location, origin, query.RadiusMeters!.Value, true));
            }

            var total = await q.CountAsync(ct);
            var pageSize = Math.Clamp(query.PageSize, 1, 50);
            var page = Math.Max(query.Page, 1);

            // Mặc định: có toạ độ thì gần nhất trước, không thì mới nhất trước.
            // "Nearest" mà không có toạ độ sẽ tự lùi về "Newest" — trả về thứ tự ngẫu nhiên
            // trong trường hợp đó còn tệ hơn là bỏ qua lựa chọn của người dùng.
            var sort = query.SortBy ?? (hasGeoSearch ? ListingSort.Nearest : ListingSort.Newest);
            if (sort == ListingSort.Nearest && !hasGeoSearch) sort = ListingSort.Newest;

            var ordered = sort switch
            {
                ListingSort.Nearest => q.OrderBy(l => l.Asset.Location!.Distance(origin)),
                ListingSort.PriceAsc => q.OrderBy(l => l.Price),
                ListingSort.PriceDesc => q.OrderByDescending(l => l.Price),
                ListingSort.AreaDesc => q
                    .OrderByDescending(l => l.AssetUnit != null ? l.AssetUnit.Area : l.Asset.Area),
                // Mới nhất = theo mốc đẩy tin trước, rồi mới tới ngày duyệt — cùng thứ tự
                // ưu tiên mà nút "đẩy tin" dựa vào.
                _ => q.OrderByDescending(l => l.BumpedAt ?? l.PublishedAt ?? l.CreatedAt)
            };

            // Chốt thứ tự bằng Id: hai tin cùng giá hoặc cùng diện tích mà không có khoá phụ
            // thì PostgreSQL được phép trả về thứ tự khác nhau giữa các lần gọi, và phân
            // trang sẽ lặp hoặc bỏ sót bản ghi.
            ordered = ordered.ThenBy(l => l.Id);

            // Giữ nguyên Point trong projection, tách Y/X sau khi materialize —
            // ST_Y(geography) không tồn tại nên không tách được trong biểu thức SQL.
            var rows = await ordered
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(l => new
                {
                    l.Id,
                    l.Slug,
                    l.Title,
                    l.Type,
                    l.Price,
                    l.RentPaymentCycle,
                    l.Asset.Address.City,
                    l.Asset.Address.District,
                    l.Asset.Bedrooms,
                    l.Asset.Bathrooms,
                    Area = l.AssetUnit != null ? l.AssetUnit.Area : l.Asset.Area,
                    UnitName = l.AssetUnit != null ? l.AssetUnit.Name : null,
                    ThumbnailUrl = l.Images.OrderBy(i => i.SortOrder).Select(i => i.File.Url).FirstOrDefault(),
                    l.Asset.Location,
                    DistanceMeters = hasGeoSearch ? (double?)l.Asset.Location!.Distance(origin!) : null,
                    l.PublishedAt,
                    TotalMonthlyCost = l.Price
                        + (l.Terms.ServiceFee ?? 0)
                        + (l.Terms.ParkingFee ?? 0)
                        + (l.Terms.InternetFee ?? 0),
                    l.Terms.DepositMonths,
                    l.Terms.PetsAllowed,
                    l.Amenities
                })
                .ToListAsync(ct);

            var items = rows.Select(r => new PublicListingSummaryDto(
                r.Id, r.Slug!, r.Title, r.Type, r.Price, r.RentPaymentCycle,
                r.City, r.District, r.Bedrooms, r.Bathrooms, r.Area, r.ThumbnailUrl,
                r.Location?.Y, r.Location?.X, r.DistanceMeters, r.UnitName, r.PublishedAt,
                r.TotalMonthlyCost, r.DepositMonths, r.PetsAllowed, r.Amenities)).ToList();

            return new PagedResult<PublicListingSummaryDto>(items, page, pageSize, total);
        }

        public async Task<PublicListingDetailDto> GetPublicBySlugAsync(string slug, CancellationToken ct = default)
        {
            var listing = await _listings.Query()
                .Include(l => l.Images)
                .Include(l => l.Asset)
                .Include(l => l.AssetUnit)
                .FirstOrDefaultAsync(l => l.Slug == slug && l.Status == ListingStatus.Approved, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            // Tăng lượt xem bằng UPDATE trực tiếp thay vì tải-sửa-lưu: một GET công khai
            // không nên kéo theo change tracking và một transaction đầy đủ. Vẫn chưa chống
            // trùng theo IP — xem docs, việc đó thuộc giai đoạn sau.
            await _listings.Query()
                .Where(l => l.Id == listing.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.ViewCount, l => l.ViewCount + 1), ct);

            var owner = await _assets.Query().AsNoTracking()
                .Where(a => a.Id == listing.AssetId)
                .Select(a => new { a.User.Name, a.User.PhoneNumber })
                .FirstAsync(ct);

            var asset = listing.Asset;

            return new PublicListingDetailDto(
                listing.Id, listing.Slug!, listing.Title, listing.Description, listing.Type,
                listing.Price, listing.RentPaymentCycle,
                asset.Address.City, asset.Address.District, asset.Address.Ward, asset.Address.Detail,
                listing.AssetUnit?.Area ?? asset.Area, asset.Frontage,
                asset.Floors, asset.Bedrooms, asset.Bathrooms,
                asset.HouseDirection, asset.LegalStatus, asset.FurnitureState,
                asset.TypeProperty, AssetTypeLabel(asset.TypeProperty), listing.AssetUnit?.Name,
                asset.Location?.Y, asset.Location?.X,   // Y=lat, X=lng — dễ đảo nhầm
                listing.Images.OrderBy(i => i.SortOrder).Select(i => i.File.Url).ToList(),
                listing.ViewCount + 1, listing.PublishedAt,
                ToTermsDto(listing.Terms), listing.Amenities, TotalMonthlyCost(listing),
                owner.Name, owner.PhoneNumber ?? "Chưa cập nhật số điện thoại");
        }

        // ==================== ĐĂNG TIN TRỰC TIẾP (Giai đoạn 1) ====================

        public async Task<OwnerListingDto> CreateDirectAsync(
            CreateListingDirectRequest request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            if (request.Type == ListingType.Rent && request.RentPaymentCycle is null)
                throw new ValidationFailedException("Tin cho thuê bắt buộc phải chọn chu kỳ thanh toán.");

            var address = new Address
            {
                City = request.City.Trim(),
                District = request.District.Trim(),
                Ward = request.Ward.Trim(),
                Detail = request.AddressDetail?.Trim() ?? string.Empty
            };

            // Dùng lại tài sản nếu người dùng đã có một cái ở ĐÚNG địa chỉ này. Không có
            // bước này thì đăng tin lần hai cho cùng căn nhà sẽ đẻ ra tài sản trùng, và
            // Giai đoạn 4 sẽ thừa hưởng một danh mục đầy bản sao.
            var asset = await _assets.Query()
                .FirstOrDefaultAsync(a => a.UserId == userId
                                       && a.Address.City == address.City
                                       && a.Address.District == address.District
                                       && a.Address.Ward == address.Ward
                                       && a.Address.Detail == address.Detail, ct);

            if (asset is null)
            {
                asset = new Asset
                {
                    UserId = userId,
                    // Tên tài sản suy từ địa chỉ — người đăng không nhập, cũng không thấy.
                    Name = string.IsNullOrWhiteSpace(address.Detail)
                        ? $"{address.Ward}, {address.District}"
                        : $"{address.Detail}, {address.District}",
                    TypeProperty = request.PropertyType,
                    OwnershipType = AssetOwnershipType.Owned,
                    Status = AssetStatus.InUse,
                    Address = address,
                    Location = request.Latitude is not null && request.Longitude is not null
                        ? _geometryFactory.CreatePoint(new Coordinate(request.Longitude.Value, request.Latitude.Value))
                        : null,
                    Area = request.Area,
                    Frontage = request.Frontage,
                    Bedrooms = request.Bedrooms,
                    Bathrooms = request.Bathrooms,
                    Floors = request.Floors,
                    HouseDirection = request.HouseDirection?.Trim(),
                    LegalStatus = request.LegalStatus?.Trim(),
                    FurnitureState = request.FurnitureState?.Trim()
                };
                await _assets.AddAsync(asset, ct);
            }
            else
            {
                // Tài sản đã có: cập nhật những đặc điểm người đăng vừa khai, nhưng KHÔNG
                // ghi đè bằng giá trị rỗng — tin mới thiếu thông tin không được xoá thông
                // tin cũ đang đúng.
                asset.Area ??= request.Area;
                asset.Frontage ??= request.Frontage;
                asset.Bedrooms ??= request.Bedrooms;
                asset.Bathrooms ??= request.Bathrooms;
                asset.Floors ??= request.Floors;
                asset.HouseDirection ??= request.HouseDirection?.Trim();
                asset.LegalStatus ??= request.LegalStatus?.Trim();
                asset.FurnitureState ??= request.FurnitureState?.Trim();

                if (asset.Location is null && request.Latitude is not null && request.Longitude is not null)
                    asset.Location = _geometryFactory.CreatePoint(
                        new Coordinate(request.Longitude.Value, request.Latitude.Value));
            }

            var listing = new Listing
            {
                Asset = asset,
                AssetUnitId = null,
                Title = request.Title.Trim(),
                Description = request.Description,
                Price = request.Price,
                Type = request.Type,
                RentPaymentCycle = request.Type == ListingType.Rent ? request.RentPaymentCycle : null,
                // Bắt đầu ở Draft: người đăng còn phải thêm ảnh, và có thể bỏ dở giữa chừng.
                Status = ListingStatus.Draft,
                Slug = await GenerateUniqueSlugAsync(request.Title, ct),
                ViewCount = 0,
                Terms = MapTerms(request.Terms),
                Amenities = NormalizeAmenities(request.Amenities)
            };

            await _listings.AddAsync(listing, ct);
            await _uow.SaveChangesAsync(ct);

            return await GetOwnedDtoAsync(listing.Id, ct);
        }

        public async Task<IReadOnlyList<ListingImageDto>> AddImagesAsync(
            Guid listingId, IFormFileCollection files, CancellationToken ct = default)
        {
            var listing = await GetOwnedListingAsync(listingId, ct);

            if (listing.Status == ListingStatus.Closed)
                throw new ConflictException("Tin đã đóng — không thêm ảnh được.");

            if (files.Count == 0)
                throw new ValidationFailedException("Chưa chọn ảnh nào.");

            var existing = await _images.Query()
                .Where(i => i.ListingId == listingId)
                .CountAsync(ct);

            if (existing + files.Count > MaxImagesPerListing)
                throw new ValidationFailedException(
                    $"Mỗi tin tối đa {MaxImagesPerListing} ảnh (đang có {existing}).");

            var sortOrder = existing;
            foreach (var file in files)
            {
                if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                    throw new ValidationFailedException($"Tệp '{file.FileName}' không phải ảnh.");

                var stored = await _files.UploadImageAsync(file, folder: $"listings/{listingId}", ct);
                await _images.AddAsync(new ListingImage
                {
                    ListingId = listingId,
                    File = stored,
                    SortOrder = sortOrder++
                }, ct);
            }

            await _uow.SaveChangesAsync(ct);
            return await GetImagesAsync(listingId, ct);
        }

        public async Task<IReadOnlyList<ListingImageDto>> GetImagesAsync(
            Guid listingId, CancellationToken ct = default)
        {
            await GetOwnedListingAsync(listingId, ct);

            return await _images.Query().AsNoTracking()
                .Where(i => i.ListingId == listingId)
                .OrderBy(i => i.SortOrder)
                .Select(i => new ListingImageDto(i.Id, i.File.Url, i.SortOrder))
                .ToListAsync(ct);
        }

        public async Task RemoveImageAsync(Guid listingId, Guid imageId, CancellationToken ct = default)
        {
            await GetOwnedListingAsync(listingId, ct);

            var image = await _images.Query()
                .FirstOrDefaultAsync(i => i.Id == imageId && i.ListingId == listingId, ct)
                ?? throw new NotFoundException("Không tìm thấy ảnh.");

            // Đẩy file lên hàng đợi xoá trong CÙNG transaction với việc xoá bản ghi —
            // nếu SaveChanges hỏng thì file trên Cloudinary cũng không bị xoá oan.
            _files.ScheduleDeletion(image.File);
            _images.Remove(image);
            await _uow.SaveChangesAsync(ct);
        }

        public async Task<OwnerListingDto> SubmitAsync(Guid listingId, CancellationToken ct = default)
        {
            var listing = await GetOwnedListingAsync(listingId, ct);

            // Cho phep ca Rejected: sua xong roi gui lai chinh la luong "dang lai" — bat
            // nguoi dung tao tin moi tu dau se lam mat luot xem va lich su cua tin cu.
            if (listing.Status is not (ListingStatus.Draft or ListingStatus.Rejected))
                throw new ConflictException("Chỉ gửi duyệt được bản nháp hoặc tin đã bị từ chối.");

            // Bản nháp cố tình cho phép thiếu. Ràng buộc tối thiểu chỉ áp ở đây, lúc gửi đi.
            var imageCount = await _images.Query().CountAsync(i => i.ListingId == listingId, ct);
            if (imageCount == 0)
                throw new ValidationFailedException("Cần ít nhất 1 ảnh trước khi gửi duyệt.");

            if (string.IsNullOrWhiteSpace(listing.Description) || listing.Description.Trim().Length < 30)
                throw new ValidationFailedException("Mô tả cần ít nhất 30 ký tự để người xem hiểu được tin.");

            // Một chỗ chỉ được có một tin đang sống. Kiểm ở đây thay vì lúc tạo, vì bản
            // nháp không nằm trong ràng buộc đó — người dùng có thể soạn nhiều nháp.
            var hasLive = await _listings.Query().AnyAsync(l =>
                l.AssetId == listing.AssetId
                && l.AssetUnitId == listing.AssetUnitId
                && l.Id != listing.Id
                && (l.Status == ListingStatus.Pending || l.Status == ListingStatus.Approved), ct);
            if (hasLive)
                throw new ConflictException(
                    "Địa chỉ này đã có một tin đang hiển thị hoặc chờ duyệt — hãy sửa tin đó thay vì đăng thêm.");

            listing.Status = ListingStatus.Pending;
            listing.ModerationNote = null;
            await _uow.SaveChangesAsync(ct);

            return await GetOwnedDtoAsync(listingId, ct);
        }

        // ==================== VÒNG ĐỜI TIN ĐĂNG (nhiệm vụ 1.4) ====================

        public async Task<EditListingDto> GetForEditAsync(Guid listingId, CancellationToken ct = default)
        {
            var listing = await _listings.Query().AsNoTracking()
                .Include(l => l.Asset)
                .FirstOrDefaultAsync(l => l.Id == listingId && l.Asset.UserId == _currentUser.UserId, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            // Tài sản còn tin khác thì phần vật lý phải khoá: sửa địa chỉ ở đây sẽ đổi
            // luôn nội dung của những tin kia mà người dùng không hề biết.
            var otherListings = await _listings.Query()
                .CountAsync(l => l.AssetId == listing.AssetId && l.Id != listingId, ct);

            var images = await _images.Query().AsNoTracking()
                .Where(i => i.ListingId == listingId)
                .OrderBy(i => i.SortOrder)
                .Select(i => new ListingImageDto(i.Id, i.File.Url, i.SortOrder))
                .ToListAsync(ct);

            var a = listing.Asset;

            return new EditListingDto(
                listing.Id, listing.Status, listing.Type, listing.Title, listing.Description,
                listing.Price, listing.RentPaymentCycle,
                a.Address.City, a.Address.District, a.Address.Ward, a.Address.Detail,
                a.TypeProperty, a.Area, a.Frontage, a.Bedrooms, a.Bathrooms, a.Floors,
                a.HouseDirection, a.LegalStatus, a.FurnitureState,
                ToTermsDto(listing.Terms), listing.Amenities, images,
                CanEditPropertyFields: otherListings == 0,
                listing.ModerationNote);
        }

        public async Task<OwnerListingDto> BumpAsync(Guid listingId, CancellationToken ct = default)
        {
            var listing = await GetOwnedListingAsync(listingId, ct);

            if (listing.Status != ListingStatus.Approved)
                throw new ConflictException("Chỉ đẩy được tin đang hiển thị.");

            var last = listing.BumpedAt ?? listing.PublishedAt ?? listing.CreatedAt;
            var elapsed = DateTime.UtcNow - last;

            if (elapsed < BumpCooldown)
            {
                var wait = BumpCooldown - elapsed;
                throw new ConflictException(
                    $"Mỗi tin chỉ đẩy được {BumpCooldown.TotalHours:0} giờ một lần. " +
                    $"Thử lại sau {wait.TotalHours:0} giờ {wait.Minutes} phút.");
            }

            listing.BumpedAt = DateTime.UtcNow;
            await _uow.SaveChangesAsync(ct);

            return await GetOwnedDtoAsync(listingId, ct);
        }

        public async Task<OwnerListingDto> ReopenAsync(Guid listingId, CancellationToken ct = default)
        {
            var listing = await GetOwnedListingAsync(listingId, ct);

            if (listing.Status != ListingStatus.Closed)
                throw new ConflictException("Chỉ mở lại được tin đã đóng.");

            // Về bản nháp chứ không thẳng lên Approved: nội dung có thể đã cũ (giá, ngày
            // trống), và tin mở lại vẫn phải qua kiểm duyệt như mọi tin khác.
            listing.Status = ListingStatus.Draft;
            listing.ModerationNote = null;
            await _uow.SaveChangesAsync(ct);

            return await GetOwnedDtoAsync(listingId, ct);
        }

        public async Task DeleteDraftAsync(Guid listingId, CancellationToken ct = default)
        {
            var listing = await GetOwnedListingAsync(listingId, ct);

            if (listing.Status != ListingStatus.Draft)
                throw new ConflictException(
                    "Chỉ xoá được bản nháp. Tin đã từng công khai thì đóng lại chứ không xoá — " +
                    "để giữ lịch sử và số liệu lượt xem.");

            var images = await _images.Query().Where(i => i.ListingId == listingId).ToListAsync(ct);
            foreach (var img in images) _files.ScheduleDeletion(img.File);

            _listings.Remove(listing);   // ListingImages cascade theo FK
            await _uow.SaveChangesAsync(ct);
        }

        // ==================== Helpers ====================

        /// <summary>Áp các trường vật lý lên Asset — CHỈ khi tài sản không còn tin nào khác.
        ///
        /// Nếu tài sản đang có nhiều tin (ví dụ mỗi phòng một tin), sửa địa chỉ hay diện tích
        /// ở đây sẽ đổi luôn nội dung của những tin kia mà người dùng không hề biết. Trường
        /// hợp đó bỏ qua trong im lặng vì biểu mẫu đã khoá phần này lại rồi — xem
        /// EditListingDto.CanEditPropertyFields.</summary>
        private async Task ApplyPropertyFieldsAsync(
            Listing listing, UpdateListingRequest request, CancellationToken ct)
        {
            if (request.City is null && request.Area is null && request.PropertyType is null)
                return;   // client không gửi phần này

            var hasOtherListings = await _listings.Query()
                .AnyAsync(l => l.AssetId == listing.AssetId && l.Id != listing.Id, ct);
            if (hasOtherListings) return;

            var asset = await _assets.Query()
                .FirstOrDefaultAsync(a => a.Id == listing.AssetId, ct);
            if (asset is null) return;

            if (!string.IsNullOrWhiteSpace(request.City)) asset.Address.City = request.City.Trim();
            if (!string.IsNullOrWhiteSpace(request.District)) asset.Address.District = request.District.Trim();
            if (!string.IsNullOrWhiteSpace(request.Ward)) asset.Address.Ward = request.Ward.Trim();
            if (request.AddressDetail is not null) asset.Address.Detail = request.AddressDetail.Trim();

            if (request.PropertyType is not null) asset.TypeProperty = request.PropertyType.Value;
            if (request.Area is not null) asset.Area = request.Area;
            if (request.Frontage is not null) asset.Frontage = request.Frontage;
            if (request.Bedrooms is not null) asset.Bedrooms = request.Bedrooms;
            if (request.Bathrooms is not null) asset.Bathrooms = request.Bathrooms;
            if (request.Floors is not null) asset.Floors = request.Floors;
            if (request.HouseDirection is not null) asset.HouseDirection = request.HouseDirection.Trim();
            if (request.LegalStatus is not null) asset.LegalStatus = request.LegalStatus.Trim();
            if (request.FurnitureState is not null) asset.FurnitureState = request.FurnitureState.Trim();
        }

        private async Task<Listing> GetOwnedListingAsync(Guid listingId, CancellationToken ct)
            => await _listings.Query()
                   .FirstOrDefaultAsync(l => l.Id == listingId && l.Asset.UserId == _currentUser.UserId, ct)
               ?? throw new NotFoundException("Không tìm thấy tin đăng.");

        private async Task<OwnerListingDto> GetOwnedDtoAsync(Guid listingId, CancellationToken ct)
            => await ProjectOwner(_listings.Query().AsNoTracking().Where(l => l.Id == listingId))
                   .FirstAsync(ct);

        private static IQueryable<OwnerListingDto> ProjectOwner(IQueryable<Listing> q) =>
            q.Select(l => new OwnerListingDto(
                l.Id, l.Slug, l.Title, l.Type, l.Status, l.Price, l.RentPaymentCycle, l.ViewCount,
                l.CreatedAt, l.PublishedAt, l.AssetId, l.Asset.Name,
                l.AssetUnit != null ? l.AssetUnit.Name : null, l.ModerationNote,
                Completeness(l)));

        // ==================== Điều kiện thuê ====================

        private static ListingTerms MapTerms(ListingTermsDto? dto)
        {
            if (dto is null) return new ListingTerms();

            return new ListingTerms
            {
                DepositMonths = dto.DepositMonths,
                ElectricityPrice = dto.ElectricityPrice,
                WaterPrice = dto.WaterPrice,
                WaterPricing = dto.WaterPricing,
                ServiceFee = dto.ServiceFee,
                ParkingFee = dto.ParkingFee,
                InternetFee = dto.InternetFee,
                MinLeaseMonths = dto.MinLeaseMonths,
                AvailableFrom = dto.AvailableFrom is null
                    ? null
                    : DateTime.SpecifyKind(dto.AvailableFrom.Value, DateTimeKind.Utc),
                MaxOccupants = dto.MaxOccupants,
                PetsAllowed = dto.PetsAllowed,
                CurfewFree = dto.CurfewFree,
                SharedWithOwner = dto.SharedWithOwner,
                CookingAllowed = dto.CookingAllowed
            };
        }

        private static ListingTermsDto ToTermsDto(ListingTerms t) => new(
            t.DepositMonths, t.ElectricityPrice, t.WaterPrice, t.WaterPricing,
            t.ServiceFee, t.ParkingFee, t.InternetFee,
            t.MinLeaseMonths, t.AvailableFrom, t.MaxOccupants,
            t.PetsAllowed, t.CurfewFree, t.SharedWithOwner, t.CookingAllowed);

        /// <summary>Bỏ khoá lạ, khử trùng lặp, giữ thứ tự ổn định. Khoá không nằm trong
        /// AmenityKeys.All bị loại im lặng thay vì ném lỗi — client cũ gửi khoá lạ thì tin
        /// vẫn đăng được, chỉ là tiện nghi đó không được ghi nhận.</summary>
        private static List<string> NormalizeAmenities(IEnumerable<string>? input)
            => input is null
                ? new List<string>()
                : input.Where(a => AmenityKeys.All.Contains(a)).Distinct().Order().ToList();

        /// <summary>Tổng chi phí cố định hàng tháng. Điện và nước tính theo mức dùng nên
        /// KHÔNG cộng vào đây — cộng vào sẽ tạo ra một con số trông chính xác mà sai.</summary>
        private static decimal TotalMonthlyCost(Listing l)
            => l.Price + (l.Terms.ServiceFee ?? 0) + (l.Terms.ParkingFee ?? 0) + (l.Terms.InternetFee ?? 0);

        /// <summary>Độ đầy đủ dữ kiện của tin, 0–100.
        ///
        /// Cố tình chấm theo thứ NGƯỜI THUÊ hỏi trước khi đi xem — cọc, điện, nước, ngày trống,
        /// nội quy — chứ không theo thứ dễ điền. Hiển thị con số này cho chủ tin là cách tạo
        /// động lực thật (tin đầy đủ được tìm thấy nhiều hơn), thay vì bắt buộc nhập hết.
        ///
        /// Viết dưới dạng biểu thức để EF dịch thẳng sang SQL trong projection, không phải
        /// nạp cả entity về rồi tính.</summary>
        private static int Completeness(Listing l)
            => (l.Terms.DepositMonths != null ? 15 : 0)
             + (l.Terms.ElectricityPrice != null ? 15 : 0)
             + (l.Terms.WaterPrice != null ? 15 : 0)
             + (l.Terms.AvailableFrom != null ? 10 : 0)
             + (l.Terms.MinLeaseMonths != null ? 5 : 0)
             + (l.Terms.MaxOccupants != null ? 5 : 0)
             + (l.Terms.PetsAllowed != null ? 10 : 0)
             + (l.Terms.CurfewFree != null ? 5 : 0)
             + (l.Terms.SharedWithOwner != null ? 5 : 0)
             + (l.Amenities.Count >= 3 ? 10 : 0)
             + (l.Description.Length >= 120 ? 5 : 0);

        internal static string AssetTypeLabel(AssetDomainType type) => type switch
        {
            AssetDomainType.PrivateHouse => "Nhà riêng",
            AssetDomainType.Apartment => "Căn hộ",
            AssetDomainType.Land => "Đất",
            AssetDomainType.Villa => "Biệt thự",
            AssetDomainType.Shophouse => "Nhà mặt phố",
            AssetDomainType.Office => "Văn phòng",
            _ => "Khác"
        };

        private async Task<string> GenerateUniqueSlugAsync(string title, CancellationToken ct)
        {
            var baseSlug = ToSlug(title);
            var candidate = $"{baseSlug}-{Guid.NewGuid().ToString("N")[..6]}";

            while (await _listings.Query().AnyAsync(l => l.Slug == candidate, ct))
                candidate = $"{baseSlug}-{Guid.NewGuid().ToString("N")[..6]}";

            return candidate;
        }

        private static string ToSlug(string input)
        {
            var normalized = input.ToLowerInvariant();
            normalized = Regex.Replace(
                normalized.Normalize(NormalizationForm.FormD), @"\p{Mn}", "");
            normalized = normalized.Replace('đ', 'd');
            normalized = Regex.Replace(normalized, @"[^a-z0-9\s-]", "");
            normalized = Regex.Replace(normalized, @"\s+", "-").Trim('-');
            return normalized.Length > 60 ? normalized[..60].Trim('-') : normalized;
        }
    }
}
