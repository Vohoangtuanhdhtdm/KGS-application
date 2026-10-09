using kgs_api.Services;
using Microsoft.Extensions.Logging.Abstractions;

namespace kgs_api.Tests;

/// <summary>Cầu dao của dịch vụ định giá: dịch vụ không trả lời thì không bắt mọi trang chờ.</summary>
[Collection("ValuationCircuit")] // trạng thái cầu dao là tĩnh — không chạy song song
public class ValuationCircuitTests
{
    private sealed class CountingHandler(Func<HttpResponseMessage> respond) : HttpMessageHandler
    {
        public int Calls;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r, CancellationToken ct)
        {
            Calls++;
            return Task.FromResult(respond());
        }
    }

    private static ValuationService Service(HttpMessageHandler h)
        => new(new HttpClient(h) { BaseAddress = new Uri("http://127.0.0.1:8000") }, NullLogger<ValuationService>.Instance);

    [Fact]
    public async Task KhongKetNoiDuoc_LanSauTraNgay_KhongGoiLai()
    {
        ValuationService.ResetCircuit();
        var h = new CountingHandler(() => throw new HttpRequestException("Connection refused"));
        var svc = Service(h);

        Assert.False((await svc.GetPriceIndexAsync("Thành phố Hồ Chí Minh", "Quận 1")).Available);
        Assert.False((await svc.GetPriceIndexAsync("Thành phố Hồ Chí Minh", "Quận 3")).Available);
        Assert.Empty(await svc.GetPriceIndexAreasAsync());
        Assert.Equal(1, h.Calls);
        ValuationService.ResetCircuit();
    }

    [Fact]
    public async Task LoiDuLieu_KhongNgatCauDao()
    {
        ValuationService.ResetCircuit();
        var h = new CountingHandler(() => new HttpResponseMessage(System.Net.HttpStatusCode.OK)
        {
            Content = new StringContent("không phải JSON", System.Text.Encoding.UTF8, "application/json"),
        });
        var svc = Service(h);

        await svc.GetPriceIndexAsync(null, null);
        await svc.GetPriceIndexAsync(null, null);
        Assert.Equal(2, h.Calls);
        ValuationService.ResetCircuit();
    }
}
