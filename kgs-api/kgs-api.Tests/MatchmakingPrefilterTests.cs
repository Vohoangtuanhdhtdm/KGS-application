using kgs_api.Dtos;
using kgs_api.Services;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Lọc sơ trong bộ nhớ trước khi chạy truy vấn khớp: bỏ ngay nhu cầu khác loại tin hoặc
/// khác tỉnh/thành, nhưng không được bỏ nhầm nhu cầu khớp thật.</summary>
public class MatchmakingPrefilterTests
{
    private const string Hcm = "Thành phố Hồ Chí Minh";

    private static readonly PublicListingSearchQuery Base = new(
        Type: null, City: null, District: null, PriceMin: null, PriceMax: null,
        BedroomsMin: null, Keyword: null, Latitude: null, Longitude: null,
        RadiusMeters: null, TotalCostMax: null, PetsAllowed: null, CurfewFree: null,
        SharedWithOwner: null, AvailableBy: null, Amenities: null, SortBy: null);

    [Fact]
    public void KhacLoaiTin_Loai()
        => Assert.False(MatchmakingService.PassesPrefilter(Base with { Type = ListingType.Sale }, ListingType.Rent, Hcm));

    [Fact]
    public void CungLoaiKhacTinh_Loai()
        => Assert.False(MatchmakingService.PassesPrefilter(
            Base with { Type = ListingType.Rent, City = "Thành phố Hà Nội" }, ListingType.Rent, Hcm));

    [Fact]
    public void KhongGhiLoaiVaTinh_Giu()
        => Assert.True(MatchmakingService.PassesPrefilter(Base, ListingType.Rent, Hcm));

    [Fact]
    public void TenTinhVietTat_VanKhop()
        => Assert.True(MatchmakingService.PassesPrefilter(
            Base with { Type = ListingType.Rent, City = "TP. HCM" }, ListingType.Rent, Hcm));
}
