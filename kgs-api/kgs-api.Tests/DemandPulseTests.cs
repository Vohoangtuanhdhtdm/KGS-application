using kgs_api.Domain.Rules;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Nhịp cầu là con số công khai: đếm NGƯỜI chứ không đếm bộ lọc, và ẩn mọi nhóm dưới
/// 3 người để không ai đoán ra được một người cụ thể đang tìm gì.</summary>
public class DemandPulseTests
{
    private const string Hcm = "Thành phố Hồ Chí Minh";
    private const string Bt = "Quận Bình Thạnh";

    private static PulseInput P(string user, string? district = Bt, decimal? budget = null,
        ListingType? type = ListingType.Rent, string? city = Hcm)
        => new(user, type, city, district, budget);

    private static PulseGroup? Find(IReadOnlyList<PulseGroup> groups, ListingType? type, string? district)
        => groups.SingleOrDefault(g => g.Type == type && g.City == Hcm && g.District == district);

    [Fact]
    public void MotNguoiNhieuBoLoc_DemMotLan()
    {
        var groups = DemandPulse.Compute(new[] { P("a"), P("a"), P("a"), P("b"), P("c") });
        Assert.Equal(3, Find(groups, ListingType.Rent, Bt)!.People);
    }

    [Fact]
    public void DuoiBaNguoi_AnNhom()
    {
        var groups = DemandPulse.Compute(new[] { P("a"), P("b") });
        Assert.Empty(groups);
    }

    [Fact]
    public void KhongGhiQuan_ChiVaoCapTinh()
    {
        var groups = DemandPulse.Compute(new[] { P("a", null), P("b", null), P("c", null) });
        Assert.Equal(3, Find(groups, ListingType.Rent, null)!.People);
        Assert.DoesNotContain(groups, g => g.District != null);
    }

    [Fact]
    public void KhongGhiLoai_ChiVaoNhomMoiLoai()
    {
        var groups = DemandPulse.Compute(new[] { P("a", type: null), P("b", type: null), P("c", type: null) });
        Assert.Equal(3, Find(groups, null, Bt)!.People);
        Assert.DoesNotContain(groups, g => g.Type != null);
    }

    [Fact]
    public void KhongGhiTinh_BiBoQua()
        => Assert.Empty(DemandPulse.Compute(new[] { P("a", city: null), P("b", city: null), P("c", city: null) }));

    [Fact]
    public void KhoangGiaThue()
    {
        Assert.Equal(0, DemandPulse.BandIndex(ListingType.Rent, 3_000_000));
        Assert.Equal(1, DemandPulse.BandIndex(ListingType.Rent, 5_000_000));
        Assert.Equal(2, DemandPulse.BandIndex(ListingType.Rent, 5_500_000));
        Assert.Equal(4, DemandPulse.BandIndex(ListingType.Rent, 25_000_000));
    }

    [Fact]
    public void KhoangGiaMua()
    {
        Assert.Equal(0, DemandPulse.BandIndex(ListingType.Sale, 2_000_000_000));
        Assert.Equal(3, DemandPulse.BandIndex(ListingType.Sale, 11_000_000_000));
    }

    [Fact]
    public void KhoangDuNguoi_HienNhanDung()
    {
        var groups = DemandPulse.Compute(new[]
        {
            P("a", budget: 4_000_000), P("b", budget: 4_500_000), P("c", budget: 5_000_000), P("d", budget: 8_000_000),
        });
        var band = Assert.Single(Find(groups, ListingType.Rent, Bt)!.Bands);
        Assert.Equal("3–5 triệu", band.Label);
        Assert.Equal(3, band.People);
    }

    [Fact]
    public void KhongTranGia_ChiVaoTong()
    {
        var g = Find(DemandPulse.Compute(new[] { P("a"), P("b"), P("c") }), ListingType.Rent, Bt)!;
        Assert.Equal(3, g.People);
        Assert.Empty(g.Bands);
    }

    [Fact]
    public void KhoangDuoiBaNguoi_BiAn()
    {
        var g = Find(DemandPulse.Compute(new[]
        {
            P("a", budget: 4_000_000), P("b", budget: 4_000_000), P("c", budget: 8_000_000),
        }), ListingType.Rent, Bt)!;
        Assert.Equal(3, g.People);
        Assert.Empty(g.Bands);
    }
}
