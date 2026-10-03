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
}
