using kgs_api.Domain.Entity;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Bộ lọc "Có mô hình 3D" phải khớp đúng điều kiện trang tin dùng để hiện toà nhà 3D:
/// mô hình đã công khai VÀ đã có khung.</summary>
public class Has3DFilterTests
{
    private static Listing L(bool published, string? footprint) => new()
    {
        Status = ListingStatus.Approved,
        Asset = new Asset { BuildingModelPublished = published, FootprintJson = footprint },
    };

    private static readonly PublicListingSearchQuery Base = new(
        Type: null, City: null, District: null, PriceMin: null, PriceMax: null,
        BedroomsMin: null, Keyword: null, Latitude: null, Longitude: null,
        RadiusMeters: null, TotalCostMax: null, PetsAllowed: null, CurfewFree: null,
        SharedWithOwner: null, AvailableBy: null, Amenities: null, SortBy: null);

    private static readonly Listing[] Data =
    {
        L(true, "[[0,0],[1,0],[1,1]]"),   // có mô hình, đã công khai
        L(false, "[[0,0],[1,0],[1,1]]"),  // có khung nhưng chủ nhà chưa công khai
        L(true, null),                    // bật công khai nhưng chưa dựng khung
        L(false, null),
    };

    [Fact]
    public void Has3D_ChiLayToaNhaDaCongKhaiVaCoKhung()
    {
        var hits = ListingSearchFilter.Apply(Data.AsQueryable(), Base with { Has3D = true }, null).ToList();
        Assert.Single(hits);
        Assert.Same(Data[0], hits[0]);
    }

    [Fact]
    public void KhongBat_KhongLoaiTinNao()
        => Assert.Equal(4, ListingSearchFilter.Apply(Data.AsQueryable(), Base, null).Count());
}
