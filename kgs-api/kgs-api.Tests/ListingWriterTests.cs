using kgs_api.Services.Assistant;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Trợ lý viết tin chỉ được thấy những gì người đăng nhập — và đầu ra phải sạch.</summary>
public class ListingWriterTests
{
    private static ListingWriterRequest Req(ListingType type) => new(
        type, AssetDomainType.Room, "Thành phố Hồ Chí Minh", "Quận Bình Thạnh", "Phường 25", null,
        25, null, null, null, null, null, "Sổ hồng", "Cơ bản", 4_500_000,
        ["Máy lạnh"], ["Yên tĩnh"], null);

    [Fact]
    public void Facts_TinThue_KhongGuiPhapLy()
    {
        var facts = ListingWriterService.Facts(Req(ListingType.Rent));
        Assert.DoesNotContain("pháp lý", facts);
        Assert.Contains("diện tích m²: 25", facts);
        Assert.Contains("điểm nổi bật: Yên tĩnh", facts);
    }

    [Fact]
    public void Facts_TinBan_CoPhapLy_VaBoTruongTrong()
    {
        var facts = ListingWriterService.Facts(Req(ListingType.Sale));
        Assert.Contains("pháp lý: Sổ hồng", facts);
        Assert.DoesNotContain("phòng ngủ", facts);
        Assert.DoesNotContain("ghi chú", facts);
    }

    [Fact]
    public void Clean_BoMarkdownEmoji_GiuDoan()
    {
        var s = ListingWriterService.Clean("**Phòng đẹp** \U0001F3E0\r\n\r\n\r\n# Gần chợ 300m", singleLine: false);
        Assert.Equal("Phòng đẹp\n\nGần chợ 300m", s);
        Assert.Equal("Phòng trọ 25m² Bình Thạnh",
            ListingWriterService.Clean("\"Phòng trọ  25m²\n Bình Thạnh\"", singleLine: true));
    }
}
