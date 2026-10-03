using kgs_api.Domain.Rules;

namespace kgs_api.Tests;

/// <summary>Mọi cách viết tên tỉnh/quận phải quy về đúng một tên chính thức.</summary>
public class AdministrativeNamesTests
{
    [Theory]
    [InlineData("TP. Hồ Chí Minh")]
    [InlineData("Thành phố Hồ Chí Minh")]
    [InlineData("Hồ Chí Minh")]
    [InlineData("tp hcm")]
    [InlineData("TPHCM")]
    [InlineData("Sài Gòn")]
    public void ThanhPhoHoChiMinh(string raw)
        => Assert.Equal("Thành phố Hồ Chí Minh", AdministrativeNames.CanonicalCity(raw));

    [Fact]
    public void Tinh_ThemTienToChinhThuc()
        => Assert.Equal("Tỉnh Bình Dương", AdministrativeNames.CanonicalCity("Bình Dương"));

    [Theory]
    [InlineData("TP. Thủ Đức", "Thành phố Thủ Đức")]
    [InlineData("TP. Thủ Đức (Q2 cũ)", "Thành phố Thủ Đức")]
    [InlineData("Thủ Đức", "Thành phố Thủ Đức")]
    [InlineData("Q.3", "Quận 3")]
    [InlineData("q3", "Quận 3")]
    [InlineData("quận 3", "Quận 3")]
    [InlineData("Bình Thạnh", "Quận Bình Thạnh")]
    [InlineData("huyện củ chi", "Huyện Củ Chi")]
    public void QuanHuyen_TrongThanhPho(string raw, string expected)
        => Assert.Equal(expected, AdministrativeNames.CanonicalDistrict("Thành phố Hồ Chí Minh", raw));

    [Fact]
    public void Quan3_KhongNhamVoiTenKhacCoSo3()
        // "Quận 3" của TP.HCM — không được tra ra quận khác chỉ vì cùng con số.
        => Assert.Equal("Quận 3", AdministrativeNames.CanonicalDistrict("Thành phố Hồ Chí Minh", "Quận 3"));

    [Fact]
    public void ChuaBietTinh_ChiNhanKhiTenQuanLaDuyNhat()
    {
        // "Hoàn Kiếm" là tên duy nhất trên cả nước — không cần biết tỉnh vẫn tra ra được.
        Assert.Equal("Quận Hoàn Kiếm", AdministrativeNames.CanonicalDistrict(null, "Hoàn Kiếm"));
        // "Châu Thành" là huyện ở nhiều tỉnh, nhưng tên chính thức giống hệt nhau ở mọi nơi —
        // thêm tiền tố là đúng, không có chuyện chọn nhầm sang một nơi mang tên khác.
        Assert.Equal("Huyện Châu Thành", AdministrativeNames.CanonicalDistrict(null, "Châu Thành"));
    }

    [Fact]
    public void TenLa_GiuNguyen()
    {
        Assert.Equal("Atlantis", AdministrativeNames.CanonicalCity("  Atlantis "));
        Assert.Equal("Phố Cổ Xưa", AdministrativeNames.CanonicalDistrict("Thành phố Hồ Chí Minh", "Phố Cổ Xưa"));
        Assert.Null(AdministrativeNames.CanonicalCity(null));
    }
}
