using kgs_api.Domain.Rules;
using kgs_api.Services.Seeding;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Bộ dữ liệu trình diễn phải "sạch" theo đúng chuẩn của hệ thống — nếu không, demo
/// sẽ vấp chính những lỗi mà các bước chuẩn hoá đã sửa (lọc khu vực hụt tin, từ vựng lệch).</summary>
public class ShowcaseCatalogTests
{
    [Fact]
    public void DiaDiem_DungTenHanhChinhChinhThuc()
    {
        foreach (var p in ShowcaseCatalog.Places)
        {
            Assert.Equal(p.City, AdministrativeNames.CanonicalCity(p.City));
            Assert.Equal(p.District, AdministrativeNames.CanonicalDistrict(p.City, p.District));
        }
    }

    [Fact]
    public void MoiLoaiHinh_DeuCoTin()
    {
        var types = ShowcaseCatalog.Specs.Select(s => s.Type)
            .Concat(ShowcaseCatalog.Buildings.Select(b => b.Type)).ToHashSet();
        foreach (var t in Enum.GetValues<AssetDomainType>().Where(t => (int)t is >= 1 and <= 9))
            Assert.Contains(t, types);
        Assert.Contains(ShowcaseCatalog.Specs, s => s.Mode == ListingType.Sale);
        Assert.Contains(ShowcaseCatalog.Specs, s => s.Mode == ListingType.Rent);
    }

    [Fact]
    public void ThamChieu_DeuTonTai()
    {
        var places = ShowcaseCatalog.Places.Select(p => p.Key).ToHashSet();
        Assert.Equal(ShowcaseCatalog.Places.Length, places.Count); // khoá không trùng
        foreach (var s in ShowcaseCatalog.Specs)
        {
            Assert.All(s.Places, k => Assert.Contains(k, places));
            Assert.True(ShowcaseCatalog.ImagePools.ContainsKey(s.Images));
        }
        foreach (var b in ShowcaseCatalog.Buildings)
        {
            Assert.Contains(b.Place, places);
            Assert.True(ShowcaseCatalog.ImagePools.ContainsKey(b.Images));
        }
        var people = ShowcaseCatalog.People.Select(p => p.Key).ToHashSet();
        Assert.All(ShowcaseCatalog.Demands, d => Assert.Contains(d.Person, people));
    }

    [Fact]
    public void NhuCau_DungTuVungChuan()
    {
        foreach (var d in ShowcaseCatalog.Demands)
        {
            Assert.Equal(d.City, AdministrativeNames.CanonicalCity(d.City));
            if (d.District is not null)
                Assert.Equal(d.District, AdministrativeNames.CanonicalDistrict(d.City, d.District));
            Assert.All(d.Legal ?? Array.Empty<string>(), l => Assert.Contains(l, PropertyVocabulary.LegalStatuses));
        }
    }
}
