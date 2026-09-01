# KẾ HOẠCH TRIỂN KHAI MODULE QUẢN LÝ TÀI SẢN
## (Spatial PostGIS · Feature Plan · Service/Repository · API)

---

## PHẦN 0 — QUYẾT ĐỊNH SPATIAL: `geography(Point, 4326)` + NetTopologySuite

### 0.1. Làm rõ về độ chính xác

`double` (float8) có 15–17 chữ số có nghĩa. Toạ độ `10.807959` chỉ có 8 chữ số — được biểu diễn
chính xác đến mức sai số (nếu có) < 10⁻⁹ độ ≈ **0.1 mm** trên mặt đất. Bản thân PostGIS cũng lưu
mỗi toạ độ của `Point` bằng double bên trong. Vì vậy độ chính xác **không** phải lý do chọn PostGIS.

### 0.2. Lý do thật sự để chọn PostGIS ngay từ đầu

1. **GiST spatial index**: "tìm tài sản trong bán kính 2km" chạy bằng index (`ST_DWithin`),
   không scan toàn bảng tính haversine thủ công.
2. **Kiểu `geography`** tính khoảng cách trắc địa **theo mét** trên mặt cầu — đúng ngữ nghĩa
   cho ứng dụng bản đồ, không cần tự viết công thức.
3. **EF Core hỗ trợ hạng nhất** qua NetTopologySuite: `Location.Distance(point)`,
   `Location.IsWithinDistance(point, meters)` dịch thẳng sang SQL PostGIS.
4. Mở đường cho tính năng "dự đoán giá theo thị trường" (so sánh tài sản lân cận).

### 0.3. Thay đổi trên Domain

```csharp
// Asset.cs — BỎ Latitude/Longitude khỏi Address, thay bằng:
using NetTopologySuite.Geometries;

public Point? Location { get; set; }   // SRID 4326. LƯU Ý: X = Longitude, Y = Latitude!
```

```csharp
// AssetConfiguration.cs — thêm:
b.Property(a => a.Location).HasColumnType("geography (point, 4326)");
b.HasIndex(a => a.Location).HasMethod("gist");   // spatial index
```

> ⚠️ **Gotcha kinh điển:** NTS `Point(x, y)` = `Point(longitude, latitude)`. Đảo ngược sẽ ra
> toạ độ giữa Ấn Độ Dương. Mọi chuyển đổi DTO→Point đi qua một helper duy nhất (xem AssetService).

### 0.4. Cài đặt

```bash
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL.NetTopologySuite
# PostgreSQL: CREATE EXTENSION IF NOT EXISTS postgis;
```

```csharp
// Program.cs
builder.Services.AddDbContext<ApplicationDbContext>((sp, opt) =>
    opt.UseNpgsql(connStr, o => o.UseNetTopologySuite())
       .AddInterceptors(sp.GetRequiredService<AuditableEntityInterceptor>()));

builder.Services.AddSingleton(NtsGeometryServices.Instance.CreateGeometryFactory(srid: 4326));
```

```csharp
// Migration (nếu chưa bật extension bằng tay):
migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS postgis;");
```

### 0.5. Migration dữ liệu từ cột string cũ

```sql
ALTER TABLE "Assets" ADD COLUMN "Location" geography(Point, 4326);

UPDATE "Assets"
SET "Location" = ST_SetSRID(
        ST_MakePoint(
            NULLIF(trim("Longitude"), '')::float8,   -- X = lng
            NULLIF(trim("Latitude"),  '')::float8),  -- Y = lat
        4326)::geography
WHERE NULLIF(trim("Longitude"), '') IS NOT NULL
  AND NULLIF(trim("Latitude"),  '') IS NOT NULL;

CREATE INDEX "IX_Assets_Location" ON "Assets" USING gist ("Location");
ALTER TABLE "Assets" DROP COLUMN "Latitude", DROP COLUMN "Longitude";
```

> Áp dụng tương tự cho `Property` khi bạn refactor bảng đó.

### 0.6. Bổ sung enum (so với bản thiết kế trước)

```csharp
public enum RecurrenceCycle { None = 0, Monthly = 1, Quarterly = 2, SemiAnnually = 3, Annually = 4 }
```

---

## PHẦN 1 — KẾ HOẠCH CHỨC NĂNG (FEATURE PLAN)

Chia 4 nhóm, đánh số theo thứ tự triển khai. Mỗi luồng đều đã có Service + Endpoint trong bộ code kèm theo.

### Nhóm A — Nền tảng tài sản (tuần 1–2)

| # | Luồng chức năng | Service | Endpoint chính |
|---|---|---|---|
| A1 | CRUD tài sản + tìm kiếm/lọc/phân trang | `AssetService` | `POST/GET/PUT/DELETE /api/assets` |
| A2 | Tìm tài sản lân cận theo bán kính (PostGIS) | `AssetService.FindNearbyAsync` | `GET /api/assets/nearby` |
| A3 | Liên kết / gỡ liên kết tin đăng `Property` | `AssetService` | `POST/DELETE /api/assets/{id}/link-property` |
| A4 | Ảnh theo thời gian: upload, gallery, xoá, đặt thumbnail | `AssetMediaService` | `/api/assets/{id}/media`, `/thumbnail` |
| A5 | Giấy tờ: upload (raw), danh sách, xoá, giấy tờ sắp hết hạn | `AssetDocumentService` | `/api/assets/{id}/documents`, `/api/documents/expiring` |
| A6 | Tầng/phòng (AssetUnit) CRUD | `AssetUnitService` | `/api/assets/{assetId}/units` |

### Nhóm B — Thuê & Cho thuê (tuần 3–4)

| # | Luồng chức năng | Service | Endpoint chính |
|---|---|---|---|
| B1 | Sổ đối tác: người thuê / chủ nhà / môi giới / nhà thầu | `ContactPartyService` | `/api/contacts` |
| B2 | Tạo hợp đồng (LeaseIn/LeaseOut, nguyên căn/tầng/phòng) — validate trùng kỳ hạn, tự cập nhật trạng thái Asset/Unit, **tự sinh reminder** thu/đóng tiền + hết hạn HĐ | `LeaseContractService.CreateAsync` | `POST /api/contracts` |
| B3 | Gia hạn (phụ lục — chuỗi `ParentContractId`) / Chấm dứt HĐ | `RenewAsync`, `TerminateAsync` | `POST /api/contracts/{id}/renew`, `/terminate` |
| B4 | Danh sách HĐ sắp hết hạn (cần tái ký) | `GetExpiringAsync` | `GET /api/contracts/expiring?days=` |
| B5 | Lịch sử hợp đồng theo tài sản / theo phòng | `SearchAsync` | `GET /api/contracts?assetId=&unitId=` |

### Nhóm C — Tài chính & Báo cáo (tuần 5–6)

| # | Luồng chức năng | Service | Endpoint chính |
|---|---|---|---|
| C1 | Ghi thu/chi (tiền thuê, thuế, hoá đơn điện/nước, sửa chữa) kèm biên lai Cloudinary; danh sách **keyset pagination** | `CashFlowService` | `POST/GET/DELETE /api/cashflows` |
| C2 | Báo cáo tổng thu nhập cho thuê theo khoảng thời gian tự chọn (group theo tháng) | `ReportService.GetIncomeReportAsync` | `GET /api/reports/income` |
| C3 | Báo cáo lợi nhuận theo tài sản (thu − chi, breakdown theo loại) | `GetProfitReportAsync` | `GET /api/reports/profit` |
| C4 | Báo cáo tổng thuế phải nộp theo năm (theo từng loại thuế) | `GetTaxReportAsync` | `GET /api/reports/tax` |

### Nhóm D — Vận hành & Nhắc lịch (tuần 7–8)

| # | Luồng chức năng | Service | Endpoint chính |
|---|---|---|---|
| D1 | Reminder CRUD + danh sách sắp đến hạn | `ReminderService` | `/api/reminders`, `/api/reminders/upcoming` |
| D2 | Background job quét reminder đến hạn → gửi thông báo → tự nhảy kỳ (Monthly/Quarterly/…) | `ReminderProcessingJob` (Hangfire recurring) | — |
| D3 | Lịch sử sửa chữa / cải tạo | `MaintenanceService` | `/api/assets/{assetId}/maintenance` |
| D4 | Trang thiết bị (của chủ / nhận từ chủ nhà / trang bị thêm) | `EquipmentService` | `/api/assets/{assetId}/equipment` |
| D5 | Lịch sử sử dụng (bản thân/con cái/người quen) | `UsagePeriodService` | `/api/assets/{assetId}/usage-periods` |
| D6 | Rao bán: tạo listing, gửi môi giới, đánh dấu đã bán | `SaleListingService` | `/api/assets/{assetId}/sale-listing` |
| D7 | Job dọn file Cloudinary (outbox `FileDeletionQueue`) | `FileCleanupJob` (Hangfire) | — |

Chức năng "dự đoán giá theo thị trường" để giai đoạn 2 (cần dữ liệu Property + PostGIS đã sẵn sàng từ bây giờ).

---

## PHẦN 2 — CẤU TRÚC CODE BÀN GIAO

```
src/
├── Common/Common.cs                 # Exceptions, ICurrentUserService, PagedResult, Middleware
├── Repositories/Repositories.cs     # IRepository<T>, EfRepository<T>, IUnitOfWork
├── Storage/FileStorage.cs           # IFileStorageService (Cloudinary image+raw), FileDeletionQueue, FileCleanupJob
├── Dtos/Dtos.cs                     # Toàn bộ DTO (record) theo từng nhóm
├── Services/
│   ├── AssetService.cs              # A1–A3
│   ├── MediaDocumentServices.cs     # A4–A5
│   ├── LeaseContractService.cs      # B2–B5 (+ tự sinh reminder)
│   ├── FinanceServices.cs           # C1–C4 (CashFlow + Report)
│   ├── ReminderServices.cs          # D1–D2 (+ INotificationSender)
│   └── OperationsServices.cs        # A6, B1, D3–D6
└── Controllers/
    ├── AssetsController.cs          # Assets, Media, Documents, Units
    ├── LeasingControllers.cs        # Contacts, Contracts
    ├── FinanceControllers.cs        # CashFlows, Reports
    └── OperationsControllers.cs     # Reminders, Equipment, Maintenance, Usage, SaleListing
```

### Đăng ký DI (Program.cs)

```csharp
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<AuditableEntityInterceptor>();

builder.Services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
builder.Services.AddScoped<IUnitOfWork, EfUnitOfWork>();

builder.Services.AddSingleton(new Cloudinary(new Account(cloud, key, secret)));
builder.Services.AddScoped<IFileStorageService, CloudinaryFileStorageService>();

builder.Services.AddScoped<IAssetService, AssetService>();
builder.Services.AddScoped<IAssetMediaService, AssetMediaService>();
builder.Services.AddScoped<IAssetDocumentService, AssetDocumentService>();
builder.Services.AddScoped<IAssetUnitService, AssetUnitService>();
builder.Services.AddScoped<IContactPartyService, ContactPartyService>();
builder.Services.AddScoped<ILeaseContractService, LeaseContractService>();
builder.Services.AddScoped<ICashFlowService, CashFlowService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IReminderService, ReminderService>();
builder.Services.AddScoped<IEquipmentService, EquipmentService>();
builder.Services.AddScoped<IMaintenanceService, MaintenanceService>();
builder.Services.AddScoped<IUsagePeriodService, UsagePeriodService>();
builder.Services.AddScoped<ISaleListingService, SaleListingService>();
builder.Services.AddScoped<INotificationSender, LoggingNotificationSender>(); // thay bằng FCM/APNs sau

app.UseMiddleware<DomainExceptionMiddleware>();

// Hangfire (khuyến nghị):
RecurringJob.AddOrUpdate<ReminderProcessingJob>("reminders", j => j.RunAsync(CancellationToken.None), "*/15 * * * *");
RecurringJob.AddOrUpdate<FileCleanupJob>("file-cleanup", j => j.RunAsync(CancellationToken.None), "*/30 * * * *");
```

### Ghi chú quan trọng

1. **UTC**: Npgsql map `DateTime` → `timestamptz` và yêu cầu `Kind = Utc`. Mọi DateTime từ client
   nên chuẩn hoá `DateTime.SpecifyKind(x, DateTimeKind.Utc)` ở DTO binding hoặc trong service.
2. **DbSet bổ sung** vào `ApplicationDbContext`: `DbSet<FileDeletionQueueItem> FileDeletionQueue`.
3. **Bảo mật đa người dùng**: mọi service đều lọc theo `ICurrentUserService.UserId` — user không
   bao giờ đọc/ghi được tài sản của user khác (kiểm tra ở tầng service, không tin client).
4. Namespace mẫu là `RealEstate.AssetManagement.*` — đổi theo solution của bạn.
