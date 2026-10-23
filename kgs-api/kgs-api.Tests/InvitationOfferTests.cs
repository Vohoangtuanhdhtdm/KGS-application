using kgs_api.Domain.Rules;

namespace kgs_api.Tests;

/// <summary>Ưu đãi riêng phải là ưu đãi thật: giá thấp hơn giá niêm yết, dòng ưu đãi ngắn gọn.</summary>
public class InvitationOfferTests
{
    private const decimal Listed = 5_000_000;

    [Fact]
    public void KhongUuDai_HopLe() => Assert.Null(InvitationOffer.Validate(null, null, Listed));

    [Fact]
    public void GiaThapHon_HopLe() => Assert.Null(InvitationOffer.Validate(4_800_000, "Miễn phí gửi xe 3 tháng", Listed));

    [Fact]
    public void GiaBangGiaNiemYet_TuChoi() => Assert.NotNull(InvitationOffer.Validate(Listed, null, Listed));

    [Fact]
    public void GiaCaoHon_TuChoi() => Assert.NotNull(InvitationOffer.Validate(5_200_000, null, Listed));

    [Fact]
    public void GiaAm_TuChoi() => Assert.NotNull(InvitationOffer.Validate(-1, null, Listed));

    [Fact]
    public void GiaBang0_TuChoi() => Assert.NotNull(InvitationOffer.Validate(0, null, Listed));

    [Fact]
    public void DongUuDai121KyTu_TuChoi() => Assert.NotNull(InvitationOffer.Validate(null, new string('a', 121), Listed));

    [Fact]
    public void DongUuDai120KyTu_HopLe() => Assert.Null(InvitationOffer.Validate(null, new string('a', 120), Listed));
}
