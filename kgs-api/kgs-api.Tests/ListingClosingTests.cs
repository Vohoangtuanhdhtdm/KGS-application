using kgs_api.Domain.Entity;
using kgs_api.Domain.Rules;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Kiểm thử đóng tin kèm lý do và thống kê "kết nối thành công".</summary>
public class ListingClosingTests
{
    [Fact]
    public void Dong_GhiLyDoVaThoiDiem_MoLaiThiXoa()
    {
        var l = new Listing { Status = ListingStatus.Approved };
        var at = new DateTime(2026, 10, 11, 3, 0, 0, DateTimeKind.Utc);
        ListingClosing.Close(l, ListingCloseReason.TakenViaKgs, at);
        Assert.Equal(ListingStatus.Closed, l.Status);
        Assert.Equal(ListingCloseReason.TakenViaKgs, l.CloseReason);
        Assert.Equal(at, l.ClosedAt);

        ListingClosing.ClearClose(l);
        Assert.Null(l.CloseReason);
        Assert.Null(l.ClosedAt);
    }

    [Theory]
    [InlineData(ListingCloseReason.TakenViaKgs, true)]
    [InlineData(ListingCloseReason.TakenElsewhere, true)]
    [InlineData(ListingCloseReason.Withdrawn, true)]
    [InlineData(ListingCloseReason.Expired, false)]
    [InlineData(ListingCloseReason.ReportedTaken, false)]
    public void NguoiDangChiChonDuoc3LyDo(ListingCloseReason r, bool allowed)
        => Assert.Equal(allowed, ListingClosing.OwnerReasons.Contains(r));

    [Fact]
    public void TyLeQuaKgs_TinhTrenCacTinDaCoKhach()
    {
        var s = ListingClosing.Summarize(new ListingCloseReason?[]
        {
            ListingCloseReason.TakenViaKgs, ListingCloseReason.TakenViaKgs, ListingCloseReason.TakenViaKgs,
            ListingCloseReason.TakenElsewhere,
            ListingCloseReason.Withdrawn, ListingCloseReason.Expired, ListingCloseReason.ReportedTaken, null,
        });
        Assert.Equal(3, s.ViaKgs);
        Assert.Equal(1, s.Elsewhere);
        Assert.Equal(1, s.Withdrawn);
        Assert.Equal(1, s.Expired);
        Assert.Equal(1, s.ReportedTaken);
        Assert.Equal(1, s.Unknown);
        Assert.Equal(0.75, s.ViaKgsShare);   // 3 qua KGS / 4 tin có khách — rút tin, hết hạn không tính
    }

    [Fact]
    public void ChuaCoTinNaoCoKhach_ThiKhongCoTyLe()
        => Assert.Null(ListingClosing.Summarize(new ListingCloseReason?[] { ListingCloseReason.Expired }).ViaKgsShare);
}
