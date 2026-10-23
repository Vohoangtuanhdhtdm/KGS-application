using kgs_api.Domain.Entity;
using kgs_api.Domain.Rules;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Điều kiện "số người ở": tin khớp khi chủ tin cho ở đủ số người, HOẶC chủ tin không
/// khai số người tối đa — đa số tin bỏ trống ô này, loại hết thì gần như không còn tin nào.</summary>
public class OccupantsFilterTests
{
    private static Listing L(int? maxOccupants) => new()
    {
        Status = ListingStatus.Approved,
        Asset = new Asset(),
        Terms = new ListingTerms { MaxOccupants = maxOccupants },
    };

    private static readonly PublicListingSearchQuery Base = new(
        Type: null, City: null, District: null, PriceMin: null, PriceMax: null,
        BedroomsMin: null, Keyword: null, Latitude: null, Longitude: null,
        RadiusMeters: null, TotalCostMax: null, PetsAllowed: null, CurfewFree: null,
        SharedWithOwner: null, AvailableBy: null, Amenities: null, SortBy: null);

    private static readonly Listing[] Data = { L(null), L(2), L(4) };

    [Fact]
    public void Occupants3_GiuTinKhongGhiVaTinChoPhepDu()
    {
        var hits = ListingSearchFilter.Apply(Data.AsQueryable(), Base with { Occupants = 3 }, null).ToList();
        Assert.Equal(2, hits.Count);
        Assert.Contains(Data[0], hits);
        Assert.Contains(Data[2], hits);
    }

    [Fact]
    public void KhongDatOccupants_KhongLoaiTinNao()
        => Assert.Equal(3, ListingSearchFilter.Apply(Data.AsQueryable(), Base, null).Count());
}
