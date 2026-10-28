using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;

namespace kgs_api.Tests;

/// <summary>Hạn 30 ngày của chế độ "cho chủ nhà mời tôi": nhu cầu không còn thật thì không làm
/// phiền chủ nhà và không thổi phồng Nhịp cầu.</summary>
public class DemandExpiryTests
{
    private static readonly DateTime Now = new(2026, 10, 23, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void UntilFrom_Them30Ngay() => Assert.Equal(Now.AddDays(30), DemandExpiry.UntilFrom(Now));

    [Fact]
    public void IsOpen_HetHanLaDong()
    {
        Assert.False(DemandExpiry.IsOpen(true, Now.AddMinutes(-1), Now));
        Assert.True(DemandExpiry.IsOpen(true, null, Now));
        Assert.False(DemandExpiry.IsOpen(false, Now.AddDays(5), Now));
    }

    [Fact]
    public void Decide_Con3Ngay_ChuaNhac_LaNhac()
        => Assert.Equal(ExpiryAction.Remind, DemandExpiry.Decide(true, Now.AddDays(3), null, Now));

    [Fact]
    public void Decide_ConNhieuNgay_KhongLamGi()
        => Assert.Equal(ExpiryAction.None, DemandExpiry.Decide(true, Now.AddDays(10), null, Now));

    [Fact]
    public void Decide_DaNhac_KhongNhacLai()
        => Assert.Equal(ExpiryAction.None, DemandExpiry.Decide(true, Now.AddDays(2), Now.AddDays(-1), Now));

    [Fact]
    public void Decide_QuaHan_LaDong()
        => Assert.Equal(ExpiryAction.Close, DemandExpiry.Decide(true, Now, null, Now));

    [Fact]
    public void Decide_TatSan_KhongLamGi()
        => Assert.Equal(ExpiryAction.None, DemandExpiry.Decide(false, Now.AddDays(-1), null, Now));

    private static readonly PublicListingSearchQuery Empty = new(
        Type: null, City: null, District: null, PriceMin: null, PriceMax: null,
        BedroomsMin: null, Keyword: null, Latitude: null, Longitude: null,
        RadiusMeters: null, TotalCostMax: null, PetsAllowed: null, CurfewFree: null,
        SharedWithOwner: null, AvailableBy: null, Amenities: null, SortBy: null);

    /// <summary>Nhu cầu mở cho chủ nhà mà không có khu vực thì khớp MỌI tin cả nước — mọi chủ
    /// nhà đều thấy và được báo, đúng thứ làm phiền mà hạn 30 ngày muốn tránh.</summary>
    [Fact]
    public void KhongCoKhuVuc_KhongMoChoChuNhaDuoc()
    {
        Assert.False(DemandExpiry.HasArea(Empty with { Type = kgs_api.Domain.Enums.ListingType.Rent }));
        Assert.True(DemandExpiry.HasArea(Empty with { City = "Thành phố Hồ Chí Minh" }));
        Assert.True(DemandExpiry.HasArea(Empty with { NewProvinceCode = "79" }));
        Assert.True(DemandExpiry.HasArea(Empty with { Latitude = 10.8, Longitude = 106.7, RadiusMeters = 3000 }));
        Assert.False(DemandExpiry.HasArea(Empty with { City = "  " }));
    }

    [Fact]
    public void OpenAt_BoQuaChuaDuyet()
    {
        var data = new[]
        {
            new SavedSearch { DiscoverableByOwners = true, DiscoverableUntil = Now.AddDays(3) },
            new SavedSearch { DiscoverableByOwners = true, DiscoverableUntil = Now.AddDays(3), DemandReview = kgs_api.Domain.Enums.DemandReviewStatus.Pending },
            new SavedSearch { DiscoverableByOwners = true, DiscoverableUntil = Now.AddDays(3), DemandReview = kgs_api.Domain.Enums.DemandReviewStatus.Rejected },
        };
        Assert.Single(data.AsQueryable().Where(DemandExpiry.OpenAt(Now)));
    }

    [Fact]
    public void OpenAt_LocDungTrenDanhSach()
    {
        var data = new[]
        {
            new SavedSearch { DiscoverableByOwners = true, DiscoverableUntil = Now.AddDays(3) },
            new SavedSearch { DiscoverableByOwners = true, DiscoverableUntil = Now.AddDays(-1) },
            new SavedSearch { DiscoverableByOwners = false, DiscoverableUntil = null },
        };
        var open = data.AsQueryable().Where(DemandExpiry.OpenAt(Now)).ToList();
        Assert.Single(open);
        Assert.Same(data[0], open[0]);
    }
}
