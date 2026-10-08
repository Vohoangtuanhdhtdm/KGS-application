using kgs_api.Domain.Rules;

namespace kgs_api.Tests;

/// <summary>Kiểm thử lưới giá/m² của bản đồ tìm nhà.</summary>
public class PriceGridTests
{
    // Khung quanh trung tâm TP.HCM.
    private const double W = 106.60, S = 10.70, E = 106.80, N = 10.90;

    private static PriceGridPoint P(double lat, double lng, decimal price, double? area = 50)
        => new(lat, lng, price, area);

    [Fact]
    public void TinCungCho_GomVaoMotO_TrungViTheoM2()
    {
        var pts = new[]
        {
            P(10.7760, 106.7010, 5_000_000_000m, 50),  // 100 tr/m²
            P(10.7761, 106.7011, 6_000_000_000m, 50),  // 120 tr/m²
            P(10.7762, 106.7012, 14_000_000_000m, 50), // 280 tr/m² — tin lạc không kéo lệch trung vị
        };
        var r = PriceGrid.Build(pts, W, S, E, N, zoom: 12);

        var cell = Assert.Single(r.Cells);
        Assert.Equal(3, cell.Count);
        Assert.Equal(120_000_000, cell.MedianPricePerM2!.Value, 3);
        Assert.Equal(5_000_000_000m, cell.MinPrice);
        Assert.True(cell.West <= 106.7010 && cell.East >= 106.7012);
        Assert.True(cell.South <= 10.7760 && cell.North >= 10.7762);
    }

    [Fact]
    public void PhongGan_ThiO_NhoHon_TachRaNhieuO()
    {
        var pts = new[] { P(10.776, 106.71, 1m), P(10.790, 106.73, 1m) };   // cách nhau ~2,6 km, cùng một ô ở zoom 9
        Assert.Single(PriceGrid.Build(pts, W, S, E, N, zoom: 9).Cells);
        Assert.Equal(2, PriceGrid.Build(pts, W, S, E, N, zoom: 14).Cells.Count);
    }

    [Fact]
    public void TinNgoaiKhung_KhongVaoO_NhungVanTinhVaoThangMau()
    {
        var pts = Enumerable.Range(1, 9)
            .Select(i => P(10.0 + i * 0.001, 105.0, i * 1_000_000m, 1))   // ngoài khung (Cần Thơ)
            .Append(P(10.776, 106.701, 5_000_000m, 1))
            .ToList();
        var r = PriceGrid.Build(pts, W, S, E, N, zoom: 12);

        Assert.Single(r.Cells);
        Assert.Equal(1, r.TotalInView);
        Assert.Equal(10, r.TotalMatched);
        Assert.Equal(4, r.Breaks.Count);
        Assert.True(r.Breaks.SequenceEqual(r.Breaks.Order()));
    }

    [Fact]
    public void ThieuDienTich_VanDemTin_NhungKhongVaoGiaM2()
    {
        var r = PriceGrid.Build(new[] { P(10.776, 106.701, 1_000m, null), P(10.776, 106.701, 1_000m, 0) },
            W, S, E, N, zoom: 12);
        var cell = Assert.Single(r.Cells);
        Assert.Equal(2, cell.Count);
        Assert.Equal(0, cell.PricedCount);
        Assert.Null(cell.MedianPricePerM2);
    }

    [Fact]
    public void QuaItTin_KhongChiaThangMau()
        => Assert.Empty(PriceGrid.Breaks(new List<double> { 1, 2, 3, 4 }));

    [Fact]
    public void TrungVi_SoChan_LayTrungBinhHaiGiua()
        => Assert.Equal(2.5, PriceGrid.Median(new List<double> { 4, 1, 3, 2 }));
}
