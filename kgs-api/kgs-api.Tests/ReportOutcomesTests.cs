using kgs_api.Domain.Rules;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Xác nhận báo vi phạm phải dẫn tới đúng hành động trên tin đăng.</summary>
public class ReportOutcomesTests
{
    [Theory]
    [InlineData(ListingReportReason.Scam, ReportAction.TakeDown)]
    [InlineData(ListingReportReason.Spam, ReportAction.TakeDown)]
    [InlineData(ListingReportReason.Inappropriate, ReportAction.TakeDown)]
    [InlineData(ListingReportReason.AlreadyTaken, ReportAction.MarkTaken)]
    [InlineData(ListingReportReason.WrongInfo, ReportAction.RequestChanges)]
    [InlineData(ListingReportReason.Other, ReportAction.RequestChanges)]
    public void MacDinh_TheoLyDoBao(ListingReportReason reason, ReportAction expected)
        => Assert.Equal(expected, ReportOutcomes.DefaultAction(reason));

    [Fact]
    public void GoTin_VeBiTuChoi_GhiLaGo()
    {
        var (status, action, reason) = ReportOutcomes.Apply(ReportAction.TakeDown, ListingReportReason.Scam);
        Assert.Equal(ListingStatus.Rejected, status);
        Assert.Equal(ModerationAction.TakenDown, action);
        Assert.Equal(ModerationReason.ProhibitedContent, reason);
    }

    [Fact]
    public void DaChoThue_DongTin_ChuTinMoLaiDuoc()
    {
        var (status, action, _) = ReportOutcomes.Apply(ReportAction.MarkTaken, ListingReportReason.AlreadyTaken);
        Assert.Equal(ListingStatus.Closed, status);
        Assert.Equal(ModerationAction.ClosedByReport, action);
    }

    [Fact]
    public void SaiThongTin_TraVeChoSua()
    {
        var (status, action, _) = ReportOutcomes.Apply(ReportAction.RequestChanges, ListingReportReason.WrongInfo);
        Assert.Equal(ListingStatus.ChangesRequested, status);
        Assert.Equal(ModerationAction.ChangesRequested, action);
    }
}
