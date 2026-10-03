using kgs_api.Services;
using static kgs_api.Common.Common;

namespace kgs_api.Tests;

/// <summary>Khung toà nhà phải là một đa giác hợp lý trước khi lưu.</summary>
public class BuildingModelTests
{
    // Hình chữ nhật ~26 m × 16 m ở TP.HCM.
    private static List<double[]> Rect(double w, double d)
    {
        const double lat = 10.8, lng = 106.7, m = 111_320.0;
        var kx = m * Math.Cos(lat * Math.PI / 180);
        return new()
        {
            new[] { lng, lat }, new[] { lng + w / kx, lat },
            new[] { lng + w / kx, lat + d / m }, new[] { lng, lat + d / m },
        };
    }

    [Fact]
    public void KhungHopLy_DuocNhan()
        => BuildingModelService.ValidateFootprint(Rect(26, 16));

    [Fact]
    public void ItHon3Diem_BiTuChoi()
        => Assert.Throws<ValidationFailedException>(() =>
            BuildingModelService.ValidateFootprint(Rect(26, 16).Take(2).ToList()));

    [Theory]
    [InlineData(2, 2)]       // 4 m² — bấm nhầm một điểm
    [InlineData(600, 600)]   // 36 ha — chọn nhầm cả một khu
    public void DienTichVoLy_BiTuChoi(double w, double d)
        => Assert.Throws<ValidationFailedException>(() => BuildingModelService.ValidateFootprint(Rect(w, d)));

    [Fact]
    public void ToaDoSai_BiTuChoi()
    {
        var r = Rect(26, 16);
        r[1] = new[] { 200.0, 10.8 };
        Assert.Throws<ValidationFailedException>(() => BuildingModelService.ValidateFootprint(r));
    }
}
