# Thiết kế Module Quản Lý Tài Sản (Asset Management)

> Stack: .NET Core · EF Core · PostgreSQL · ASP.NET Core Identity · Cloudinary
> Phạm vi: Domain model, Entities C#, Fluent API, chiến lược migration từ `UserAsset`, đánh giá scalability.

---

## PHẦN 1 — PHÂN TÍCH NGHIỆP VỤ & DOMAIN MODELING

### 1.1. Đọc lại tài liệu dưới góc nhìn domain

Tài liệu mô tả **hai kịch bản sở hữu** trên cùng một loại tài sản bất động sản:

1. **Tài sản sở hữu (Owned)** — user là chủ. Tài sản có thể: đang sử dụng (bản thân / con cái / người quen), đang cho thuê, hoặc đang rao bán.
2. **Tài sản thuê (Leasehold)** — user đi thuê từ chủ nhà, rồi có thể **cho thuê lại** nguyên căn hoặc **từng tầng/phòng**.

Quan sát quan trọng nhất: phần lớn dữ liệu ở hai kịch bản là **trùng nhau về bản chất**, chỉ khác **chiều của quan hệ hợp đồng**:

| Nghiệp vụ trong tài liệu | Bản chất domain |
|---|---|
| "Hợp đồng cho thuê" (user là chủ) | Hợp đồng thuê, chiều **LeaseOut** |
| "Hợp đồng thuê từ chủ sở hữu" | Hợp đồng thuê, chiều **LeaseIn** |
| "Cho thuê lại nguyên căn" | Hợp đồng LeaseOut, gắn với **Asset** |
| "Cho thuê lại từng tầng/phòng" | Hợp đồng LeaseOut, gắn với **AssetUnit** |
| "Thông tin người thuê" / "Thông tin chủ nhà" / "Danh sách môi giới" | Cùng một khái niệm **ContactParty** (đối tác) với vai trò khác nhau |
| Thuế trước bạ, thuế phi nông nghiệp, môn bài, TNCN, GTGT, hoá đơn điện/nước/internet, chi phí sửa chữa, tiền thuê thu/chi | Cùng một khái niệm **CashFlowEntry** (bút toán thu/chi) với phân loại khác nhau |

Nếu mô hình hoá "đúng theo mặt chữ" của tài liệu (bảng `HopDongChoThue`, bảng `HopDongThue`, bảng `ThueTNCN`, bảng `HoaDonDien`…), CSDL sẽ phình ra 25–30 bảng gần giống nhau và mọi báo cáo phải `UNION` nhiều bảng. Thay vào đó, ta hợp nhất theo bản chất và dùng **enum phân loại** — đây là quyết định kiến trúc trung tâm của thiết kế này.

### 1.2. Danh sách Entities, Value Objects và quan hệ

**Aggregate root: `Asset`** — mọi thứ trong module xoay quanh một tài sản.

| Thành phần | Loại | Vai trò | Quan hệ |
|---|---|---|---|
| `Asset` | Entity (root) | Tài sản (sở hữu hoặc thuê), refactor từ `UserAsset` | N–1 `ApplicationUser`; 0..1–1 `Property` (LinkedPropertyId) |
| `AssetUnit` | Entity | Tầng/phòng khi khai thác lẻ | N–1 `Asset` |
| `AssetMedia` | Entity | Hình ảnh theo thời gian | N–1 `Asset` |
| `AssetDocument` | Entity | Giấy tờ: sổ đỏ, HĐ mua bán, HĐ điện/nước, uỷ quyền, phụ lục… | N–1 `Asset`; 0..1 `LeaseContract` |
| `LeaseContract` | Entity | Hợp đồng thuê 2 chiều (LeaseIn / LeaseOut) | N–1 `Asset`; 0..1 `AssetUnit`; N–1 `ContactParty`; tự tham chiếu `ParentContractId` (chuỗi gia hạn/phụ lục) |
| `ContactParty` | Entity | Người thuê / chủ nhà / môi giới / nhà thầu | N–1 `ApplicationUser` |
| `Equipment` | Entity | Trang thiết bị (của chủ nhà hoặc tự trang bị) | N–1 `Asset`; 0..1 `AssetUnit` |
| `MaintenanceRecord` | Entity | Lịch sử sửa chữa / cải tạo | N–1 `Asset`; 0..1 `AssetUnit`; 0..1 `ContactParty` (nhà thầu) |
| `CashFlowEntry` | Entity | Sổ cái thu/chi: tiền thuê, thuế, hoá đơn, chi phí sửa chữa | N–1 `Asset`; 0..1 `AssetUnit`; 0..1 `LeaseContract` |
| `Reminder` | Entity | Nhắc lịch: thu/đóng tiền, bảo dưỡng, hết hạn HĐ, đóng thuế | 0..1 `Asset`; 0..1 `LeaseContract` |
| `UsagePeriod` | Entity | Lịch sử sử dụng (bản thân / con cái / người quen) | N–1 `Asset` |
| `SaleListing` | Entity | Trạng thái rao bán: giá rao, thoả thuận | 1–1 `Asset` |
| `SaleListingBroker` | Entity (join N–N có payload) | Danh sách môi giới đã gửi | N–N giữa `SaleListing` và `ContactParty` |
| `Address` | **Value Object** (Owned) | Thành phố / Quận / Phường / Chi tiết / Toạ độ | Nhúng vào `Asset` |
| `StoredFile` | **Value Object** (Owned) | `Url` + `PublicId` Cloudinary + metadata | Nhúng vào `AssetMedia`, `AssetDocument`, `CashFlowEntry` (biên lai) |

Quan hệ N–N duy nhất là `SaleListing ↔ ContactParty` (qua `SaleListingBroker`, có payload `SentAt`). Mọi quan hệ còn lại là 1–N hoặc 1–1.

### 1.3. Refactor hay mở rộng `UserAsset`?

**Kết luận: Refactor (đổi thành `Asset`), không tạo bảng mới song song.** Lý do:

1. `UserAsset` hiện tại là "sơ khai" — chưa có nghiệp vụ nào phụ thuộc sâu, chi phí refactor lúc này là **thấp nhất trong toàn bộ vòng đời dự án**. Càng để lâu, chi phí càng tăng.
2. Nếu tạo bảng `Asset` mới song song với `UserAsset`, bạn sẽ có hai nguồn sự thật (two sources of truth) cho cùng một khái niệm — anti-pattern kinh điển dẫn đến dữ liệu lệch nhau.
3. Liên kết `LinkedPropertyId → Property` **được giữ nguyên**, chỉ bổ sung `DeleteBehavior.SetNull` để khi tin đăng bị xoá, tài sản không bị xoá theo (tài sản là dữ liệu gốc, tin đăng chỉ là "hình chiếu" công khai của nó).

Các thay đổi cụ thể trên `UserAsset`:

- `Address` (string đơn) → Value Object `Address` gồm `City/District/Ward/Detail` — **đồng bộ cấu trúc với `Property`**, phục vụ tra cứu thuế phi nông nghiệp theo khu vực và đồng bộ dữ liệu khi đăng tin từ tài sản.
- `Latitude/Longitude` string → `double?` (chuẩn hoá kiểu, sẵn sàng cho query không gian/PostGIS sau này).
- Thêm `OwnershipType` (Owned / Leasehold) — phân nhánh nghiệp vụ lớn nhất trong tài liệu.
- `ThumbnailUrl` → `StoredFile Thumbnail` (thêm `PublicId` để xoá được trên Cloudinary).
- `EstimatedValue` → `CurrentValue` (khớp thuật ngữ "giá trị hiện tại"), `AcquisitionDate` dùng chung cho "ngày mua" (Owned) và "ngày thuê từ chủ" (Leasehold).
- Kế thừa `BaseAuditableEntity`, bỏ `CreatedAt/UpdatedAt` tự khai.

---

## PHẦN 2 — THIẾT KẾ CSDL & CODE C#

### 2.1. Base classes & hạ tầng audit

```csharp
// Domain/Common/BaseAuditableEntity.cs
public abstract class BaseAuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }   // ApplicationUser.Id
    public string? UpdatedBy { get; set; }
}
```

```csharp
// Infrastructure/Persistence/Interceptors/AuditableEntityInterceptor.cs
public sealed class AuditableEntityInterceptor : SaveChangesInterceptor
{
    private readonly ICurrentUserService _currentUser; // lấy UserId từ HttpContext

    public AuditableEntityInterceptor(ICurrentUserService currentUser)
        => _currentUser = currentUser;

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result,
        CancellationToken ct = default)
    {
        var context = eventData.Context;
        if (context is null) return base.SavingChangesAsync(eventData, result, ct);

        foreach (var entry in context.ChangeTracker.Entries<BaseAuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = DateTime.UtcNow;
                entry.Entity.CreatedBy = _currentUser.UserId;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTime.UtcNow;
                entry.Entity.UpdatedBy = _currentUser.UserId;
            }
        }
        return base.SavingChangesAsync(eventData, result, ct);
    }
}
```

Đăng ký một lần trong `AddDbContext`, toàn bộ entity tự động có audit — không còn `CreatedAt = DateTime.UtcNow` rải rác trong code.

### 2.2. Value Objects (Owned Types)

```csharp
// Domain/ValueObjects/Address.cs
[Owned]
public class Address
{
    [Required, MaxLength(100)] public string City { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string District { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Ward { get; set; } = string.Empty;
    [MaxLength(500)] public string Detail { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}
```

```csharp
// Domain/ValueObjects/StoredFile.cs — lời giải cho bài toán Cloudinary
[Owned]
public class StoredFile
{
    [Required, MaxLength(1000)] public string Url { get; set; } = string.Empty;
    [Required, MaxLength(255)]  public string PublicId { get; set; } = string.Empty; // để gọi DeletePhotoAsync
    [MaxLength(255)] public string? FileName { get; set; }
    [MaxLength(100)] public string? ContentType { get; set; }
    public long? SizeBytes { get; set; }
}
```

`StoredFile` được nhúng (owned) vào mọi nơi cần file: ảnh tài sản, giấy tờ, biên lai thu/chi. EF Core sẽ sinh các cột `File_Url`, `File_PublicId`… ngay trong bảng chứa — **không cần bảng `Files` riêng**, không có join thừa, và luôn đủ `PublicId` để xoá file trên Cloudinary khi xoá bản ghi.

> Gợi ý mở rộng `IPhotoService`: thêm `Task<ImageUploadResult> AddFileAsync(IFormFile file)` (dùng `RawUploadParams` cho PDF/giấy tờ) — Cloudinary phân biệt `resource_type: image` và `raw`.

### 2.3. Enums

```csharp
public enum AssetType { PrivateHouse = 1, Apartment = 2, Land = 3, Villa = 4, Shophouse = 5, Office = 6, Other = 99 }

public enum AssetOwnershipType { Owned = 1, Leasehold = 2 }        // Sở hữu / Đi thuê

public enum AssetStatus { InUse = 1, RentedOut = 2, ForSale = 3, Vacant = 4, Sold = 5, LeaseEnded = 6 }

public enum OccupantType { Self = 1, Family = 2, Acquaintance = 3, Tenant = 4 } // đang sử dụng: bản thân/con cái/người quen

public enum UnitStatus { Vacant = 1, Occupied = 2, UnderMaintenance = 3 }

public enum ContractDirection { LeaseOut = 1, LeaseIn = 2 }        // Cho thuê / Đi thuê

public enum ContractStatus { Draft = 1, Active = 2, Expired = 3, Terminated = 4, Renewed = 5 }

public enum PaymentCycle { Monthly = 1, Quarterly = 2, SemiAnnually = 3, Annually = 4 }

public enum TaxResponsibility { Landlord = 1, Tenant = 2 }         // ai chịu trách nhiệm đóng thuế

public enum DocumentType
{
    LandTitle = 1,            // Sổ đỏ / sổ hồng
    PurchaseContract = 2,     // HĐ mua bán
    LeaseContract = 3,        // HĐ thuê / cho thuê
    LeaseAppendix = 4,        // Phụ lục gia hạn
    AuthorizationContract = 5,// HĐ uỷ quyền
    ElectricityContract = 6,  // HĐ điện
    WaterContract = 7,        // HĐ nước
    TaxDocument = 8,          // Hồ sơ thuế
    Invoice = 9,              // Hoá đơn
    Other = 99
}

public enum EquipmentCondition { New = 1, Good = 2, Fair = 3, NeedRepair = 4, Broken = 5 }
public enum EquipmentSource { OwnerProvided = 1, FromLandlord = 2, SelfEquipped = 3 } // của chủ / nhận từ chủ nhà / trang bị thêm

public enum CashFlowDirection { Income = 1, Expense = 2 }

public enum CashFlowCategory
{
    // Thu
    RentIncome = 1,               // tiền cho thuê
    DepositReceived = 2,
    SaleProceeds = 3,
    // Chi
    RentExpense = 10,             // tiền thuê trả chủ nhà
    DepositPaid = 11,
    MaintenanceCost = 12,         // sửa chữa / cải tạo
    ElectricityBill = 13,
    WaterBill = 14,
    InternetBill = 15,
    ManagementFee = 16,
    // Thuế (giữ trong cùng sổ cái để báo cáo tổng thuế theo năm)
    RegistrationTax = 20,         // thuế trước bạ
    NonAgriculturalLandTax = 21,  // thuế phi nông nghiệp
    BusinessLicenseTax = 22,      // thuế môn bài (~1tr/năm)
    PersonalIncomeTax = 23,       // TNCN 5% giá cho thuê
    ValueAddedTax = 24,           // GTGT 5% giá cho thuê
    OtherTax = 29,
    Other = 99
}

public enum ReminderType
{
    RentCollection = 1,   // nhắc thu tiền (LeaseOut)
    RentPayment = 2,      // nhắc đóng tiền cho chủ nhà (LeaseIn)
    Maintenance = 3,
    ContractExpiry = 4,   // hết hạn HĐ, cần tái ký / phụ lục
    TaxDue = 5,
    UtilityPayment = 6    // điện, nước khi cho thuê theo tầng/phòng
}

public enum RecurrenceCycle { None = 0, Monthly = 1, Quarterly = 2, Annually = 3 }

public enum ContactType { Tenant = 1, Landlord = 2, Broker = 3, Vendor = 4, Other = 99 }

public enum SaleListingStatus { Active = 1, Paused = 2, Sold = 3, Cancelled = 4 }
```

> **Lưu enum kiểu gì trong PostgreSQL?** Mặc định EF map enum → `integer`: nhỏ, index nhanh, đổi tên enum trong code không cần migration. Nếu team ưu tiên đọc dữ liệu trực tiếp bằng SQL, có thể bật `HasConversion<string>()` — đánh đổi kích thước index. Khuyến nghị: **giữ int**, và coi giá trị số của enum là hợp đồng bất biến (không bao giờ đổi số, chỉ thêm mới).

### 2.4. Aggregate Root — `Asset` (refactor từ `UserAsset`)

```csharp
public class Asset : BaseAuditableEntity
{
    [Required] public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    [Required, MaxLength(255)] public string Name { get; set; } = string.Empty;
    public AssetType Type { get; set; }
    public AssetOwnershipType OwnershipType { get; set; } = AssetOwnershipType.Owned;
    public AssetStatus Status { get; set; } = AssetStatus.InUse;

    public Address Address { get; set; } = new();          // Value Object
    public double? Area { get; set; }                       // m²

    [Column(TypeName = "decimal(18,2)")] public decimal? CurrentValue { get; set; } // giá trị hiện tại
    public DateTime? AcquisitionDate { get; set; }          // ngày mua (Owned) / ngày bắt đầu thuê (Leasehold)

    public StoredFile? Thumbnail { get; set; }              // thay ThumbnailUrl
    public string? Notes { get; set; }

    // Liên kết tin đăng công khai — giữ nguyên từ UserAsset
    public int? LinkedPropertyId { get; set; }
    public Property? LinkedProperty { get; set; }

    // Navigations
    public ICollection<AssetUnit> Units { get; set; } = new List<AssetUnit>();
    public ICollection<AssetMedia> Media { get; set; } = new List<AssetMedia>();
    public ICollection<AssetDocument> Documents { get; set; } = new List<AssetDocument>();
    public ICollection<LeaseContract> Contracts { get; set; } = new List<LeaseContract>();
    public ICollection<Equipment> Equipments { get; set; } = new List<Equipment>();
    public ICollection<MaintenanceRecord> MaintenanceRecords { get; set; } = new List<MaintenanceRecord>();
    public ICollection<CashFlowEntry> CashFlows { get; set; } = new List<CashFlowEntry>();
    public ICollection<UsagePeriod> UsagePeriods { get; set; } = new List<UsagePeriod>();
    public SaleListing? SaleListing { get; set; }
}
```

### 2.5. Các Entity con

```csharp
// Tầng / phòng — phục vụ "cho thuê lại từng tầng/phòng"
public class AssetUnit : BaseAuditableEntity
{
    public Guid AssetId { get; set; }
    public Asset Asset { get; set; } = null!;

    [Required, MaxLength(100)] public string Name { get; set; } = string.Empty; // "Tầng 2", "Phòng 301"
    public int? FloorNumber { get; set; }
    public double? Area { get; set; }
    public UnitStatus Status { get; set; } = UnitStatus.Vacant;
    public string? Notes { get; set; }
}
```

```csharp
// Hình ảnh theo thời gian
public class AssetMedia : BaseAuditableEntity
{
    public Guid AssetId { get; set; }
    public Asset Asset { get; set; } = null!;

    public StoredFile File { get; set; } = new();   // Url + PublicId
    [MaxLength(500)] public string? Caption { get; set; }
    public DateTime TakenAt { get; set; }            // "hình ảnh theo thời gian"
    public int SortOrder { get; set; }
}
```

```csharp
// Giấy tờ pháp lý & hợp đồng dịch vụ
public class AssetDocument : BaseAuditableEntity
{
    public Guid AssetId { get; set; }
    public Asset Asset { get; set; } = null!;

    public DocumentType Type { get; set; }
    [Required, MaxLength(255)] public string Title { get; set; } = string.Empty;
    public StoredFile File { get; set; } = new();

    public DateTime? IssueDate { get; set; }
    public DateTime? ExpiryDate { get; set; }        // HĐ điện/nước/thuê có thời hạn
    public string? Notes { get; set; }

    // Phụ lục / HĐ thuê gắn với hợp đồng cụ thể
    public Guid? LeaseContractId { get; set; }
    public LeaseContract? LeaseContract { get; set; }
}
```

```csharp
// Đối tác: người thuê, chủ nhà, môi giới, nhà thầu
public class ContactParty : BaseAuditableEntity
{
    [Required] public string UserId { get; set; } = string.Empty;  // sổ địa chỉ riêng của từng user
    public ApplicationUser User { get; set; } = null!;

    public ContactType Type { get; set; }
    [Required, MaxLength(255)] public string FullName { get; set; } = string.Empty;
    [MaxLength(20)]  public string? Phone { get; set; }
    [MaxLength(255)] public string? Email { get; set; }
    [MaxLength(20)]  public string? IdNumber { get; set; }         // CCCD — cân nhắc mã hoá cột nếu yêu cầu bảo mật cao
    public string? Notes { get; set; }
}
```

```csharp
// Hợp đồng thuê — MỘT bảng cho cả hai chiều
public class LeaseContract : BaseAuditableEntity
{
    public Guid AssetId { get; set; }
    public Asset Asset { get; set; } = null!;

    public Guid? AssetUnitId { get; set; }           // null = nguyên căn; có giá trị = theo tầng/phòng
    public AssetUnit? AssetUnit { get; set; }

    public ContractDirection Direction { get; set; } // LeaseOut: user cho thuê | LeaseIn: user đi thuê
    public ContractStatus Status { get; set; } = ContractStatus.Draft;

    public Guid CounterpartyId { get; set; }         // LeaseOut → người thuê; LeaseIn → chủ nhà
    public ContactParty Counterparty { get; set; } = null!;

    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    [Column(TypeName = "decimal(18,2)")] public decimal RentAmount { get; set; }
    public PaymentCycle PaymentCycle { get; set; } = PaymentCycle.Monthly;
    public int PaymentDueDay { get; set; } = 1;      // ngày thanh toán trong kỳ (1–31)
    [Column(TypeName = "decimal(18,2)")] public decimal? DepositAmount { get; set; }
    public DateTime? NextRentIncreaseDate { get; set; }  // "thời gian tăng giá tiếp theo"
    public TaxResponsibility TaxResponsibility { get; set; } = TaxResponsibility.Landlord;

    // Chuỗi gia hạn: HĐ mới / phụ lục trỏ về HĐ gốc → "lịch sử cho thuê" tự nhiên
    public Guid? ParentContractId { get; set; }
    public LeaseContract? ParentContract { get; set; }

    public string? Notes { get; set; }
    public ICollection<AssetDocument> Documents { get; set; } = new List<AssetDocument>();
}
```

```csharp
// Trang thiết bị
public class Equipment : BaseAuditableEntity
{
    public Guid AssetId { get; set; }
    public Asset Asset { get; set; } = null!;
    public Guid? AssetUnitId { get; set; }
    public AssetUnit? AssetUnit { get; set; }

    [Required, MaxLength(255)] public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public EquipmentCondition Condition { get; set; } = EquipmentCondition.Good;
    public EquipmentSource Source { get; set; } = EquipmentSource.OwnerProvided;
    public string? Notes { get; set; }
}
```

```csharp
// Lịch sử sửa chữa / cải tạo
public class MaintenanceRecord : BaseAuditableEntity
{
    public Guid AssetId { get; set; }
    public Asset Asset { get; set; } = null!;
    public Guid? AssetUnitId { get; set; }
    public AssetUnit? AssetUnit { get; set; }

    [Required, MaxLength(255)] public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? CompletedDate { get; set; }
    [Column(TypeName = "decimal(18,2)")] public decimal? Cost { get; set; }

    public Guid? VendorId { get; set; }              // nhà thầu (ContactParty.Type = Vendor)
    public ContactParty? Vendor { get; set; }
    public string? Notes { get; set; }
}
```

```csharp
// SỔ CÁI THU/CHI — trái tim của mọi báo cáo (thu nhập, lợi nhuận, thuế)
public class CashFlowEntry : BaseAuditableEntity
{
    // Denormalize UserId: báo cáo tổng hợp toàn bộ tài sản của user
    // không phải JOIN qua Assets — quyết định có chủ đích (xem Phần 3)
    [Required] public string UserId { get; set; } = string.Empty;

    public Guid AssetId { get; set; }
    public Asset Asset { get; set; } = null!;
    public Guid? AssetUnitId { get; set; }
    public AssetUnit? AssetUnit { get; set; }
    public Guid? LeaseContractId { get; set; }       // tiền thuê gắn với HĐ nào
    public LeaseContract? LeaseContract { get; set; }

    public CashFlowDirection Direction { get; set; }
    public CashFlowCategory Category { get; set; }
    [Column(TypeName = "decimal(18,2)")] public decimal Amount { get; set; }  // luôn dương, Direction quyết định dấu
    public DateTime OccurredAt { get; set; }
    public DateTime? PeriodStart { get; set; }       // kỳ mà khoản tiền này chi trả (VD: tiền thuê T7/2026)
    public DateTime? PeriodEnd { get; set; }

    [MaxLength(500)] public string? Description { get; set; }
    public StoredFile? Receipt { get; set; }         // hoá đơn / biên lai đính kèm
}
```

```csharp
// Nhắc lịch
public class Reminder : BaseAuditableEntity
{
    [Required] public string UserId { get; set; } = string.Empty; // denormalize — job quét theo user
    public Guid? AssetId { get; set; }
    public Asset? Asset { get; set; }
    public Guid? LeaseContractId { get; set; }
    public LeaseContract? LeaseContract { get; set; }

    public ReminderType Type { get; set; }
    [Required, MaxLength(255)] public string Title { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }            // lần đến hạn KẾ TIẾP
    public RecurrenceCycle Cycle { get; set; } = RecurrenceCycle.None;
    public int NotifyDaysBefore { get; set; } = 3;
    public bool IsActive { get; set; } = true;
    public DateTime? LastNotifiedAt { get; set; }
}
```

```csharp
// Lịch sử sử dụng (bản thân / con cái / người quen)
public class UsagePeriod : BaseAuditableEntity
{
    public Guid AssetId { get; set; }
    public Asset Asset { get; set; } = null!;

    public OccupantType OccupantType { get; set; }
    [MaxLength(255)] public string? OccupantName { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }           // null = đang sử dụng
    public string? Notes { get; set; }
}
```

```csharp
// Rao bán
public class SaleListing : BaseAuditableEntity
{
    public Guid AssetId { get; set; }                // 1–1 với Asset
    public Asset Asset { get; set; } = null!;

    [Column(TypeName = "decimal(18,2)")] public decimal AskingPrice { get; set; }
    public SaleListingStatus Status { get; set; } = SaleListingStatus.Active;
    public DateTime ListedAt { get; set; }
    public string? AgreementNotes { get; set; }      // "các thoả thuận khác"

    public ICollection<SaleListingBroker> Brokers { get; set; } = new List<SaleListingBroker>();
}

// N–N có payload: môi giới đã gửi
public class SaleListingBroker
{
    public Guid SaleListingId { get; set; }
    public SaleListing SaleListing { get; set; } = null!;
    public Guid BrokerId { get; set; }               // ContactParty.Type = Broker
    public ContactParty Broker { get; set; } = null!;

    public DateTime SentAt { get; set; }
    public string? Notes { get; set; }
}
```

### 2.6. Fluent API — quan hệ, ràng buộc, index

```csharp
public class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> b)
    {
        b.ToTable("Assets");

        b.OwnsOne(a => a.Address, addr =>
        {
            addr.Property(x => x.City).HasColumnName("City").HasMaxLength(100).IsRequired();
            addr.Property(x => x.District).HasColumnName("District").HasMaxLength(100).IsRequired();
            addr.Property(x => x.Ward).HasColumnName("Ward").HasMaxLength(100).IsRequired();
            addr.Property(x => x.Detail).HasColumnName("AddressDetail").HasMaxLength(500);
            addr.Property(x => x.Latitude).HasColumnName("Latitude");
            addr.Property(x => x.Longitude).HasColumnName("Longitude");
        });
        b.Navigation(a => a.Address).IsRequired();

        b.OwnsOne(a => a.Thumbnail);                 // Thumbnail_Url, Thumbnail_PublicId...

        b.HasOne(a => a.User)
         .WithMany()
         .HasForeignKey(a => a.UserId)
         .OnDelete(DeleteBehavior.Cascade);          // xoá user → xoá tài sản riêng tư của họ

        b.HasOne(a => a.LinkedProperty)
         .WithMany()
         .HasForeignKey(a => a.LinkedPropertyId)
         .OnDelete(DeleteBehavior.SetNull);          // xoá tin đăng KHÔNG xoá tài sản

        b.HasOne(a => a.SaleListing)
         .WithOne(s => s.Asset)
         .HasForeignKey<SaleListing>(s => s.AssetId);

        // Index cho các truy vấn nóng nhất
        b.HasIndex(a => a.UserId);
        b.HasIndex(a => new { a.UserId, a.Status });
        b.HasIndex(a => new { a.UserId, a.Type });
    }
}
```

```csharp
public class LeaseContractConfiguration : IEntityTypeConfiguration<LeaseContract>
{
    public void Configure(EntityTypeBuilder<LeaseContract> b)
    {
        b.ToTable("LeaseContracts", t =>
        {
            t.HasCheckConstraint("CK_LeaseContract_Dates", "\"EndDate\" > \"StartDate\"");
            t.HasCheckConstraint("CK_LeaseContract_DueDay", "\"PaymentDueDay\" BETWEEN 1 AND 31");
            t.HasCheckConstraint("CK_LeaseContract_Rent", "\"RentAmount\" >= 0");
        });

        b.HasOne(c => c.Asset).WithMany(a => a.Contracts)
         .HasForeignKey(c => c.AssetId).OnDelete(DeleteBehavior.Cascade);

        b.HasOne(c => c.AssetUnit).WithMany()
         .HasForeignKey(c => c.AssetUnitId).OnDelete(DeleteBehavior.SetNull);

        b.HasOne(c => c.Counterparty).WithMany()
         .HasForeignKey(c => c.CounterpartyId)
         .OnDelete(DeleteBehavior.Restrict);         // không cho xoá contact còn dính hợp đồng

        b.HasOne(c => c.ParentContract).WithMany()
         .HasForeignKey(c => c.ParentContractId).OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(c => c.AssetId);
        b.HasIndex(c => new { c.Status, c.EndDate }); // job quét HĐ sắp hết hạn
        // Partial index PostgreSQL: chỉ index HĐ đang hiệu lực
        b.HasIndex(c => c.EndDate)
         .HasDatabaseName("IX_LeaseContracts_Active_EndDate")
         .HasFilter("\"Status\" = 2"); // ContractStatus.Active
    }
}
```

```csharp
public class CashFlowEntryConfiguration : IEntityTypeConfiguration<CashFlowEntry>
{
    public void Configure(EntityTypeBuilder<CashFlowEntry> b)
    {
        b.ToTable("CashFlowEntries", t =>
            t.HasCheckConstraint("CK_CashFlow_Amount", "\"Amount\" > 0"));

        b.OwnsOne(e => e.Receipt);

        b.HasOne(e => e.Asset).WithMany(a => a.CashFlows)
         .HasForeignKey(e => e.AssetId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.LeaseContract).WithMany()
         .HasForeignKey(e => e.LeaseContractId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(e => e.AssetUnit).WithMany()
         .HasForeignKey(e => e.AssetUnitId).OnDelete(DeleteBehavior.SetNull);

        // Ba index phục vụ ba dạng báo cáo trong tài liệu
        b.HasIndex(e => new { e.AssetId, e.OccurredAt });                 // báo cáo theo tài sản + khoảng thời gian
        b.HasIndex(e => new { e.UserId, e.OccurredAt });                  // tổng thu nhập theo thời gian tự chọn
        b.HasIndex(e => new { e.UserId, e.Category, e.OccurredAt });      // tổng thuế theo năm
    }
}
```

```csharp
public class ReminderConfiguration : IEntityTypeConfiguration<Reminder>
{
    public void Configure(EntityTypeBuilder<Reminder> b)
    {
        b.ToTable("Reminders");

        b.HasOne(r => r.Asset).WithMany()
         .HasForeignKey(r => r.AssetId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(r => r.LeaseContract).WithMany()
         .HasForeignKey(r => r.LeaseContractId).OnDelete(DeleteBehavior.Cascade);

        // Partial index: background job chỉ quét reminder đang bật, sắp đến hạn
        b.HasIndex(r => r.DueDate)
         .HasDatabaseName("IX_Reminders_Active_DueDate")
         .HasFilter("\"IsActive\" = TRUE");
        b.HasIndex(r => new { r.UserId, r.IsActive });
    }
}
```

```csharp
// Các cấu hình còn lại (rút gọn)
public class SaleListingBrokerConfiguration : IEntityTypeConfiguration<SaleListingBroker>
{
    public void Configure(EntityTypeBuilder<SaleListingBroker> b)
    {
        b.ToTable("SaleListingBrokers");
        b.HasKey(x => new { x.SaleListingId, x.BrokerId });  // khoá tổ hợp N–N
        b.HasOne(x => x.Broker).WithMany()
         .HasForeignKey(x => x.BrokerId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class AssetMediaConfiguration : IEntityTypeConfiguration<AssetMedia>
{
    public void Configure(EntityTypeBuilder<AssetMedia> b)
    {
        b.OwnsOne(m => m.File, f =>
            f.HasIndex(x => x.PublicId));            // tra ngược file Cloudinary → bản ghi
        b.HasIndex(m => new { m.AssetId, m.TakenAt });
    }
}

public class AssetDocumentConfiguration : IEntityTypeConfiguration<AssetDocument>
{
    public void Configure(EntityTypeBuilder<AssetDocument> b)
    {
        b.OwnsOne(d => d.File);
        b.HasIndex(d => new { d.AssetId, d.Type });
        b.HasIndex(d => d.ExpiryDate);               // quét giấy tờ sắp hết hạn
        b.HasOne(d => d.LeaseContract).WithMany(c => c.Documents)
         .HasForeignKey(d => d.LeaseContractId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class ContactPartyConfiguration : IEntityTypeConfiguration<ContactParty>
{
    public void Configure(EntityTypeBuilder<ContactParty> b)
    {
        b.HasIndex(c => new { c.UserId, c.Type });
        b.HasOne(c => c.User).WithMany()
         .HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
```

```csharp
// DbContext
public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public DbSet<Property> Properties => Set<Property>();
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<AssetUnit> AssetUnits => Set<AssetUnit>();
    public DbSet<AssetMedia> AssetMedia => Set<AssetMedia>();
    public DbSet<AssetDocument> AssetDocuments => Set<AssetDocument>();
    public DbSet<LeaseContract> LeaseContracts => Set<LeaseContract>();
    public DbSet<ContactParty> ContactParties => Set<ContactParty>();
    public DbSet<Equipment> Equipments => Set<Equipment>();
    public DbSet<MaintenanceRecord> MaintenanceRecords => Set<MaintenanceRecord>();
    public DbSet<CashFlowEntry> CashFlowEntries => Set<CashFlowEntry>();
    public DbSet<Reminder> Reminders => Set<Reminder>();
    public DbSet<UsagePeriod> UsagePeriods => Set<UsagePeriod>();
    public DbSet<SaleListing> SaleListings => Set<SaleListing>();
    public DbSet<SaleListingBroker> SaleListingBrokers => Set<SaleListingBroker>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
```

### 2.7. Dọn dẹp `Property` (khuyến nghị kèm theo)

Áp dụng cùng nguyên tắc cho bảng cũ, làm theo migration riêng để giảm rủi ro:

```csharp
public enum PropertyStatus { Pending = 1, Approved = 2, Rejected = 3, Sold = 4 }

// Trong Property: public PropertyStatus Status { get; set; } = PropertyStatus.Pending;
// Migration: chuyển đổi dữ liệu string cũ → int bằng câu UPDATE ... CASE WHEN trong Up().

// Thay List<string>? Img bằng bảng ảnh có PublicId:
public class PropertyImage : BaseAuditableEntity
{
    public int PropertyId { get; set; }
    public Property Property { get; set; } = null!;
    public StoredFile File { get; set; } = new();
    public int SortOrder { get; set; }
}
```

### 2.8. Chiến lược migration từ `UserAsset` → `Asset`

1. Tạo entity `Asset` mới + toàn bộ entity con, sinh migration.
2. Trong migration, dùng `migrationBuilder.RenameTable("UserAssets" → "Assets")` và `RenameColumn` cho các cột giữ nguyên ngữ nghĩa (`EstimatedValue` → `CurrentValue`, `ThumbnailUrl` → `Thumbnail_Url`).
3. Cột mới (`OwnershipType`, `City/District/Ward`…) thêm với giá trị mặc định; viết `UPDATE` tách `Address` cũ vào `AddressDetail`, các cột City/District/Ward tạm để trống cho user cập nhật dần (hoặc parse nếu dữ liệu có cấu trúc).
4. `Latitude/Longitude` string → double: `ALTER COLUMN ... TYPE double precision USING NULLIF(trim("Latitude"), '')::double precision`.
5. Chạy trên bản sao production trước, có script rollback.

---

## PHẦN 3 — ĐÁNH GIÁ MAINTAINABILITY & SCALABILITY

### 3.1. Vì sao tách bảng / gộp bảng như trên?

**Gộp hai loại hợp đồng vào một bảng `LeaseContract` (cột `Direction`).** Hai chiều thuê/cho thuê có cấu trúc dữ liệu giống nhau ~95% (giá, kỳ hạn, ngày thanh toán, đối tác, phụ lục). Tách hai bảng nghĩa là: hai bộ CRUD, hai bộ validation, mọi màn hình "lịch sử hợp đồng" và mọi reminder job phải UNION. Một bảng + enum `Direction` cho phép viết một service duy nhất, và câu hỏi "hợp đồng nào sắp hết hạn" là một query một index.

**Gộp toàn bộ thu/chi/thuế/hoá đơn vào một sổ cái `CashFlowEntry`.** Cả ba báo cáo trong tài liệu (tổng thu nhập theo thời gian, tổng lợi nhuận theo tài sản, tổng thuế theo năm) đều là `GROUP BY` trên đúng một bảng với bộ lọc `Category`/`Direction`. Nếu tách bảng `Tax`, `UtilityBill`, `RentPayment` riêng, báo cáo lợi nhuận buộc phải join/union 4–5 bảng và mỗi loại chi phí mới phát sinh là một migration mới. Đây là mô hình ledger kinh điển của các hệ ERP.

**Tách `AssetUnit` thay vì nhét "tên phòng" vào hợp đồng.** Phòng/tầng là thực thể có vòng đời riêng (diện tích, trạng thái trống/đang thuê, thiết bị theo phòng, nhiều hợp đồng nối tiếp trên cùng một phòng). Nhét vào hợp đồng sẽ mất lịch sử theo phòng và không trả lời được "phòng nào đang trống".

**Tách `ContactParty` thay vì lưu tên/SĐT người thuê trong hợp đồng.** Một người thuê có thể xuất hiện ở nhiều hợp đồng (gia hạn), một môi giới được gửi nhiều tài sản. Denormalize thông tin liên hệ vào hợp đồng sẽ nhân bản dữ liệu và không sửa được SĐT ở một chỗ.

**Tách `AssetDocument` khỏi `AssetMedia`.** Ảnh là timeline hiển thị gallery (query theo `TakenAt`), giấy tờ là hồ sơ pháp lý có loại, ngày hết hạn, gắn hợp đồng — hai access pattern khác hẳn nhau, gộp chung sẽ tạo bảng "cái gì cũng nullable".

**`StoredFile` là owned type, không phải bảng `Files` trung tâm.** File luôn thuộc về đúng một bản ghi cha, không chia sẻ; owned type loại bỏ một join và một FK ở mọi truy vấn, đồng thời xoá bản ghi cha là có ngay `PublicId` để gọi `DeletePhotoAsync` (nên làm qua background job + outbox để tránh mất đồng bộ khi Cloudinary lỗi tạm thời).

**Denormalize `UserId` vào `CashFlowEntry` và `Reminder` (có chủ đích).** Báo cáo tổng hợp toàn danh mục và job quét reminder là hai truy vấn nóng nhất hệ thống; thêm một cột 36 byte để mọi truy vấn đó khỏi join qua `Assets` là đánh đổi rẻ. Ràng buộc nhất quán được đảm bảo ở tầng service (UserId luôn gán từ Asset cha).

### 3.2. Điểm thắt cổ chai khi dữ liệu lên hàng triệu dòng & cách phòng ngừa

**1. `CashFlowEntries` — bảng phình nhanh nhất** (mỗi tài sản cho thuê sinh ~15–30 dòng/năm, nhân hàng trăm nghìn user).
- Ba composite index ở 2.6 đã phủ các báo cáo; nhờ prefix `UserId`/`AssetId`, mọi query đều index-seek trong phạm vi một user, không bao giờ scan toàn bảng.
- Khi vượt ~50–100 triệu dòng: **declarative partitioning theo RANGE (`OccurredAt`)** theo năm/quý — báo cáo "theo thời gian tự chọn" được partition pruning tự động; dữ liệu cũ có thể detach sang cold storage. Lưu ý EF Core không tự tạo partition — quản lý bằng raw SQL trong migration.
- Dashboard tổng quan ("tổng thu nhập năm nay") không nên tính realtime từ ledger: dùng **bảng tổng hợp tháng** (`AssetMonthlyStat`: AssetId, Year, Month, TotalIncome, TotalExpense, TotalTax) cập nhật bằng background job hoặc materialized view `REFRESH CONCURRENTLY` — đọc dashboard từ đây, chỉ drill-down mới chạm ledger.

**2. Job quét `Reminders` và hợp đồng sắp hết hạn.** Quét kiểu `WHERE DueDate <= now + interval` trên bảng lớn sẽ chậm dần. Partial index `WHERE IsActive = TRUE` (đã khai báo) giữ index nhỏ đúng bằng tập đang hoạt động. Job (Hangfire/Quartz) chạy theo cửa sổ thời gian + đánh dấu `LastNotifiedAt` để idempotent; khi scale nhiều instance, khoá bằng `SELECT ... FOR UPDATE SKIP LOCKED`.

**3. N+1 và over-fetching ở màn chi tiết tài sản.** `Asset` có ~10 collection — tuyệt đối không `Include` tất cả. Màn danh sách dùng projection (`Select` vào DTO, `AsNoTracking`); màn chi tiết load từng tab theo yêu cầu (lazy theo UI, không lazy-loading proxy). Phân trang mọi danh sách con bằng **keyset pagination** (`WHERE (OccurredAt, Id) < (@lastOccurredAt, @lastId) ORDER BY ... LIMIT n`) thay vì `OFFSET` — OFFSET ở trang sâu là bottleneck kinh điển.

**4. Ảnh/giấy tờ mồ côi trên Cloudinary.** Xoá bản ghi thành công nhưng gọi `DeletePhotoAsync` thất bại → rác trên Cloudinary tốn tiền. Giải pháp: bảng `FileDeletionQueue` (outbox) — transaction xoá bản ghi ghi kèm PublicId vào queue, background job xử lý và retry.

**5. Connection & caching.** PostgreSQL chịu kém khi connection nhiều: bật connection pooling (Npgsql mặc định) và cân nhắc **PgBouncer** khi scale ngang API. Cache Redis cho dữ liệu ít đổi (danh mục, tỷ lệ thuế theo khu vực, dashboard đã tổng hợp) với invalidation theo sự kiện ghi.

**6. Chuẩn bị cho tính năng "dự đoán giá theo thị trường".** Đây là truy vấn theo vị trí — khi làm tới, bật extension **PostGIS**, đổi `Latitude/Longitude` sang cột `geography(Point)` + GiST index (lý do đã chuyển lat/lng sang `double` ngay từ bây giờ: chuyển đổi sau này chỉ là một câu `ALTER`).

### 3.3. Thứ tự triển khai đề xuất

1. Migration refactor `UserAsset` → `Asset` + `BaseAuditableEntity` + interceptor.
2. `AssetMedia`, `AssetDocument`, `StoredFile` + mở rộng `IPhotoService` (raw upload, trả PublicId).
3. `ContactParty`, `LeaseContract`, `AssetUnit` (lõi nghiệp vụ thuê/cho thuê).
4. `CashFlowEntry` + màn ghi thu/chi + 3 báo cáo.
5. `Reminder` + Hangfire job + push notification.
6. `Equipment`, `MaintenanceRecord`, `UsagePeriod`, `SaleListing`.
7. Tối ưu: bảng tổng hợp tháng, partitioning (chỉ khi số liệu thật yêu cầu).
