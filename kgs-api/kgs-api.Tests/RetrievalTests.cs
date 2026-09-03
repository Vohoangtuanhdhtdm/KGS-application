using kgs_api.Interfaces;
using kgs_api.Services;

namespace kgs_api.Tests;

/// <summary>Kiểm thử hai hàm thuần của tầng truy hồi.
///
/// Cả hai đều không chạm CSDL nên test chạy trong vài mili giây. Phần truy vấn SQL cần
/// test tích hợp có database — thuộc loại khác, chưa làm.</summary>
public class RetrievalTests
{
    private static RetrievalHit Hit(string name)
        => new(DeterministicId(name), name, name, 0m, 0, null, null);

    /// <summary>Guid ổn định theo tên để test đọc được, không phụ thuộc thứ tự chạy.</summary>
    private static Guid DeterministicId(string name)
    {
        var bytes = new byte[16];
        var src = System.Text.Encoding.UTF8.GetBytes(name);
        Array.Copy(src, bytes, Math.Min(src.Length, 16));
        return new Guid(bytes);
    }

    // ---------- Bỏ dấu tiếng Việt ----------
    // Cột SearchVector đã bỏ dấu phía PostgreSQL bằng f_unaccent. Hàm C# này phải cho ra
    // KẾT QUẢ TƯƠNG ĐƯƠNG, nếu không câu truy vấn sẽ không bao giờ khớp được với dữ liệu.

    [Theory]
    [InlineData("phòng trọ quận 7", "phong tro quan 7")]
    [InlineData("Yên tĩnh để làm việc", "Yen tinh de lam viec")]
    [InlineData("cho nuôi thú cưng", "cho nuoi thu cung")]
    [InlineData("gác lửng, ban công", "gac lung, ban cong")]
    [InlineData("Đường Điện Biên Phủ", "Duong Dien Bien Phu")]
    public void BoDau_ChuyenDungTiengViet(string input, string expected)
    {
        Assert.Equal(expected, ListingRetrievalService.Unaccent(input));
    }

    [Fact]
    public void BoDau_GiuNguyenChuoiKhongDau()
    {
        Assert.Equal("phong tro 25m2", ListingRetrievalService.Unaccent("phong tro 25m2"));
    }

    [Fact]
    public void BoDau_XuLyDuocCaChuD_HoaVaThuong()
    {
        Assert.Equal("Da Nang - dong", ListingRetrievalService.Unaccent("Đà Nẵng - đông"));
    }

    // ---------- Reciprocal Rank Fusion ----------

    [Fact]
    public void Rrf_TinXuatHienOCaHaiNhanh_DuocXepTren()
    {
        var chung = Hit("chung");

        // "chung" đứng hạng 2 ở cả hai nhánh; "kwTop" đứng nhất nhưng chỉ ở một nhánh.
        var keyword = new[] { Hit("kwTop"), chung };
        var vector = new[] { Hit("vecTop"), chung };

        var fused = ListingRetrievalService.FuseRrf(keyword, vector, 10);

        Assert.Equal(chung.ListingId, fused[0].ListingId);
    }

    [Fact]
    public void Rrf_GhiLaiHangCuaTungNhanh()
    {
        var chung = Hit("chung");
        var fused = ListingRetrievalService.FuseRrf(
            new[] { Hit("a"), chung },
            new[] { chung },
            10);

        var row = fused.Single(h => h.ListingId == chung.ListingId);
        Assert.Equal(2, row.KeywordRank);
        Assert.Equal(1, row.VectorRank);
    }

    [Fact]
    public void Rrf_TinChiCoOMotNhanh_VanDuocGiuLai()
    {
        var fused = ListingRetrievalService.FuseRrf(
            new[] { Hit("chiCoTuKhoa") },
            new[] { Hit("chiCoVector") },
            10);

        Assert.Equal(2, fused.Count);
        Assert.Contains(fused, h => h.KeywordRank == 1 && h.VectorRank is null);
        Assert.Contains(fused, h => h.VectorRank == 1 && h.KeywordRank is null);
    }

    [Fact]
    public void Rrf_TonTrongGioiHan()
    {
        var keyword = Enumerable.Range(0, 30).Select(i => Hit($"k{i}")).ToArray();
        var vector = Enumerable.Range(0, 30).Select(i => Hit($"v{i}")).ToArray();

        Assert.Equal(5, ListingRetrievalService.FuseRrf(keyword, vector, 5).Count);
    }

    [Fact]
    public void Rrf_MotNhanhRong_TraVeDungNhanhConLai()
    {
        var keyword = new[] { Hit("a"), Hit("b") };

        var fused = ListingRetrievalService.FuseRrf(keyword, Array.Empty<RetrievalHit>(), 10);

        Assert.Equal(2, fused.Count);
        Assert.Equal(keyword[0].ListingId, fused[0].ListingId);
        Assert.All(fused, h => Assert.Null(h.VectorRank));
    }

    [Fact]
    public void Rrf_HaiNhanhRong_TraVeRong()
    {
        Assert.Empty(ListingRetrievalService.FuseRrf(
            Array.Empty<RetrievalHit>(), Array.Empty<RetrievalHit>(), 10));
    }
}
