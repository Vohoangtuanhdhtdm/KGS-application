using kgs_api.Domain.Entity;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Rules
{
    /// <summary>Điều kiện lọc của tìm kiếm công khai, tách riêng để dùng chung.
    ///
    /// Trang tìm kiếm và job đối chiếu bộ lọc đã lưu PHẢI hiểu "khớp" giống hệt nhau.
    /// Nếu mỗi bên tự dựng mệnh đề riêng, chúng sẽ trôi khỏi nhau ngay lần thêm bộ lọc kế
    /// tiếp — và triệu chứng là thứ khó chịu nhất có thể: người dùng nhận email báo có tin
    /// mới, bấm vào thì danh sách không có tin đó, hoặc ngược lại. Một bản cài đặt duy nhất
    /// thì không thể lệch.
    ///
    /// Không đụng tới sắp xếp và phân trang — hai thứ đó chỉ trang tìm kiếm mới cần.</summary>
    public static class ListingSearchFilter
    {
        /// <summary>Lọc theo tiêu chí công khai. <paramref name="origin"/> là tâm tìm kiếm đã
        /// dựng sẵn — hàm này không giữ GeometryFactory để còn gọi được từ job nền.
        /// <paramref name="area"/> là vùng đi lại đã dựng từ <c>query.Within</c> (TravelArea).</summary>
        public static IQueryable<Listing> Apply(
            IQueryable<Listing> source, PublicListingSearchQuery query, Point? origin,
            Geometry? area = null)
        {
            var q = source.Where(l => l.Status == ListingStatus.Approved);

            if (query.Type is not null) q = q.Where(l => l.Type == query.Type);
            // Đưa tên khu vực người tìm gửi lên về cùng dạng chuẩn với dữ liệu đã lưu — "TP. HCM",
            // "Hồ Chí Minh", "Q.3" đều khớp. Xem AdministrativeNames.
            var city = AdministrativeNames.CanonicalCity(query.City);
            var district = AdministrativeNames.CanonicalDistrict(city, query.District);
            if (!string.IsNullOrWhiteSpace(city)) q = q.Where(l => l.Asset.Address.City == city);
            if (!string.IsNullOrWhiteSpace(district)) q = q.Where(l => l.Asset.Address.District == district);
            if (query.PriceMin is not null) q = q.Where(l => l.Price >= query.PriceMin);
            if (query.PriceMax is not null) q = q.Where(l => l.Price <= query.PriceMax);
            if (query.BedroomsMin is not null) q = q.Where(l => l.Asset.Bedrooms >= query.BedroomsMin);

            // ---- Đặc điểm bất động sản (mọi loại hình) ----
            if (query.PropertyTypes is { Count: > 0 })
            {
                var types = query.PropertyTypes;
                q = q.Where(l => types.Contains(l.Asset.TypeProperty));
            }
            // Diện tích lấy theo cùng quy tắc với sắp xếp "diện tích lớn nhất": tin đăng riêng
            // một căn/phòng thì là diện tích căn đó, không phải cả toà nhà.
            if (query.AreaMin is not null)
                q = q.Where(l => (l.AssetUnit != null ? l.AssetUnit.Area : l.Asset.Area) >= query.AreaMin);
            if (query.AreaMax is not null)
                q = q.Where(l => (l.AssetUnit != null ? l.AssetUnit.Area : l.Asset.Area) <= query.AreaMax);
            if (query.BathroomsMin is not null) q = q.Where(l => l.Asset.Bathrooms >= query.BathroomsMin);
            if (query.FloorsMin is not null) q = q.Where(l => l.Asset.Floors >= query.FloorsMin);
            if (query.FrontageMin is not null) q = q.Where(l => l.Asset.Frontage >= query.FrontageMin);
            // "Có mô hình 3D": đúng điều kiện mà trang tin dùng để hiện thẻ Toà nhà 3D, để lọc
            // ra tin nào thì mở tin đó cũng thấy được toà nhà.
            if (query.Has3D == true)
                q = q.Where(l => l.Asset.BuildingModelPublished && l.Asset.FootprintJson != null);

            var directions = PropertyVocabulary.NormalizeFilter(
                query.Directions, PropertyVocabulary.NormalizeDirection, PropertyVocabulary.Directions);
            if (directions is not null) q = q.Where(l => directions.Contains(l.Asset.HouseDirection!));
            var legal = PropertyVocabulary.NormalizeFilter(
                query.LegalStatuses, PropertyVocabulary.NormalizeLegal, PropertyVocabulary.LegalStatuses);
            if (legal is not null) q = q.Where(l => legal.Contains(l.Asset.LegalStatus!));
            var furniture = PropertyVocabulary.NormalizeFilter(
                query.FurnitureStates, PropertyVocabulary.NormalizeFurniture, PropertyVocabulary.FurnitureStates);
            if (furniture is not null) q = q.Where(l => furniture.Contains(l.Asset.FurnitureState!));

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

            // Toạ độ đọc từ Asset.Location — GiST index đã có sẵn trên bảng Assets.
            if (origin is not null && query.RadiusMeters is not null)
                q = q.Where(l => l.Asset.Location != null
                              && EF.Functions.IsWithinDistance(l.Asset.Location, origin, query.RadiusMeters.Value, true));

            // ST_Intersects chứ không phải ST_Within: cột Location là geography, và PostGIS
            // chỉ có ST_Intersects cho geography. Với một điểm thì hai phép này như nhau.
            if (area is not null)
                q = q.Where(l => l.Asset.Location != null && l.Asset.Location.Intersects(area));

            return q;
        }

        /// <summary>Chỉ giữ các khoá tiện nghi hợp lệ, bỏ trùng, sắp xếp cố định.
        ///
        /// Khoá lạ bị loại im lặng thay vì ném lỗi — client cũ gửi khoá không còn tồn tại
        /// thì tin vẫn đăng được, chỉ là tiện nghi đó không được ghi nhận.</summary>
        public static List<string> NormalizeAmenities(IEnumerable<string>? input)
            => input is null
                ? new List<string>()
                : input.Where(a => AmenityKeys.All.Contains(a)).Distinct().Order().ToList();

        /// <summary>Có đủ dữ kiện để tìm theo bán kính hay không.</summary>
        public static bool HasGeoSearch(PublicListingSearchQuery q)
            => q.Latitude is not null && q.Longitude is not null && q.RadiusMeters is not null;
    }
}
