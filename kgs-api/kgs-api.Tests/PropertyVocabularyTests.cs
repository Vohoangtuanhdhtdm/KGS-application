using kgs_api.Domain.Rules;

namespace kgs_api.Tests;

/// <summary>Bộ chuẩn hoá hướng / pháp lý / nội thất — bộ lọc so khớp đúng trên các giá trị này.</summary>
public class PropertyVocabularyTests
{
    [Theory]
    [InlineData("Đầy đủ nội thất", "Đầy đủ")]
    [InlineData("full nội thất", "Đầy đủ")]
    [InlineData("Nội thất cơ bản", "Cơ bản")]
    [InlineData("Không có nội thất", "Không nội thất")]
    [InlineData("bàn giao thô", "Không nội thất")]
    // "thô" phải khớp theo TỪ: "thoáng mát" chứa chuỗi "tho" nhưng không có nghĩa là thô.
    [InlineData("Đầy đủ, thoáng mát", "Đầy đủ")]
    public void NoiThat(string raw, string expected)
        => Assert.Equal(expected, PropertyVocabulary.NormalizeFurniture(raw));

    [Theory]
    [InlineData("đông nam", "Đông Nam")]
    [InlineData("Hướng Tây Bắc", "Tây Bắc")]
    [InlineData("DN", "Đông Nam")]
    [InlineData("Nam", "Nam")]
    public void Huong(string raw, string expected)
        => Assert.Equal(expected, PropertyVocabulary.NormalizeDirection(raw));

    [Theory]
    [InlineData("Sổ hồng riêng", "Sổ hồng riêng")]
    [InlineData("so hong chung", "Sổ hồng chung")]
    [InlineData("Có sổ đỏ", "Sổ đỏ")]
    [InlineData("đang chờ sổ", "Đang chờ sổ")]
    public void PhapLy(string raw, string expected)
        => Assert.Equal(expected, PropertyVocabulary.NormalizeLegal(raw));

    [Fact]
    public void GiaTriLa_GiuNguyen_TrongKhiBoLocBoQua()
    {
        Assert.Equal("Hợp đồng thuê dài hạn", PropertyVocabulary.NormalizeLegal("Hợp đồng thuê dài hạn"));
        Assert.Null(PropertyVocabulary.NormalizeFilter(
            new[] { "Hợp đồng thuê dài hạn" }, PropertyVocabulary.NormalizeLegal, PropertyVocabulary.LegalStatuses));
    }

    [Fact]
    public void BoLoc_BoTrung_VaSapCoDinh()
        => Assert.Equal(
            new[] { "Đông", "Đông Nam" },
            PropertyVocabulary.NormalizeFilter(
                new[] { "đông nam", "Đông", "DN" }, PropertyVocabulary.NormalizeDirection, PropertyVocabulary.Directions));

    [Fact]
    public void Rong_LaNull()
    {
        Assert.Null(PropertyVocabulary.NormalizeFurniture("   "));
        Assert.Null(PropertyVocabulary.NormalizeDirection(null));
    }
}
