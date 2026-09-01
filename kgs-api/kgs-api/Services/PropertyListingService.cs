using CloudinaryDotNet.Actions;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using kgs_api.Interfaces;
using kgs_api.Repositories;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services
{
    public sealed class PropertyListingService : IPropertyListingService
    {
        private readonly IRepository<Asset> _assets;
        private readonly IRepository<Property> _properties;
        private readonly IRepository<AssetMedia> _media;
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory;

        public PropertyListingService(IRepository<Asset> assets, IRepository<Property> properties,
            IRepository<AssetMedia> media, IUnitOfWork uow, ICurrentUserService currentUser)
        {
            _assets = assets; _properties = properties; _media = media; _uow = uow; _currentUser = currentUser;
            _geometryFactory = NetTopologySuite.NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);
        }

        public async Task<OwnerListingDto> CreateFromAssetAsync(Guid assetId, CreateListingFromAssetRequest request, CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            var asset = await _assets.Query()
                .FirstOrDefaultAsync(a => a.Id == assetId && a.UserId == userId, ct)
                ?? throw new NotFoundException("Không tìm thấy tài sản.");

            if (asset.LinkedPropertyId is not null)
                throw new ConflictException("Tài sản này đã có tin đăng công khai liên kết — hãy sửa tin đăng hiện có thay vì tạo mới.");

            if (request.Type == ListingType.Rent && request.RentPaymentCycle is null)
                throw new ValidationFailedException("Tin cho thuê bắt buộc phải chọn chu kỳ thanh toán.");

            var selectedMedia = await _media.Query()
                .Where(m => m.AssetId == assetId && request.SelectedAssetMediaIds.Contains(m.Id))
                .ToListAsync(ct);

            if (selectedMedia.Count == 0)
                throw new ValidationFailedException("Cần chọn ít nhất 1 ảnh để đăng tin công khai.");

            var slug = await GenerateUniqueSlugAsync(request.Title, ct);

            var property = new Property
            {
                Title = request.Title,
                Description = request.Description,
                Price = request.Price,
                Type = request.Type,
                RentPaymentCycle = request.Type == ListingType.Rent ? request.RentPaymentCycle : null,
                City = asset.Address.City,
                District = asset.Address.District,
                Ward = asset.Address.Ward,
                AddressDetail = asset.Address.Detail,
                Area = asset.Area ?? 0,
                Frontage = request.Frontage ?? 0,

                // ← SỬA 6 dòng — chuỗi ưu tiên: giá trị người dùng nhập (request)
                //   → nếu trống, lấy từ Asset đã lưu → nếu Asset cũng trống, dùng mặc định
                Floors = request.Floors ?? asset.Floors ?? 0,
                Bedrooms = request.Bedrooms ?? asset.Bedrooms ?? 0,
                Bathrooms = request.Bathrooms ?? asset.Bathrooms ?? 0,
                HouseDirection = request.HouseDirection ?? asset.HouseDirection ?? string.Empty,
                LegalStatus = request.LegalStatus ?? asset.LegalStatus ?? string.Empty,
                FurnitureState = request.FurnitureState ?? asset.FurnitureState ?? string.Empty,

                // ← MỚI — không nhận từ request nữa, tự suy từ loại tài sản
                PropertyType = MapAssetTypeToDisplayString(asset.TypeProperty),

                Location = asset.Location,
                Status = PropertyStatus.Pending,
                Slug = slug,
                ViewCount = 0,
                CreatedAt = DateTime.UtcNow,
                UserId = userId,
                Images = selectedMedia.Select((m, i) => new PropertyImages
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

            await _properties.AddAsync(property, ct);
            await _uow.SaveChangesAsync(ct);
            // ← INSERT Property CHẠY Ở ĐÂY. Sau dòng này, property.Id mới là giá trị thật
            //   (EF Core tự cập nhật property.Id sau khi insert thành công với cột identity).

            // ⚠️ SỬA — KHÔNG còn gán asset.LinkedPropertyId ở bất kỳ đâu TRƯỚC dòng SaveChanges ở trên.
            // Đây là lần gán DUY NHẤT, và nó xảy ra SAU khi property.Id đã có giá trị thật.
            asset.LinkedPropertyId = property.Id;
            await _uow.SaveChangesAsync(ct);

            return new OwnerListingDto(property.Id, property.Slug, property.Title, property.Type,
                property.Status, property.Price, property.ViewCount, property.CreatedAt, asset.Id);
        }

        public async Task<PagedResult<PublicPropertySummaryDto>> SearchPublicAsync(PublicPropertySearchQuery query, CancellationToken ct = default)
        {
            var q = _properties.Query().AsNoTracking()
                .Where(p => p.Status == PropertyStatus.Approved);   // CHỈ tin đã duyệt — không lộ Pending/Rejected

            if (query.Type is not null) q = q.Where(p => p.Type == query.Type);
            if (!string.IsNullOrWhiteSpace(query.City)) q = q.Where(p => p.City == query.City);
            if (!string.IsNullOrWhiteSpace(query.District)) q = q.Where(p => p.District == query.District);
            if (query.PriceMin is not null) q = q.Where(p => p.Price >= query.PriceMin);
            if (query.PriceMax is not null) q = q.Where(p => p.Price <= query.PriceMax);
            if (query.BedroomsMin is not null) q = q.Where(p => p.Bedrooms >= query.BedroomsMin);
            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                var kw = $"%{query.Keyword.Trim()}%";
                q = q.Where(p => EF.Functions.ILike(p.Title, kw) || EF.Functions.ILike(p.AddressDetail, kw));
            }

            // ← MỚI — tìm theo bán kính, CHỈ áp dụng khi cả 3 tham số đều có giá trị
            NetTopologySuite.Geometries.Point? origin = null;
            var hasGeoSearch = query.Latitude is not null && query.Longitude is not null && query.RadiusMeters is not null;
            if (hasGeoSearch)
            {
                origin = _geometryFactory.CreatePoint(new Coordinate(query.Longitude!.Value, query.Latitude!.Value));
                q = q.Where(p => p.Location != null
                               && EF.Functions.IsWithinDistance(p.Location, origin, query.RadiusMeters!.Value, true));
            }

            var total = await q.CountAsync(ct);
            var pageSize = Math.Clamp(query.PageSize, 1, 50);
            var page = Math.Max(query.Page, 1);

            // Sắp xếp theo khoảng cách nếu đang tìm theo vị trí, ngược lại theo tin mới nhất
            var ordered = hasGeoSearch
                ? q.OrderBy(p => p.Location!.Distance(origin))
                : q.OrderByDescending(p => p.CreatedAt);

            var items = await ordered
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(p => new PublicPropertySummaryDto(
                    p.Id, p.Slug!, p.Title, p.Type, p.Price, p.RentPaymentCycle,
                    p.City, p.District, p.Bedrooms, p.Bathrooms, p.Area,
                    p.Images.OrderBy(i => i.SortOrder).Select(i => i.File.Url).FirstOrDefault(),
                    hasGeoSearch ? (double?)p.Location!.Distance(origin!) : null))
                .ToListAsync(ct);

            return new PagedResult<PublicPropertySummaryDto>(items, page, pageSize, total);
        }

        public async Task<PublicPropertyDetailDto> GetPublicBySlugAsync(string slug, CancellationToken ct = default)
        {
            var property = await _properties.Query()
                .Include(p => p.Images)
                .FirstOrDefaultAsync(p => p.Slug == slug && p.Status == PropertyStatus.Approved, ct)
                ?? throw new NotFoundException("Không tìm thấy tin đăng.");

            // Tăng lượt xem — ghi chú: đơn giản hoá cho MVP, không chống trùng theo IP/session.
            // Nếu cần chính xác hơn ở Giai đoạn 2, thêm bảng PropertyView(PropertyId, IpHash, ViewedAt)
            // và chỉ tăng nếu chưa có bản ghi trong 24h từ cùng IP.
            property.ViewCount++;
            await _uow.SaveChangesAsync(ct);

            var owner = await _properties.Query()
                .Where(p => p.Id == property.Id)
                .Select(p => new { p.User.Name, p.User.PhoneNumber })
                .FirstAsync(ct);

            //double.TryParse(property.Latitude, out var lat);
            //double.TryParse(property.Longitude, out var lng);

            return new PublicPropertyDetailDto(
                property.Id, property.Slug!, property.Title, property.Description, property.Type,
                property.Price, property.RentPaymentCycle,
                property.City, property.District, property.Ward, property.AddressDetail,
                property.Area, property.Frontage, property.Floors, property.Bedrooms, property.Bathrooms,
                property.HouseDirection, property.LegalStatus, property.FurnitureState, property.PropertyType,
                // THAY bằng:
                property.Location?.Y, property.Location?.X,   // Y=lat, X=lng — ĐÚNG THỨ TỰ, dễ đảo nhầm*/
                property.Images.OrderBy(i => i.SortOrder).Select(i => i.File.Url).ToList(),
                property.ViewCount,
                owner.Name, owner.PhoneNumber ?? "Chưa cập nhật số điện thoại");
        }

        public async Task<IReadOnlyList<OwnerListingDto>> GetMyListingsAsync(CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;

            return await _properties.Query().AsNoTracking()
                .Where(p => p.UserId == userId)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new OwnerListingDto(
                    p.Id, p.Slug, p.Title, p.Type, p.Status, p.Price, p.ViewCount, p.CreatedAt,
                    _assets.Query().Where(a => a.LinkedPropertyId == p.Id).Select(a => (Guid?)a.Id).FirstOrDefault()))
                .ToListAsync(ct);
        }

        // ---- Helper: sinh slug duy nhất từ tiêu đề ----
        private async Task<string> GenerateUniqueSlugAsync(string title, CancellationToken ct)
        {
            var baseSlug = ToSlug(title);
            var candidate = $"{baseSlug}-{Guid.NewGuid().ToString("N")[..6]}";   // hậu tố 6 ký tự đảm bảo duy nhất

            // Cực hiếm khi trùng do hậu tố random, nhưng vẫn kiểm tra cho chắc
            while (await _properties.Query().AnyAsync(p => p.Slug == candidate, ct))
                candidate = $"{baseSlug}-{Guid.NewGuid().ToString("N")[..6]}";

            return candidate;
        }

        private static string ToSlug(string input)
        {
            var normalized = input.ToLowerInvariant();
            // Bỏ dấu tiếng Việt — cách đơn giản, đủ dùng cho slug (không cần hoàn hảo unicode)
            normalized = System.Text.RegularExpressions.Regex.Replace(
                normalized.Normalize(System.Text.NormalizationForm.FormD),
                @"[\u0300-\u036f]", "");
            normalized = normalized.Replace('đ', 'd');
            normalized = System.Text.RegularExpressions.Regex.Replace(normalized, @"[^a-z0-9\s-]", "");
            normalized = System.Text.RegularExpressions.Regex.Replace(normalized, @"\s+", "-").Trim('-');
            return normalized.Length > 60 ? normalized[..60].Trim('-') : normalized;
        }

        /// <summary>Chuyển enum loại tài sản thành chuỗi hiển thị cho tin đăng công khai —
        /// thay cho việc bắt người dùng nhập lại loại hình lần thứ hai.</summary>
        private static string MapAssetTypeToDisplayString(AssetDomainType type) => type switch
        {
            AssetDomainType.PrivateHouse => "Nhà riêng",
            AssetDomainType.Apartment => "Căn hộ",
            AssetDomainType.Land => "Đất",
            AssetDomainType.Villa => "Biệt thự",
            AssetDomainType.Shophouse => "Nhà mặt phố",
            AssetDomainType.Office => "Văn phòng",
            _ => "Khác"
        };
    }
}
