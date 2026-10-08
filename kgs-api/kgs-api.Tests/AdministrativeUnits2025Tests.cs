using kgs_api.Domain.Rules;
using kgs_api.Domain.ValueObjects;

namespace kgs_api.Tests;

/// <summary>Kiểm thử chuyển địa chỉ cũ (3 cấp) sang địa chỉ sau sắp xếp 2025 (2 cấp).</summary>
public class AdministrativeUnits2025Tests
{
    [Fact]
    public void Co34TinhThanh_Va3321PhuongXa()
    {
        Assert.Equal(34, AdministrativeUnits2025.Provinces.Count);
        Assert.Equal(3321, AdministrativeUnits2025.Provinces.Sum(p => AdministrativeUnits2025.WardsOf(p.Code).Count()));
    }

    [Fact]
    public void PhuongCu_RaPhuongMoi()
    {
        var n = AdministrativeUnits2025.Resolve("Thành phố Hồ Chí Minh", "Quận Gò Vấp", "Phường 12");
        Assert.NotNull(n);
        Assert.Equal("Phường An Hội Tây", n!.Ward);
        Assert.Equal("Thành phố Hồ Chí Minh", n.Province);
        Assert.False(n.Ambiguous);
        Assert.Equal("Phường Sài Gòn", AdministrativeUnits2025.Resolve("Thành phố Hồ Chí Minh", "Quận 1", "Phường Bến Nghé")!.Ward);
    }

    [Theory]
    [InlineData("TP. Hồ Chí Minh", "Q. Gò Vấp", "P.12")]
    [InlineData("tphcm", "Gò Vấp", "Phường 12")]
    [InlineData("Hồ Chí Minh", "quận gò vấp", "phường 12")]
    public void CachVietTat_VanTraDuoc(string city, string district, string ward)
        => Assert.Equal("Phường An Hội Tây", AdministrativeUnits2025.Resolve(city, district, ward)?.Ward);

    [Fact]
    public void BinhDuong_NayThuocTPHCM()
    {
        var n = AdministrativeUnits2025.Resolve("Tỉnh Bình Dương", "Thành phố Thuận An", "Phường An Phú");
        Assert.Equal("Thành phố Hồ Chí Minh", n?.Province);
    }

    [Fact]
    public void PhuongBiChia_ChonTheoGoiY_NeuHopLe()
    {
        var codes = AdministrativeUnits2025.CandidateWardCodes("Thành phố Hồ Chí Minh", "Quận Gò Vấp", "Phường 13");
        Assert.Equal(2, codes.Count);
        var mac = AdministrativeUnits2025.Resolve("Thành phố Hồ Chí Minh", "Quận Gò Vấp", "Phường 13");
        Assert.True(mac!.Ambiguous);
        var chon = AdministrativeUnits2025.Resolve("Thành phố Hồ Chí Minh", "Quận Gò Vấp", "Phường 13", codes[1]);
        Assert.Equal(codes[1], chon!.WardCode);
        Assert.False(chon.Ambiguous);
        // Gợi ý không thuộc danh sách thì bỏ qua.
        Assert.Equal(codes[0], AdministrativeUnits2025.Resolve("Thành phố Hồ Chí Minh", "Quận Gò Vấp", "Phường 13", "99999")!.WardCode);
    }

    [Fact]
    public void KhongTraDuoc_ThiDeTrong()
    {
        Assert.Null(AdministrativeUnits2025.Resolve("Thành phố Hồ Chí Minh", "Quận Gò Vấp", "Phường Không Có"));
        var a = new Address { City = "Nơi lạ", District = "Quận lạ", Ward = "Phường lạ", NewWard = "cũ", NewWardCode = "1" };
        a.SyncNewUnits();
        Assert.Null(a.NewWard);
        Assert.Null(a.NewWardCode);
    }

    [Fact]
    public void Address_GiuLuaChonCu_KhiPhuongBiChia()
    {
        var codes = AdministrativeUnits2025.CandidateWardCodes("Thành phố Hồ Chí Minh", "Quận Gò Vấp", "Phường 13");
        var a = new Address { City = "Thành phố Hồ Chí Minh", District = "Quận Gò Vấp", Ward = "Phường 13", NewWardCode = codes[1] };
        a.SyncNewUnits();
        Assert.Equal(codes[1], a.NewWardCode);
        Assert.Equal("79", a.NewProvinceCode);
    }

    [Theory]
    [InlineData("Phường 05", "phuong 5")]
    [InlineData("Phường Bến Nghé", "ben nghe")]
    [InlineData("Xã Tân Thông Hội", "tan thong hoi")]
    [InlineData("Thị trấn Củ Chi", "cu chi")]
    public void KhoaTenPhuong(string raw, string key) => Assert.Equal(key, AdministrativeUnits2025.WardKey(raw));
}

/// <summary>Kiểm thử ranh giới phường (OSM) và việc phân định phường bị chia theo toạ độ.</summary>
public class WardBoundariesTests
{
    private static readonly NetTopologySuite.Geometries.GeometryFactory F =
        NetTopologySuite.NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);

    [Fact]
    public void ToaDoTrungTamQuan1_ThuocPhuongSaiGon()
    {
        // Nhà hát Thành phố (Quận 1 cũ) → Phường Sài Gòn.
        var code = WardBoundaries.Find(106.7032, 10.7765);
        Assert.Equal("Phường Sài Gòn", AdministrativeUnits2025.Ward(code)?.Name);
    }

    [Fact]
    public void NgoaiVungCoDuLieu_ThiNull() => Assert.Null(WardBoundaries.Find(105.78, 10.03)); // Cần Thơ

    [Fact]
    public void PhuongBiChia_ToaDoQuyetDinh()
    {
        var codes = AdministrativeUnits2025.CandidateWardCodes("Thành phố Hồ Chí Minh", "Quận Gò Vấp", "Phường 13");
        Assert.Equal(2, codes.Count);
        foreach (var code in codes)
        {
            // Lấy một điểm chắc chắn nằm trong từng phường ứng viên, rồi xem Address có chọn đúng không.
            var json = WardBoundaries.GeoJson(code);
            Assert.NotNull(json);
            var reader = System.Text.Json.JsonDocument.Parse(json!);
            var ring = reader.RootElement.GetProperty("geometry").GetProperty("coordinates")[0][0]
                .EnumerateArray().Select(c => new NetTopologySuite.Geometries.Coordinate(c[0].GetDouble(), c[1].GetDouble())).ToArray();
            var inside = F.CreatePolygon(ring).InteriorPoint;
            var a = new Address { City = "Thành phố Hồ Chí Minh", District = "Quận Gò Vấp", Ward = "Phường 13" };
            a.SyncNewUnits(F.CreatePoint(inside.Coordinate));
            Assert.Equal(code, a.NewWardCode);
        }
    }
}
