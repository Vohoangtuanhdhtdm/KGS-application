using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Domain.Rules
{
    /// <summary>Ảnh chụp gọn của một hợp đồng đang hiệu lực trên cùng một tài sản.
    /// Cố tình KHÔNG dùng entity LeaseContract để validator không phụ thuộc EF —
    /// nhờ vậy toàn bộ quy tắc dưới đây unit-test được mà không cần database.</summary>
    public readonly record struct ContractSlot(
        Guid Id,
        ContractDirection Direction,
        Guid? UnitId,
        DateTime StartDate,
        DateTime EndDate);

    /// <summary>Nơi DUY NHẤT chứa quy tắc kỳ hạn hợp đồng. Gọi từ cả CreateAsync lẫn
    /// RenewAsync — trước đây RenewAsync bỏ qua hoàn toàn phần kiểm tra chồng kỳ hạn.</summary>
    public static class ContractPeriodValidator
    {
        /// <summary>Kiểm tra một kỳ hạn mới có được phép đặt lên tài sản hay không.</summary>
        /// <param name="activeOnAsset">Toàn bộ hợp đồng Active hiện có trên CÙNG tài sản.</param>
        /// <param name="excludeContractId">Bỏ qua chính hợp đồng đang sửa/gia hạn.</param>
        public static void EnsureCanPlace(
            IReadOnlyList<ContractSlot> activeOnAsset,
            AssetOwnershipType ownership,
            ContractDirection direction,
            Guid? unitId,
            DateTime start,
            DateTime end,
            Guid? excludeContractId = null)
        {
            if (end <= start)
                throw new ValidationFailedException("Ngày kết thúc phải sau ngày bắt đầu.");

            var others = activeOnAsset
                .Where(c => excludeContractId is null || c.Id != excludeContractId.Value)
                .ToList();

            EnsureNoOverlap(others, direction, unitId, start, end);

            if (direction == ContractDirection.LeaseOut && ownership == AssetOwnershipType.Leasehold)
                EnsureWithinHeadLease(others, start, end);
        }

        /// <summary>Chống chồng kỳ hạn. Điểm khác so với bản cũ: hợp đồng NGUYÊN CĂN và hợp đồng
        /// THEO PHÒNG nay xung đột với nhau. Trước đây hai nhóm này không "nhìn thấy" nhau nên
        /// có thể cho thuê cả căn và từng phòng cùng lúc.</summary>
        private static void EnsureNoOverlap(
            IReadOnlyList<ContractSlot> others,
            ContractDirection direction,
            Guid? unitId,
            DateTime start,
            DateTime end)
        {
            var clash = others.FirstOrDefault(c =>
                c.Direction == direction
                && SlotsCollide(c.UnitId, unitId)
                && c.StartDate < end && start < c.EndDate);

            if (clash.Id == Guid.Empty) return;

            var scope = clash.UnitId is null ? "nguyên căn" : "phòng/tầng này";
            throw new ConflictException(
                $"Đã tồn tại hợp đồng đang hiệu lực trùng kỳ hạn ({scope}), " +
                $"từ {clash.StartDate:dd/MM/yyyy} đến {clash.EndDate:dd/MM/yyyy}.");
        }

        /// <summary>Hai phạm vi cho thuê có tranh chấp không gian với nhau hay không.
        /// null = nguyên căn, nên nguyên căn đụng với TẤT CẢ; hai phòng khác nhau thì không đụng.</summary>
        private static bool SlotsCollide(Guid? a, Guid? b)
            => a is null || b is null || a.Value == b.Value;

        /// <summary>Quy tắc lõi của mô hình thuê lại: không thể cho thuê lại quá ngày mình
        /// còn quyền thuê. Đây là ràng buộc mà Guland/Meey Map không có, vì họ mặc định
        /// người dùng là chủ sở hữu.</summary>
        private static void EnsureWithinHeadLease(
            IReadOnlyList<ContractSlot> others,
            DateTime start,
            DateTime end)
        {
            var headLeases = others
                .Where(c => c.Direction == ContractDirection.LeaseIn)
                .ToList();

            if (headLeases.Count == 0)
                throw new ConflictException(
                    "Tài sản này là loại đi thuê nhưng chưa có hợp đồng thuê với chủ nhà đang hiệu lực — " +
                    "hãy tạo hợp đồng đi thuê (LeaseIn) trước khi cho thuê lại.");

            var covering = headLeases.Any(h => h.StartDate <= start && end <= h.EndDate);
            if (covering) return;

            var latestEnd = headLeases.Max(h => h.EndDate);
            throw new ConflictException(
                $"Không thể cho thuê lại đến {end:dd/MM/yyyy} — hợp đồng thuê với chủ nhà " +
                $"hết hạn ngày {latestEnd:dd/MM/yyyy}. Hãy gia hạn hợp đồng đi thuê trước.");
        }
    }
}
