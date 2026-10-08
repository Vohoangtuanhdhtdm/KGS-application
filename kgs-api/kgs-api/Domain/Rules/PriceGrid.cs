namespace kgs_api.Domain.Rules
{
    /// <summary>Một tin đưa vào lưới giá: toạ độ, giá chào, diện tích (của căn nếu tin đăng riêng
    /// một căn).</summary>
    public sealed record PriceGridPoint(double Lat, double Lng, decimal Price, double? Area);

    public sealed record PriceGridCell(
        string Key,
        double West, double South, double East, double North,
        // Trọng tâm các tin trong ô — nhãn đặt ở đây chứ không ở tâm ô, để nó nằm đúng chỗ có
        // nhà thay vì giữa một cánh đồng.
        double Lat, double Lng,
        int Count,
        // Số tin trong ô có diện tích — chỉ những tin này góp vào giá/m².
        int PricedCount,
        double? MedianPricePerM2,
        decimal MinPrice);

    public sealed record PriceGridResult(
        IReadOnlyList<PriceGridCell> Cells,
        // Bốn mốc chia năm mức màu (phân vị 20/40/60/80) của giá/m², tính trên TOÀN BỘ tin khớp
        // bộ lọc chứ không riêng khung nhìn — kéo bản đồ sang quận khác thì màu vẫn cùng một
        // thang, đỏ ở đâu cũng là đắt như nhau. Rỗng khi quá ít tin để chia.
        IReadOnlyList<double> Breaks,
        int TotalInView,
        int TotalMatched,
        int MinReliableCount);

    /// <summary>Gom tin đăng theo ô lưới để vẽ lớp "giá/m²" và gom cụm trên bản đồ tìm nhà.
    ///
    /// Vì sao ô lưới cố định thay cho bản đồ nhiệt (heatmap) của Mapbox: heatmap tô theo MẬT ĐỘ
    /// điểm, dùng giá làm trọng số thì khu "nhiều tin" và khu "giá cao" lẫn vào nhau — một hẻm có
    /// 30 phòng trọ rẻ sẽ đỏ rực hơn một con phố có 3 căn biệt thự. Ô lưới tách hai thứ đó ra:
    /// màu là trung vị giá/m², con số là số tin.
    ///
    /// Vì sao trung vị giá/m² mà không phải giá trung bình: trung bình tổng giá cộng chung căn
    /// 20 m² với biệt thự 300 m², và một tin nhập nhầm giá kéo lệch cả ô. Trung vị theo m² thì
    /// so được giữa các ô, và bền với vài tin lạc.
    ///
    /// Ô được chia trên lưới Web Mercator — cùng phép chiếu với bản đồ — ở mức zoom bản đồ + 3,
    /// tức mỗi ô cỡ 64 px trên màn hình ở mọi mức zoom: phóng xa thì ô to (gom cả phường), phóng
    /// gần thì ô nhỏ (vài dãy nhà).</summary>
    public static class PriceGrid
    {
        /// <summary>Ô có ít hơn bấy nhiêu tin có diện tích thì vẫn hiện số tin nhưng không tô
        /// màu giá — một tin lẻ không nói lên giá của cả khu.</summary>
        public const int MinReliableCount = 2;

        /// <summary>Mỗi ô = 1/8 cạnh tile 512 px → 64 px.</summary>
        private const int SubdivisionLevels = 3;

        public static int CellLevel(double zoom)
            => Math.Clamp((int)Math.Floor(zoom), 0, 19) + SubdivisionLevels;

        public static PriceGridResult Build(
            IReadOnlyCollection<PriceGridPoint> matched,
            double west, double south, double east, double north,
            double zoom)
        {
            var level = CellLevel(zoom);
            var n = Math.Pow(2, level);

            var inView = matched
                .Where(p => p.Lng >= west && p.Lng <= east && p.Lat >= south && p.Lat <= north)
                .ToList();

            var cells = inView
                .GroupBy(p => (X: (int)Math.Floor(LngToX(p.Lng) * n), Y: (int)Math.Floor(LatToY(p.Lat) * n)))
                .Select(g =>
                {
                    var perM2 = g.Select(PricePerM2).OfType<double>().ToList();
                    return new PriceGridCell(
                        $"{level}/{g.Key.X}/{g.Key.Y}",
                        West: XToLng(g.Key.X / n), South: YToLat((g.Key.Y + 1) / n),
                        East: XToLng((g.Key.X + 1) / n), North: YToLat(g.Key.Y / n),
                        Lat: g.Average(p => p.Lat), Lng: g.Average(p => p.Lng),
                        Count: g.Count(),
                        PricedCount: perM2.Count,
                        MedianPricePerM2: perM2.Count > 0 ? Median(perM2) : null,
                        MinPrice: g.Min(p => p.Price));
                })
                .OrderByDescending(c => c.Count)
                .ThenBy(c => c.Key, StringComparer.Ordinal)
                .ToList();

            return new PriceGridResult(
                cells, Breaks(matched.Select(PricePerM2).OfType<double>().ToList()),
                inView.Count, matched.Count, MinReliableCount);
        }

        /// <summary>Giá/m² của một tin, null khi thiếu diện tích hay giá — không đoán.</summary>
        public static double? PricePerM2(PriceGridPoint p)
            => p.Area is > 0 && p.Price > 0 ? (double)p.Price / p.Area.Value : null;

        /// <summary>Phân vị 20/40/60/80. Dưới 5 giá trị thì không chia được năm mức có nghĩa.</summary>
        public static IReadOnlyList<double> Breaks(List<double> values)
        {
            if (values.Count < 5) return Array.Empty<double>();
            values.Sort();
            return new[] { 0.2, 0.4, 0.6, 0.8 }.Select(q => Quantile(values, q)).ToList();
        }

        public static double Median(List<double> values)
        {
            values.Sort();
            return Quantile(values, 0.5);
        }

        /// <summary>Nội suy tuyến tính giữa hai phần tử kề (cách tính mặc định của numpy/Excel).</summary>
        private static double Quantile(List<double> sorted, double q)
        {
            var pos = (sorted.Count - 1) * q;
            var lo = (int)Math.Floor(pos);
            var hi = Math.Min(lo + 1, sorted.Count - 1);
            return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
        }

        // ---- Web Mercator, toạ độ chuẩn hoá [0, 1) ----
        private static double LngToX(double lng) => (lng + 180) / 360;
        private static double LatToY(double lat)
        {
            var r = Math.Clamp(lat, -85.05112878, 85.05112878) * Math.PI / 180;
            return (1 - Math.Log(Math.Tan(r) + 1 / Math.Cos(r)) / Math.PI) / 2;
        }
        private static double XToLng(double x) => x * 360 - 180;
        private static double YToLat(double y)
            => Math.Atan(Math.Sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
    }
}
