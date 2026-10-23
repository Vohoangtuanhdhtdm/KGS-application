using kgs_api.Domain.Entity;
using kgs_api.Dtos;

namespace kgs_api.Domain.Rules
{
    /// <summary>Nhu cầu "gần khớp theo giá" với một tin: tin chỉ vượt trần ngân sách không quá
    /// <see cref="Tolerance"/>, mọi điều kiện khác khớp đủ.
    ///
    /// Đây là nhóm chủ nhà có thể chủ động nhất: chênh vài trăm nghìn là chỗ một lời mời kèm giá
    /// ưu đãi lấp được. Chỉ nới GIÁ — nới số phòng hay khu vực là đoán thay người tìm điều họ
    /// sẵn lòng bỏ qua, và lời mời thành làm phiền.</summary>
    public static class NearMatch
    {
        public const decimal Tolerance = 0.10m;

        /// <summary>Bộ lọc nới trần giá và trần tổng chi phí thêm 10%. Null khi nhu cầu không có
        /// trần nào — không có ngân sách thì không có "gần khớp theo giá".</summary>
        public static PublicListingSearchQuery? Relax(PublicListingSearchQuery q)
        {
            if (q.PriceMax is null && q.TotalCostMax is null) return null;
            return q with
            {
                PriceMax = q.PriceMax * (1 + Tolerance),
                TotalCostMax = q.TotalCostMax * (1 + Tolerance),
            };
        }

        /// <summary>Tin vượt ngân sách bao nhiêu phần trăm, làm tròn lên ("cao hơn 6%").</summary>
        public static int OverBudgetPercent(decimal listingCost, decimal budget)
        {
            if (budget <= 0 || listingCost <= budget) return 0;
            return (int)Math.Ceiling((listingCost - budget) / budget * 100);
        }

        /// <summary>Tổng chi phí cố định mỗi tháng — đúng công thức bộ lọc TotalCostMax của
        /// <see cref="ListingSearchFilter"/>.</summary>
        public static decimal MonthlyCost(Listing l)
            => l.Price + (l.Terms.ServiceFee ?? 0) + (l.Terms.ParkingFee ?? 0) + (l.Terms.InternetFee ?? 0);
    }
}
