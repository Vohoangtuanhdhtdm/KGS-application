using System.Reflection;
using System.Text.Json;
using NetTopologySuite.Geometries;
using NetTopologySuite.Index.Strtree;

namespace kgs_api.Domain.Rules
{
    /// <summary>Ranh giới phường/xã sau sắp xếp 2025, cho các tỉnh/thành đang có tin.
    ///
    /// Hai việc: (1) phân định địa chỉ khi một phường cũ bị chia cho nhiều phường mới — bảng chuyển
    /// đổi chỉ nói "thuộc A hoặc B", toạ độ của tài sản nói chính xác là A hay B; (2) vẽ đường viền
    /// phường trên bản đồ tìm nhà khi người dùng lọc theo một phường mới.
    ///
    /// Dữ liệu: Data/vn-ward-boundaries.geojson — từ OpenStreetMap (© OpenStreetMap contributors,
    /// ODbL 1.0), đã ghép thành đa giác, đơn giản hoá ~9 m và khớp tên với danh mục 2025. Hiện có
    /// TP.HCM, Hà Nội, Đà Nẵng; tỉnh khác chưa có thì mọi hàm trả null và hệ thống dùng bảng chuyển
    /// đổi như cũ.</summary>
    public static class WardBoundaries
    {
        private sealed record Ward(string Code, Geometry Geometry, string GeoJson);

        private sealed record Store(Dictionary<string, Ward> ByCode, STRtree<Ward> Index);

        private static readonly Lazy<Store> Data = new(Load);
        private static readonly GeometryFactory Factory = new(new PrecisionModel(), 4326);

        public const string Attribution = "© OpenStreetMap contributors (ODbL)";

        private static Store Load()
        {
            var asm = Assembly.GetExecutingAssembly();
            var res = asm.GetManifestResourceNames().First(n => n.EndsWith("vn-ward-boundaries.geojson", StringComparison.Ordinal));
            using var s = asm.GetManifestResourceStream(res)!;
            using var doc = JsonDocument.Parse(s);
            var byCode = new Dictionary<string, Ward>();
            var index = new STRtree<Ward>();
            foreach (var f in doc.RootElement.GetProperty("features").EnumerateArray())
            {
                var code = f.GetProperty("properties").GetProperty("code").GetString()!;
                var geom = f.GetProperty("geometry");
                var polys = geom.GetProperty("coordinates").EnumerateArray()
                    .Select(p => Factory.CreatePolygon(
                        Ring(p[0]),
                        p.EnumerateArray().Skip(1).Select(Ring).ToArray()))
                    .ToArray();
                var g = Factory.CreateMultiPolygon(polys);
                var w = new Ward(code, g, f.GetRawText());
                byCode[code] = w;
                index.Insert(g.EnvelopeInternal, w);
            }
            index.Build();
            return new Store(byCode, index);
        }

        private static LinearRing Ring(JsonElement ring)
            => Factory.CreateLinearRing(ring.EnumerateArray()
                .Select(c => new Coordinate(c[0].GetDouble(), c[1].GetDouble()))
                .ToArray());

        /// <summary>Mã phường mới chứa toạ độ này; null khi ngoài vùng có dữ liệu ranh giới.</summary>
        public static string? Find(double lng, double lat)
        {
            var pt = Factory.CreatePoint(new Coordinate(lng, lat));
            return Data.Value.Index.Query(pt.EnvelopeInternal)
                .FirstOrDefault(w => w.Geometry.Covers(pt))?.Code;
        }

        /// <summary>GeoJSON Feature của một phường (đã đơn giản hoá), hoặc null.</summary>
        public static string? GeoJson(string code)
            => Data.Value.ByCode.TryGetValue(code, out var w) ? w.GeoJson : null;

        public static bool Has(string code) => Data.Value.ByCode.ContainsKey(code);
    }
}
