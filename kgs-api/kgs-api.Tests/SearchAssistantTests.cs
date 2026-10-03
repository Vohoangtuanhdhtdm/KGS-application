using System.Text.Json.Nodes;
using kgs_api.Domain.Rules;
using kgs_api.Dtos;
using kgs_api.Services.Assistant;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Kiểm tra lại đầu ra của LLM — tầng đứng giữa "mô hình nói gì" và "bộ lọc chạy gì".
/// Không gọi Groq: đưa thẳng JSON giả như mô hình trả về.</summary>
public class SearchAssistantTests
{
    private static readonly List<(string City, string District)> Areas = new()
    {
        ("TP. Hồ Chí Minh", "Quận 3"),
        ("TP. Hồ Chí Minh", "Quận Bình Thạnh"),
        ("Bình Dương", "TP. Thủ Dầu Một"),
    };

    private static AssistantSearchRequest Req(string msg = "x") => new(msg, null, null, null);

    private static AssistantSearchResult Run(string json, AssistantSearchRequest? req = null)
        => SearchAssistantService.Validate(JsonNode.Parse(json)!.AsObject(), req ?? Req(), Areas);

    [Fact]
    public void KhuVucCoThat_DuocChuanHoaVeDungTen()
    {
        var r = Run("""{"type":2,"city":"Hồ Chí Minh","district":"quận bình thạnh"}""");
        Assert.Equal("TP. Hồ Chí Minh", r.Criteria.City);
        Assert.Equal("Quận Bình Thạnh", r.Criteria.District);
        Assert.Empty(r.Unrecognized);
    }

    [Fact]
    public void KhuVucKhongCoTin_BiBo_VaBaoLai()
    {
        var r = Run("""{"type":2,"district":"Quận 12"}""");
        Assert.Null(r.Criteria.District);
        Assert.Contains(r.Unrecognized, u => u.Contains("Quận 12"));
    }

    [Fact]
    public void GiaNguocChieu_DuocDaoLai_GiaAm_BiBo()
    {
        var r = Run("""{"type":1,"priceMin":5000000000,"priceMax":3000000000,"totalCostMax":-5}""");
        Assert.Equal(3_000_000_000m, r.Criteria.PriceMin);
        Assert.Equal(5_000_000_000m, r.Criteria.PriceMax);
        Assert.Null(r.Criteria.TotalCostMax);
    }

    [Fact]
    public void DieuKienChiCuaThue_BiBoKhiTimMua()
    {
        var r = Run("""{"type":1,"petsAllowed":true,"totalCostMax":7000000,"legalStatuses":["Sổ hồng riêng"]}""");
        Assert.Null(r.Criteria.PetsAllowed);
        Assert.Null(r.Criteria.TotalCostMax);
        Assert.Equal(new[] { "Sổ hồng riêng" }, r.Criteria.LegalStatuses);
    }

    [Fact]
    public void PhapLy_BiBoKhiTimThue()
    {
        var r = Run("""{"type":2,"legalStatuses":["Sổ hồng riêng"]}""");
        Assert.Null(r.Criteria.LegalStatuses);
    }

    [Fact]
    public void TuVungLa_VaLoaiHinhLa_BiLoai()
    {
        var r = Run("""{"type":1,"propertyTypes":[3,42,99],"directions":["Đông Nam","Trên trời"],"amenities":["balcony","ho_boi"]}""",
            Req("bắt buộc có ban công"));
        Assert.Equal(new[] { AssetDomainType.Land }, r.Criteria.PropertyTypes);
        Assert.Equal(new[] { "Đông Nam" }, r.Criteria.Directions);
        Assert.Equal(new[] { "balcony" }, r.Criteria.Amenities);
    }

    [Fact]
    public void DiemNeo_ThoiGianDiLai()
    {
        var r = Run("""{"type":2,"anchorText":"đường Hàm Nghi","travelMinutes":20,"travelMode":"driving"}""");
        Assert.NotNull(r.Anchor);
        Assert.Equal(20, r.Anchor!.TravelMinutes);
        Assert.Equal("driving", r.Anchor.TravelMode);
        Assert.Null(r.Anchor.RadiusKm);
    }

    [Fact]
    public void DiemNeo_KhongSo_MacDinh3Km_PhutVoLy_BiBo()
    {
        var r = Run("""{"anchorText":"Đại học Thủ Dầu Một","travelMinutes":500}""");
        Assert.Null(r.Anchor!.TravelMinutes);
        Assert.Equal(3, r.Anchor.RadiusKm);
    }

    [Fact]
    public void ToaDo_KhongDoLlmQuyetDinh_GiuTheoTrangThaiHienTai()
    {
        var current = new PublicListingSearchQuery(ListingType.Rent, null, null, null, null, null, null,
            10.77, 106.69, 3000, null, null, null, null, null, null, null);
        var r = Run("""{"type":2,"priceMax":5000000}""", new AssistantSearchRequest("rẻ hơn", current, null, null));
        Assert.Equal(10.77, r.Criteria.Latitude);
        Assert.Equal(3000, r.Criteria.RadiusMeters);
    }

    [Fact]
    public void MongMuonMem_DuocTachVaGioiHan()
    {
        var r = Run("""{"preferences":["yên tĩnh","ban công","yên tĩnh"]}""");
        Assert.Equal(new[] { "yên tĩnh", "ban công" }, r.Preferences);
    }

    // ---- Quy tắc sửa lỗi có quy luật của mô hình (rút ra từ bộ đánh giá) ----

    [Fact]
    public void KhoangGia_DoiThanhKhoang10PhanTram()
    {
        var r = Run("""{"type":2,"priceApprox":3000000}""");
        Assert.Equal(2_700_000m, r.Criteria.PriceMin);
        Assert.Equal(3_300_000m, r.Criteria.PriceMax);
    }

    [Fact]
    public void GiaThueTy_LaNhamDonVi_DuocSua()
    {
        var r = Run("""{"type":2,"priceMax":2500000000}""");
        Assert.Equal(2_500_000m, r.Criteria.PriceMax);
        // Tin BÁN 2,5 tỷ là bình thường — không được đụng tới.
        var sale = Run("""{"type":1,"priceMax":2500000000}""");
        Assert.Equal(2_500_000_000m, sale.Criteria.PriceMax);
    }

    [Fact]
    public void TienNghi_KhongNhanManh_ThanhMongMuonMem()
    {
        var r = Run("""{"type":2,"amenities":["air_conditioner","wifi"]}""", Req("thuê phòng có máy lạnh, wifi"));
        Assert.Null(r.Criteria.Amenities);
        Assert.Contains("máy lạnh", r.Preferences);
        Assert.Contains("wifi", r.Preferences);
    }

    [Fact]
    public void TienNghi_NhanManh_GiuLamDieuKienCung()
    {
        var r = Run("""{"type":2,"amenities":["private_bathroom"]}""", Req("bắt buộc phải có WC riêng"));
        Assert.Equal(new[] { "private_bathroom" }, r.Criteria.Amenities);
    }

    [Fact]
    public void SoDo_DuocHieuLaCoSo()
    {
        var r = Run("""{"type":1,"legalStatuses":["Sổ đỏ"]}""");
        Assert.Equal(3, r.Criteria.LegalStatuses!.Count);
        // Nói rõ "sổ hồng riêng" thì giữ đúng.
        var rieng = Run("""{"type":1,"legalStatuses":["Sổ hồng riêng"]}""");
        Assert.Equal(new[] { "Sổ hồng riêng" }, rieng.Criteria.LegalStatuses);
    }

    // ---- Xếp hạng mềm ----

    [Fact]
    public void TsQuery_CumNhieuTu_DungToanTuLienKe_VaKhongLotKyTuDacBiet()
    {
        var q = SoftPreferences.ToTsQuery(new[] { "ban công", "yên tĩnh!", "a & b | c" });
        Assert.Equal("(ban <-> cong) | (yen <-> tinh) | (a <-> b <-> c)", q);
    }

    [Fact]
    public void KhopMongMuon_KhongPhanBietDau_VaTheoCumTu()
    {
        var m = SoftPreferences.Matched(new[] { "ban công", "gần chợ", "view sông" },
            "Căn hộ có BAN CONG rộng", "Đi bộ 5 phút ra chợ, gan cho Ba Chieu");
        Assert.Equal(new[] { "ban công", "gần chợ" }, m);
    }
}
