using kgs_api.Domain.Rules;
using kgs_api.Services.Admin;

namespace kgs_api.Tests;

public class AdminOverviewTests
{
    [Fact]
    public void PhanVi()
    {
        var xs = new List<double> { 5, 1, 3, 2, 4 };
        Assert.Equal(3, AdminOverviewService.Percentile(xs, 0.5));
        Assert.Equal(5, AdminOverviewService.Percentile(xs, 0.9));
        Assert.Equal(1, AdminOverviewService.Percentile(xs, 0.0));
        Assert.Null(AdminOverviewService.Percentile(new List<double>(), 0.5));
    }

    [Fact]
    public void GhepDoi_TiLeTrenSoLoiMoi()
    {
        var s = MatchmakingStats.From(10, 20, 5, 8);
        Assert.Equal(10, s.OpenDemands);
        Assert.Equal(0.25, s.AcceptRate, 3);
        Assert.Equal(0.4, s.OfferRate, 3);
    }

    [Fact]
    public void GhepDoi_ChuaMoiAi_TiLe0()
    {
        var s = MatchmakingStats.From(3, 0, 0, 0);
        Assert.Equal(0, s.AcceptRate);
        Assert.Equal(0, s.OfferRate);
    }
}
