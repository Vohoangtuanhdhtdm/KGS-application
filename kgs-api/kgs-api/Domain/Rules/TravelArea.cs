using System.Globalization;
using NetTopologySuite.Geometries;

namespace kgs_api.Domain.Rules
{
    /// <summary>Vùng "đi tới được trong X phút" mà trang tìm kiếm gửi lên, dạng chuỗi
    /// <c>lng,lat;lng,lat;...</c> (một vòng ngoài của đa giác).
    ///
    /// Vì sao lọc ở máy chủ chứ không lọc danh sách ở trình duyệt: lọc ở trình duyệt chỉ lọc
    /// được TRANG đang tải — tổng số tin sai, trang sau có thể rỗng, sắp "gần nhất" sai. Chỉ
    /// PostGIS mới trả đúng "mọi tin trong vùng này".
    ///
    /// Vùng do trình duyệt lấy từ Mapbox Isochrone rồi gửi kèm từng lần tìm; máy chủ không
    /// lưu nó (xem SavedSearchService.Sanitize) — kết quả Isochrone chỉ được dùng để hiển thị
    /// trên bản đồ Mapbox, không phải dữ liệu để cất giữ.</summary>
    public static class TravelArea
    {
        /// <summary>Đủ để giữ hình dạng một vùng đi lại trong thành phố, và giữ URL tìm kiếm
        /// dưới giới hạn độ dài dòng yêu cầu của Kestrel (8 KB).</summary>
        public const int MaxPoints = 300;

        public static bool TryParse(string? raw, GeometryFactory factory, out Geometry? area, out string? error)
        {
            area = null;
            error = null;
            if (string.IsNullOrWhiteSpace(raw)) return true;   // không có vùng — không lọc

            var parts = raw.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length < 3 || parts.Length > MaxPoints)
            {
                error = $"Vùng tìm kiếm phải có từ 3 đến {MaxPoints} điểm.";
                return false;
            }

            var coords = new List<Coordinate>(parts.Length + 1);
            foreach (var p in parts)
            {
                var xy = p.Split(',');
                if (xy.Length != 2
                    || !double.TryParse(xy[0], NumberStyles.Float, CultureInfo.InvariantCulture, out var lng)
                    || !double.TryParse(xy[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var lat)
                    || lng is < -180 or > 180 || lat is < -90 or > 90)
                {
                    error = "Vùng tìm kiếm có toạ độ không hợp lệ.";
                    return false;
                }
                coords.Add(new Coordinate(lng, lat));
            }
            if (!coords[0].Equals2D(coords[^1])) coords.Add(coords[0].Copy());
            if (coords.Count < 4)
            {
                error = "Vùng tìm kiếm phải có từ 3 đến " + MaxPoints + " điểm.";
                return false;
            }

            Geometry g = factory.CreatePolygon(coords.ToArray());
            // Làm gọn phía trình duyệt có thể tạo ra cạnh tự cắt ở những khúc hẹp; Buffer(0)
            // là cách chuẩn để sửa đa giác như vậy thay vì từ chối cả lượt tìm.
            if (!g.IsValid) g = g.Buffer(0);
            if (g.IsEmpty)
            {
                error = "Vùng tìm kiếm không hợp lệ.";
                return false;
            }
            g.SRID = factory.SRID;
            area = g;
            return true;
        }
    }
}
