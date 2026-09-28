using kgs_api.Domain.Rules;
using NetTopologySuite;
using NetTopologySuite.Geometries;

namespace kgs_api.Tests;

/// <summary>Kiểm thử bộ đọc vùng "đi tới được trong X phút" gửi từ trang tìm kiếm.</summary>
public class TravelAreaTests
{
    private static readonly GeometryFactory Factory =
        NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326);

    // Tam giác quanh trung tâm Quận 1, chưa khép kín — phía trình duyệt không bắt buộc khép.
    private const string Triangle = "106.69,10.77;106.71,10.77;106.70,10.79";

    [Fact]
    public void KhongCoVung_ThiKhongLoc()
    {
        Assert.True(TravelArea.TryParse(null, Factory, out var area, out _));
        Assert.Null(area);
        Assert.True(TravelArea.TryParse("  ", Factory, out area, out _));
        Assert.Null(area);
    }

    [Fact]
    public void VungHopLe_TuKhepKin_VaChuaDiemBenTrong()
    {
        Assert.True(TravelArea.TryParse(Triangle, Factory, out var area, out _));
        Assert.NotNull(area);
        Assert.Equal(4326, area!.SRID);
        Assert.True(area.Contains(Factory.CreatePoint(new Coordinate(106.70, 10.775))));
        Assert.False(area.Contains(Factory.CreatePoint(new Coordinate(106.75, 10.80))));
    }

    [Theory]
    [InlineData("106.69,10.77;106.71,10.77")]            // chỉ hai điểm
    [InlineData("106.69,10.77;abc,10.77;106.70,10.79")]   // không phải số
    [InlineData("106.69,10.77;106.71;106.70,10.79")]      // thiếu vĩ độ
    [InlineData("200,10.77;106.71,10.77;106.70,10.79")]   // kinh độ ngoài phạm vi
    public void VungHong_ThiBaoLoi(string raw)
    {
        Assert.False(TravelArea.TryParse(raw, Factory, out var area, out var error));
        Assert.Null(area);
        Assert.False(string.IsNullOrEmpty(error));
    }

    [Fact]
    public void QuaNhieuDiem_ThiBaoLoi()
    {
        var pts = Enumerable.Range(0, TravelArea.MaxPoints + 1)
            .Select(i =>
            {
                var a = i * 2 * Math.PI / (TravelArea.MaxPoints + 1);
                return FormattableString.Invariant($"{106.7 + 0.01 * Math.Cos(a)},{10.77 + 0.01 * Math.Sin(a)}");
            });
        Assert.False(TravelArea.TryParse(string.Join(';', pts), Factory, out _, out _));
    }

    [Fact]
    public void DaGiacTuCat_DuocSuaThayViTuChoi()
    {
        // Hình "nơ bướm": hai cạnh cắt nhau — kiểu lỗi làm gọn đa giác có thể sinh ra.
        const string bowtie = "106.69,10.77;106.71,10.79;106.71,10.77;106.69,10.79";
        Assert.True(TravelArea.TryParse(bowtie, Factory, out var area, out _));
        Assert.NotNull(area);
        Assert.True(area!.IsValid);
    }
}
