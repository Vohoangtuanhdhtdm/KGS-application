using kgs_api.Domain.Entity;
using kgs_api.Domain.Rules;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;

namespace kgs_api.Tests;

/// <summary>Gần khớp theo giá: tin vượt trần ngân sách không quá 10%, mọi điều kiện khác khớp đủ.</summary>
public class NearMatchTests
{
    private static readonly PublicListingSearchQuery Base = new(
        Type: null, City: null, District: null, PriceMin: null, PriceMax: null,
        BedroomsMin: null, Keyword: null, Latitude: null, Longitude: null,
        RadiusMeters: null, TotalCostMax: null, PetsAllowed: null, CurfewFree: null,
        SharedWithOwner: null, AvailableBy: null, Amenities: null, SortBy: null);

    [Fact]
    public void Relax_Noi10PhanTram()
    {
        var r = NearMatch.Relax(Base with { PriceMax = 5_000_000, TotalCostMax = 6_000_000 })!;
        Assert.Equal(5_500_000m, r.PriceMax);
        Assert.Equal(6_600_000m, r.TotalCostMax);
    }

    [Fact]
    public void Relax_ChiNoiTranCoMat()
    {
        var r = NearMatch.Relax(Base with { PriceMax = 3_000_000 })!;
        Assert.Equal(3_300_000m, r.PriceMax);
        Assert.Null(r.TotalCostMax);
    }

    [Fact]
    public void KhongCoTranGia_KhongCoBanNoi() => Assert.Null(NearMatch.Relax(Base));

    [Fact]
    public void OverBudget_LamTronLen() => Assert.Equal(6, NearMatch.OverBudgetPercent(5_300_000, 5_000_000));

    [Fact]
    public void OverBudget_KhongVuot_La0() => Assert.Equal(0, NearMatch.OverBudgetPercent(4_900_000, 5_000_000));

    [Fact]
    public void OverBudget_NganSach0_La0() => Assert.Equal(0, NearMatch.OverBudgetPercent(4_900_000, 0));

    [Fact]
    public void MonthlyCost_CongCacPhiCoDinh()
    {
        var l = new Listing
        {
            Price = 5_000_000,
            Terms = new ListingTerms { ServiceFee = 200_000, ParkingFee = 100_000, InternetFee = null },
        };
        Assert.Equal(5_300_000m, NearMatch.MonthlyCost(l));
    }
}
