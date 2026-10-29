using kgs_api.Domain.Rules;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Bộ lọc tự động của "Đăng nhu cầu": nhu cầu sạch được duyệt ngay, nhu cầu có dấu hiệu
/// spam vào hàng đợi quản trị. Bắt nhầm nhu cầu sạch thì người tìm phải chờ oan.</summary>
public class DemandScreeningTests
{
    private static IReadOnlyList<string> S(string? note, string name = "Phòng trọ Bình Thạnh",
        bool confirmed = true, int opened = 0) => DemandScreening.Screen(name, note, confirmed, opened);

    [Fact]
    public void LoiNhanBinhThuong_Sach() => Assert.Empty(S("2 người đi làm Quận 1, dọn vào đầu tháng"));

    [Fact]
    public void KhongLoiNhan_Sach() => Assert.Empty(S(null));

    [Fact]
    public void LienKet_BiGiu() => Assert.Contains("Lời nhắn có đường liên kết", S("xem thêm tại abc.vn"));

    [Fact]
    public void LienKetHttp_BiGiu() => Assert.Contains("Lời nhắn có đường liên kết", S("https://bit.ly/x"));

    [Fact]
    public void SoDienThoai_BiGiu() => Assert.Contains("Lời nhắn có số điện thoại", S("gọi 0901234567"));

    [Fact]
    public void SoDienThoai_CoDauCach_VanBat()
        => Assert.Contains("Lời nhắn có số điện thoại", S("0 9 0 1 . 2 3 4 . 5 6 7"));

    [Fact]
    public void SoDienThoai_DauSo84_VanBat() => Assert.Contains("Lời nhắn có số điện thoại", S("+84 901 234 567"));

    [Fact]
    public void SoTien_KhongPhaiSoDienThoai() => Assert.Empty(S("dưới 5.000.000, tối đa 4,5 triệu, cọc 10.000.000"));

    [Fact]
    public void Email_BiGiu() => Assert.Contains("Lời nhắn có địa chỉ email", S("mail cho mình: an@gmail.com"));

    [Fact]
    public void KenhRieng_KhongPhanBietHoaThuongVaDau() => Assert.Contains("Lời nhắn có kênh liên lạc riêng", S("liên hệ ZALO nhé"));

    [Fact]
    public void RaoVat_BiGiu() => Assert.Contains("Lời nhắn giống tin rao vặt", S("Môi giới nhà đất uy tín"));

    [Fact]
    public void ChuaXacThucEmail_BiGiu() => Assert.Contains("Tài khoản chưa xác thực email", S(null, confirmed: false));

    [Fact]
    public void DangDay_TuCaiThuTu()
    {
        Assert.Contains("Đăng nhiều nhu cầu trong thời gian ngắn", S(null, opened: 3));
        Assert.Empty(S(null, opened: 2));
    }

    [Fact]
    public void KiemTraCaTen() => Assert.Contains("Lời nhắn có số điện thoại", S(null, name: "Phòng 0901234567"));

    [Fact]
    public void NhieuDauHieu_KhongLapLyDo()
        => Assert.Single(S("gọi 0901234567 hoặc 0912345678"));

    [Fact]
    public void NeedsRescreen_KhacNoiDung() => Assert.True(DemandScreening.NeedsRescreen("a", "a 0901234567"));

    [Fact]
    public void NeedsRescreen_ChiKhacKhoangTrang() => Assert.False(DemandScreening.NeedsRescreen(" Cần phòng  yên tĩnh ", "Cần phòng yên tĩnh"));

    [Fact]
    public void Decide_Rong_DuyetNgay() => Assert.Equal((DemandReviewStatus.Approved, (string?)null), DemandScreening.Decide(Array.Empty<string>()));

    [Fact]
    public void Decide_CoLyDo_ChoDuyet_GopLyDo()
        => Assert.Equal((DemandReviewStatus.Pending, "A; B"), DemandScreening.Decide(new[] { "A", "B" }));

    [Theory]
    [InlineData("Cần bạn ở ghép gần trường")]
    [InlineData("Cho thuê Bình Thạnh")]
    [InlineData("Yêu cầu căn bản: có chỗ để xe")]
    public void CumTuThuong_KhongBiCoiLaRaoVat(string note) => Assert.DoesNotContain("Lời nhắn giống tin rao vặt", S(note));

    [Theory]
    [InlineData("Cần bán nhà gấp")]
    [InlineData("moi gioi nha dat")]
    public void RaoVat_VanBat(string note) => Assert.Contains("Lời nhắn giống tin rao vặt", S(note));

    [Fact]
    public void Decide_GuiLaiSauKhiBiTuChoi_LuonChoDuyet()
    {
        var (status, reason) = DemandScreening.Decide(Array.Empty<string>(), DemandReviewStatus.Rejected);
        Assert.Equal(DemandReviewStatus.Pending, status);
        Assert.Equal("Gửi lại sau khi bị từ chối", reason);
    }

    [Fact]
    public void Decide_GuiLaiSauKhiBiTuChoi_GopLyDo()
        => Assert.Equal((DemandReviewStatus.Pending, "Gửi lại sau khi bị từ chối; A"),
            DemandScreening.Decide(new[] { "A" }, DemandReviewStatus.Rejected));

    [Theory]
    [InlineData("Dọn vào 05.11.2026 8 giờ sáng")]
    [InlineData("Ngân sách mua sau này 84.000.000.000")]
    [InlineData("Dọn vào 05.11.2026 10 giờ")]
    public void NgayVaSoTien_KhongPhaiSoDienThoai(string note) => Assert.DoesNotContain("Lời nhắn có số điện thoại", S(note));

    [Theory]
    [InlineData("Gọi O901234567")]
    [InlineData("Số 0901,234,567")]
    [InlineData("Số 0901_234_567")]
    [InlineData("+84 90 123 4567")]
    public void SoDienThoai_VietLach_VanBat(string note) => Assert.Contains("Lời nhắn có số điện thoại", S(note));

    [Theory]
    [InlineData("Nhắn za lo cho mình")]
    [InlineData("Liên hệ z.a.l.o nhé")]
    [InlineData("Ib fb mình")]
    public void KenhRieng_VietLach_VanBat(string note) => Assert.Contains("Lời nhắn có kênh liên lạc riêng", S(note));

    [Fact]
    public void Email_CoDauCach_VanBat() => Assert.Contains("Lời nhắn có địa chỉ email", S("Mail an @ gmail . com"));

    [Theory]
    [InlineData("Có số điện thoại.", "Có số điện thoại")]
    [InlineData("  Spam!!  ", "Spam")]
    [InlineData("Lý do rõ ràng", "Lý do rõ ràng")]
    public void CleanReason_BoDauCauCuoi(string input, string expected) => Assert.Equal(expected, DemandScreening.CleanReason(input));
}
