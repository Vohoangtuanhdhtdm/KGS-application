using System.Text.Json;
using kgs_api.Domain.Rules;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using kgs_api.Services;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Kiểm thử phần thuần của bộ lọc đã lưu.
///
/// Việc lọc thật sự nằm trong biểu thức IQueryable nên phải có database mới chạy được.
/// Nhưng hai thứ dễ hỏng nhất lại không cần: chuẩn hoá tiện nghi (quyết định tin nào
/// khớp) và đọc lại JSON đã cất (quyết định bộ lọc hỏng có làm sập cả job hay không).</summary>
public class SavedSearchTests
{
    // ==================== Chuẩn hoá tiện nghi ====================

    [Fact]
    public void NormalizeAmenities_Null_TraVeRong()
        => Assert.Empty(ListingSearchFilter.NormalizeAmenities(null));

    [Fact]
    public void NormalizeAmenities_LoaiKhoaLa_KhongNemLoi()
    {
        var valid = AmenityKeys.All.First();

        var result = ListingSearchFilter.NormalizeAmenities(
            new[] { valid, "khoa_khong_ton_tai", "" });

        Assert.Equal(new[] { valid }, result);
    }

    [Fact]
    public void NormalizeAmenities_BoTrungVaSapXepCoDinh()
    {
        var keys = AmenityKeys.All.Take(3).ToArray();
        Assert.True(keys.Length == 3, "Cần ít nhất 3 khoá tiện nghi để kiểm thử.");

        // Hai bộ lọc cùng nội dung nhưng người dùng chọn theo thứ tự khác nhau phải cho
        // ra cùng một danh sách — nếu không, JSON cất đi sẽ khác nhau dù bộ lọc là một.
        var a = ListingSearchFilter.NormalizeAmenities(new[] { keys[2], keys[0], keys[1] });
        var b = ListingSearchFilter.NormalizeAmenities(new[] { keys[0], keys[1], keys[2], keys[0] });

        Assert.Equal(a, b);
        Assert.Equal(3, a.Count);
    }

    // ==================== Có tìm theo bán kính hay không ====================

    [Theory]
    // lat, lng, radius, mong đợi — thiếu bất kỳ mảnh nào thì không tìm theo bán kính được.
    [InlineData(null, null, null, false)]
    [InlineData(10.77, 106.70, null, false)]
    [InlineData(10.77, null, 5000.0, false)]
    [InlineData(null, 106.70, 5000.0, false)]
    [InlineData(10.77, 106.70, 5000.0, true)]
    public void HasGeoSearch_ChiDungKhiDuCaBaManh(
        double? lat, double? lng, double? radius, bool expected)
    {
        var q = Criteria() with { Latitude = lat, Longitude = lng, RadiusMeters = radius };
        Assert.Equal(expected, ListingSearchFilter.HasGeoSearch(q));
    }

    // ==================== Đọc lại tiêu chí đã cất ====================

    [Fact]
    public void Deserialize_GiuNguyenTieuChi()
    {
        var original = Criteria() with
        {
            Type = ListingType.Rent,
            District = "Quận 1",
            PriceMax = 8_000_000m,
            PetsAllowed = true
        };

        var back = SavedSearchService.Deserialize(JsonSerializer.Serialize(original));

        Assert.Equal(ListingType.Rent, back.Type);
        Assert.Equal("Quận 1", back.District);
        Assert.Equal(8_000_000m, back.PriceMax);
        Assert.True(back.PetsAllowed);
    }

    [Fact]
    public void Deserialize_PhanBietChuaKhaiVoiKhaiLaKhong()
    {
        // null (chưa khai) và false (đã khai là không) là hai bộ lọc khác nhau. Nếu vòng
        // JSON làm lẫn hai thứ này, người dùng lọc "không nuôi thú cưng" sẽ nhận cả tin
        // chưa khai gì, hoặc ngược lại.
        var chuaKhai = SavedSearchService.Deserialize(
            JsonSerializer.Serialize(Criteria() with { PetsAllowed = null }));
        var khaiLaKhong = SavedSearchService.Deserialize(
            JsonSerializer.Serialize(Criteria() with { PetsAllowed = false }));

        Assert.Null(chuaKhai.PetsAllowed);
        Assert.False(khaiLaKhong.PetsAllowed);
    }

    [Theory]
    [InlineData("{ khong phai json }")]
    [InlineData("")]
    [InlineData("[1, 2, 3]")]
    public void Deserialize_JsonHong_LuiVeBoLocRong_KhongNemLoi(string json)
    {
        // Một bản ghi hỏng không được phép làm sập cả danh sách bộ lọc lẫn job đối chiếu
        // của mọi người dùng khác.
        var result = SavedSearchService.Deserialize(json);

        Assert.Null(result.Type);
        Assert.Null(result.District);
        Assert.Null(result.PriceMax);
    }

    private static PublicListingSearchQuery Criteria() => new(
        Type: null, City: null, District: null, PriceMin: null, PriceMax: null,
        BedroomsMin: null, Keyword: null, Latitude: null, Longitude: null,
        RadiusMeters: null, TotalCostMax: null, PetsAllowed: null, CurfewFree: null,
        SharedWithOwner: null, AvailableBy: null, Amenities: null, SortBy: null);
}
