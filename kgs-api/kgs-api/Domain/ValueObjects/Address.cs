using kgs_api.Domain.Rules;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using System.ComponentModel.DataAnnotations;

namespace kgs_api.Domain.ValueObjects
{
    [Owned]
    public class Address
    {
        [Required, MaxLength(100)] public string City { get; set; } = string.Empty;
        [Required, MaxLength(100)] public string District { get; set; } = string.Empty;
        [Required, MaxLength(100)] public string Ward { get; set; } = string.Empty;
        [MaxLength(500)] public string Detail { get; set; } = string.Empty;

        // ---- Địa chỉ theo đơn vị hành chính sau sắp xếp 2025 (Tỉnh → Phường/Xã) ----
        // Không nhập tay: suy ra từ City/District/Ward mỗi lần lưu (ApplicationDbContext gọi
        // SyncNewUnits). Null khi địa chỉ cũ không tra được trong bảng chuyển đổi.
        [MaxLength(10)] public string? NewProvinceCode { get; set; }
        [MaxLength(100)] public string? NewProvince { get; set; }
        [MaxLength(10)] public string? NewWardCode { get; set; }
        [MaxLength(100)] public string? NewWard { get; set; }

        /// <summary>Tính lại địa chỉ mới từ địa chỉ cũ.
        ///
        /// Phường cũ bị chia cho nhiều phường mới: có toạ độ và có ranh giới phường thì lấy phường
        /// THẬT SỰ chứa toạ độ; không thì giữ lựa chọn hiện có (nếu còn hợp lệ). Địa chỉ cũ không
        /// tra được trong bảng chuyển đổi mà toạ độ nằm trong một phường đã biết ranh giới thì lấy
        /// phường đó.</summary>
        public void SyncNewUnits(Point? location = null)
        {
            var byLocation = location is null ? null : WardBoundaries.Find(location.X, location.Y);
            var candidates = AdministrativeUnits2025.CandidateWardCodes(City, District, Ward);
            var prefer = byLocation is not null && candidates.Contains(byLocation) ? byLocation : NewWardCode;
            var n = AdministrativeUnits2025.Resolve(City, District, Ward, prefer);
            if (n is null && byLocation is not null
                && AdministrativeUnits2025.Ward(byLocation) is { } w
                && AdministrativeUnits2025.Province(w.ProvinceCode) is { } p)
                n = new NewAddress(p.Code, p.Name, w.Code, w.Name, false);
            NewProvinceCode = n?.ProvinceCode;
            NewProvince = n?.Province;
            NewWardCode = n?.WardCode;
            NewWard = n?.Ward;
        }
    }
}
