using kgs_api.Services.Email;

namespace kgs_api.Tests;

/// <summary>Khung email dùng chung: đẹp nhưng trước hết phải an toàn (nội dung người dùng gõ vào
/// không được thành mã HTML) và đọc được cả khi trình đọc email không hiện HTML.</summary>
public class EmailLayoutTests
{
    private static EmailContent Sample(string title = "Có người hỏi thuê: Phòng 20m²") => new(
        Title: title,
        Preheader: "Nguyễn Văn Test muốn xem nhà",
        Eyebrow: "Yêu cầu xem nhà",
        Paragraphs: new[] { "Nguyễn Văn Test vừa gửi yêu cầu xem nhà." },
        Details: new[]
        {
            new EmailDetail(EmailIcon.Phone, "Số điện thoại", "0901234567", "tel:0901234567"),
            new EmailDetail(EmailIcon.Message, "Lời nhắn", "Cho mình xem <b>chiều nay</b>"),
        },
        CtaLabel: "Xem yêu cầu",
        CtaUrl: "https://kgs.vn/yeu-cau",
        Tip: "Liên hệ sớm để giữ khách.");

    [Fact]
    public void Html_MaHoaNoiDungNguoiDung()
    {
        var (html, _) = EmailLayout.Render(Sample("<script>alert(1)</script>"));
        Assert.DoesNotContain("<script>", html);
        Assert.Contains("&lt;script&gt;", html);
        Assert.DoesNotContain("<b>chiều nay</b>", html);
    }

    [Fact]
    public void Html_CoKiGiNutVaDongChiTiet()
    {
        var (html, _) = EmailLayout.Render(Sample());
        Assert.Contains($"cid:{EmailLayout.KiGiContentId}", html);
        Assert.Contains("https://kgs.vn/yeu-cau", html);
        Assert.Contains("Xem yêu cầu", html);
        Assert.Contains("href=\"tel:0901234567\"", html);
        Assert.Contains("Nguyễn Văn Test muốn xem nhà", html); // dòng xem trước
    }

    /// <summary>Biểu tượng là ảnh nét mảnh nhúng vào thư, không phải emoji (mỗi máy vẽ một kiểu).</summary>
    [Fact]
    public void BieuTuong_LaAnhNhung_KhongDungEmoji()
    {
        var (html, _) = EmailLayout.Render(Sample());
        Assert.Contains("cid:icon-phone", html);
        Assert.Contains("cid:icon-message", html);
        Assert.Contains("cid:icon-tip", html);
        Assert.DoesNotContain("📞", html);
        Assert.DoesNotContain("💡", html);
        Assert.Equal(new[] { "icon-message", "icon-phone", "icon-tip", "kigi" },
            EmailLayout.ContentIds(html).OrderBy(x => x));
    }

    [Fact]
    public void Text_BanChuThuanDuThongTin()
    {
        var (_, text) = EmailLayout.Render(Sample());
        Assert.Contains("Có người hỏi thuê: Phòng 20m²", text);
        Assert.Contains("Số điện thoại: 0901234567", text);
        Assert.Contains("Xem yêu cầu: https://kgs.vn/yeu-cau", text);
        Assert.DoesNotContain("<", text.Replace("<b>chiều nay</b>", ""));
    }

    [Fact]
    public void KhongCoNut_KhongVeNut()
    {
        var (html, _) = EmailLayout.Render(Sample() with { CtaLabel = null, CtaUrl = null });
        Assert.DoesNotContain("href=\"https://kgs.vn/yeu-cau\"", html);
    }

    [Fact]
    public void DoanVan_TachTheoDongTrong()
        => Assert.Equal(new[] { "Một.", "Hai." }, EmailLayout.SplitParagraphs("Một.\n\nHai.\n"));

    [Fact]
    public void LoaiEmail_TheoDuongDan()
    {
        Assert.Equal("Yêu cầu xem nhà", EmailLayout.KindFor("/yeu-cau").Eyebrow);
        Assert.NotNull(EmailLayout.KindFor("/yeu-cau").Tip);
        Assert.Equal("Nhu cầu & lời mời", EmailLayout.KindFor("/nhu-cau").Eyebrow);
        Assert.Equal("Tin đăng của bạn", EmailLayout.KindFor("/tin-cua-toi?nhu_cau=1").Eyebrow);
        Assert.Equal("Thông báo từ KGS", EmailLayout.KindFor(null).Eyebrow);
    }
}
