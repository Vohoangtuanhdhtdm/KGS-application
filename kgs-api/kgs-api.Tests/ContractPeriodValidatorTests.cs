using kgs_api.Domain.Rules;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Tests;

/// <summary>Kiểm thử quy tắc kỳ hạn hợp đồng.
///
/// Validator được tách khỏi EF có chủ đích, nên toàn bộ nghiệp vụ dưới đây kiểm thử
/// được mà không cần database, không cần dựng WebApplicationFactory, chạy trong vài
/// mili giây. Đây là lý do chính của việc tách class ra khỏi LeaseContractService.</summary>
public class ContractPeriodValidatorTests
{
    private static readonly DateTime Jan2026 = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static ContractSlot Slot(
        ContractDirection direction,
        int startMonth, int endMonth,
        Guid? unitId = null,
        Guid? id = null)
        => new(id ?? Guid.NewGuid(), direction, unitId,
               Jan2026.AddMonths(startMonth), Jan2026.AddMonths(endMonth));

    // ---------- Kỳ hạn cơ bản ----------

    [Fact]
    public void NgayKetThuc_TruocNgayBatDau_ThiBaoLoi()
    {
        var act = () => ContractPeriodValidator.EnsureCanPlace(
            [], AssetOwnershipType.Owned, ContractDirection.LeaseOut,
            null, Jan2026.AddMonths(6), Jan2026);

        Assert.Throws<ValidationFailedException>(act);
    }

    [Fact]
    public void TaiSanTrong_ThiChoThueDuoc()
    {
        ContractPeriodValidator.EnsureCanPlace(
            [], AssetOwnershipType.Owned, ContractDirection.LeaseOut,
            null, Jan2026, Jan2026.AddMonths(12));
    }

    // ---------- Chồng kỳ hạn ----------

    [Fact]
    public void HaiHopDongNguyenCan_GiaoNhau_ThiXungDot()
    {
        var existing = new[] { Slot(ContractDirection.LeaseOut, 0, 12) };

        var act = () => ContractPeriodValidator.EnsureCanPlace(
            existing, AssetOwnershipType.Owned, ContractDirection.LeaseOut,
            null, Jan2026.AddMonths(6), Jan2026.AddMonths(18));

        Assert.Throws<ConflictException>(act);
    }

    [Fact]
    public void HaiHopDongNguyenCan_NoiTiepNhau_ThiKhongXungDot()
    {
        var existing = new[] { Slot(ContractDirection.LeaseOut, 0, 12) };

        // Bắt đầu đúng lúc hợp đồng cũ kết thúc — biên không tính là giao nhau.
        ContractPeriodValidator.EnsureCanPlace(
            existing, AssetOwnershipType.Owned, ContractDirection.LeaseOut,
            null, Jan2026.AddMonths(12), Jan2026.AddMonths(24));
    }

    [Fact]
    public void HaiPhongKhacNhau_CungKyHan_ThiKhongXungDot()
    {
        var phong101 = Guid.NewGuid();
        var phong102 = Guid.NewGuid();
        var existing = new[] { Slot(ContractDirection.LeaseOut, 0, 12, phong101) };

        ContractPeriodValidator.EnsureCanPlace(
            existing, AssetOwnershipType.Owned, ContractDirection.LeaseOut,
            phong102, Jan2026, Jan2026.AddMonths(12));
    }

    [Fact]
    public void ChoThueNguyenCan_KhiDaChoThueMotPhong_ThiXungDot()
    {
        // Lỗ hổng của bản cũ: hợp đồng nguyên căn (UnitId = null) và hợp đồng theo phòng
        // nằm ở hai nhóm rời nhau nên có thể cho thuê cả căn VÀ từng phòng cùng lúc.
        var existing = new[] { Slot(ContractDirection.LeaseOut, 0, 12, Guid.NewGuid()) };

        var act = () => ContractPeriodValidator.EnsureCanPlace(
            existing, AssetOwnershipType.Owned, ContractDirection.LeaseOut,
            null, Jan2026, Jan2026.AddMonths(12));

        Assert.Throws<ConflictException>(act);
    }

    [Fact]
    public void ChoThuePhong_KhiDaChoThueNguyenCan_ThiXungDot()
    {
        var existing = new[] { Slot(ContractDirection.LeaseOut, 0, 12) };

        var act = () => ContractPeriodValidator.EnsureCanPlace(
            existing, AssetOwnershipType.Owned, ContractDirection.LeaseOut,
            Guid.NewGuid(), Jan2026, Jan2026.AddMonths(12));

        Assert.Throws<ConflictException>(act);
    }

    [Fact]
    public void HopDongDangGiaHan_DuocLoaiTru_NenKhongTuXungDotVoiChinhMinh()
    {
        var id = Guid.NewGuid();
        var existing = new[] { Slot(ContractDirection.LeaseOut, 0, 12, id: id) };

        ContractPeriodValidator.EnsureCanPlace(
            existing, AssetOwnershipType.Owned, ContractDirection.LeaseOut,
            null, Jan2026.AddMonths(6), Jan2026.AddMonths(18), excludeContractId: id);
    }

    // ---------- Cho thuê lại phải nằm trong hạn hợp đồng đi thuê ----------
    // Đây là quy tắc lõi của mô hình master-lease và là điểm khác biệt so với
    // các sản phẩm mặc định người dùng là chủ sở hữu.

    [Fact]
    public void ChoThueLai_TrongHanHopDongDiThue_ThiHopLe()
    {
        var existing = new[] { Slot(ContractDirection.LeaseIn, 0, 18) };

        ContractPeriodValidator.EnsureCanPlace(
            existing, AssetOwnershipType.Leasehold, ContractDirection.LeaseOut,
            Guid.NewGuid(), Jan2026, Jan2026.AddMonths(12));
    }

    [Fact]
    public void ChoThueLai_VuotQuaHanHopDongDiThue_ThiBiChan()
    {
        // Đi thuê đến tháng 18, nhưng cho thuê lại đến tháng 24.
        var existing = new[] { Slot(ContractDirection.LeaseIn, 0, 18) };

        var ex = Assert.Throws<ConflictException>(() => ContractPeriodValidator.EnsureCanPlace(
            existing, AssetOwnershipType.Leasehold, ContractDirection.LeaseOut,
            Guid.NewGuid(), Jan2026, Jan2026.AddMonths(24)));

        Assert.Contains("hết hạn", ex.Message);
    }

    [Fact]
    public void ChoThueLai_BatDauTruocHopDongDiThue_ThiBiChan()
    {
        var existing = new[] { Slot(ContractDirection.LeaseIn, 6, 24) };

        Assert.Throws<ConflictException>(() => ContractPeriodValidator.EnsureCanPlace(
            existing, AssetOwnershipType.Leasehold, ContractDirection.LeaseOut,
            Guid.NewGuid(), Jan2026, Jan2026.AddMonths(12)));
    }

    [Fact]
    public void ChoThueLai_KhiChuaCoHopDongDiThue_ThiBiChan()
    {
        var ex = Assert.Throws<ConflictException>(() => ContractPeriodValidator.EnsureCanPlace(
            [], AssetOwnershipType.Leasehold, ContractDirection.LeaseOut,
            Guid.NewGuid(), Jan2026, Jan2026.AddMonths(12)));

        Assert.Contains("chưa có hợp đồng thuê với chủ nhà", ex.Message);
    }

    [Fact]
    public void TaiSanSoHuu_KhongCanHopDongDiThue()
    {
        // Ràng buộc head-lease chỉ áp dụng cho tài sản Leasehold. Chủ sở hữu thì không.
        ContractPeriodValidator.EnsureCanPlace(
            [], AssetOwnershipType.Owned, ContractDirection.LeaseOut,
            Guid.NewGuid(), Jan2026, Jan2026.AddMonths(120));
    }

    [Fact]
    public void HopDongDiThue_KhongBiRangBuocBoiChinhNo()
    {
        // Tạo hợp đồng đi thuê trên tài sản Leasehold không cần head lease nào trước đó.
        ContractPeriodValidator.EnsureCanPlace(
            [], AssetOwnershipType.Leasehold, ContractDirection.LeaseIn,
            null, Jan2026, Jan2026.AddMonths(18));
    }
}
