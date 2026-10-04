using kgs_api.Domain.Rules;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Các chốt chặn của thao tác quản trị — sai ở đây là khoá nhầm người hoặc tự khoá
/// mình ra khỏi hệ thống.</summary>
public class AdminRulesTests
{
    [Theory]
    [InlineData(ListingStatus.Rejected, ModerationAction.TakenDown, true)]
    [InlineData(ListingStatus.Closed, ModerationAction.ClosedByReport, true)]
    [InlineData(ListingStatus.Rejected, ModerationAction.Rejected, false)]   // từ chối lúc duyệt: chủ tin tự sửa
    [InlineData(ListingStatus.Closed, null, false)]                          // chủ tin tự đóng / hết hạn
    [InlineData(ListingStatus.Approved, ModerationAction.TakenDown, false)]
    public void KhoiPhuc_ChiChoTinDoQuanTriGo(ListingStatus status, ModerationAction? latest, bool expected)
        => Assert.Equal(expected, AdminRules.CanRestore(status, latest));

    [Fact]
    public void Khoa_KhongTuKhoaMinh_KhongKhoaAdmin()
    {
        Assert.NotNull(AdminRules.CannotLock("a", "a", false, false));
        Assert.NotNull(AdminRules.CannotLock("a", "b", true, false));
        Assert.NotNull(AdminRules.CannotLock("a", "b", false, true));
        Assert.Null(AdminRules.CannotLock("a", "b", false, false));
    }

    [Fact]
    public void QuyenAdmin_LuonConItNhatMotNguoi()
    {
        Assert.NotNull(AdminRules.CannotChangeAdmin("a", "a", grant: false, targetLocked: false, adminCount: 3));
        Assert.NotNull(AdminRules.CannotChangeAdmin("a", "b", grant: false, targetLocked: false, adminCount: 1));
        Assert.NotNull(AdminRules.CannotChangeAdmin("a", "b", grant: true, targetLocked: true, adminCount: 1));
        Assert.Null(AdminRules.CannotChangeAdmin("a", "b", grant: false, targetLocked: false, adminCount: 2));
        // Admin không đồng thời là Chủ nhà: còn tin chưa đóng thì không cấp quyền.
        Assert.NotNull(AdminRules.CannotChangeAdmin("a", "b", grant: true, targetLocked: false, adminCount: 1, targetOpenListings: 2));
        Assert.Null(AdminRules.CannotChangeAdmin("a", "b", grant: true, targetLocked: false, adminCount: 1, targetOpenListings: 0));
        // Thu quyền không bị chặn bởi số tin.
        Assert.Null(AdminRules.CannotChangeAdmin("a", "b", grant: false, targetLocked: false, adminCount: 2, targetOpenListings: 5));
    }

    [Fact]
    public void ThoiHanKhoa()
    {
        var now = new DateTimeOffset(2026, 10, 3, 0, 0, 0, TimeSpan.Zero);
        Assert.Equal(now.AddDays(7), AdminRules.LockEnd(now, 7));
        Assert.Equal(DateTimeOffset.MaxValue, AdminRules.LockEnd(now, null));
    }
}

public class AdminLockRestoreTests
{
    [Fact]
    public void MoKhoa_TinChuaDuyet_VeHangDoi_KhongLenThang()
    {
        Assert.Equal(ListingStatus.Pending,
            AdminRules.StatusAfterUnlock(AdminRules.LockTakedownNote("lừa đảo", wasPending: true)));
        Assert.Equal(ListingStatus.Approved,
            AdminRules.StatusAfterUnlock(AdminRules.LockTakedownNote("lừa đảo", wasPending: false)));
        Assert.StartsWith(AdminRules.LockTakedownPrefix, AdminRules.LockTakedownNote("x", true));
    }
}
