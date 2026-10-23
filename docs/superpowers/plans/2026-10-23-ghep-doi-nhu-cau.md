# Ghép đôi hai chiều — "Đăng nhu cầu, chủ nhà sẽ mời bạn": Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm cho ghép đôi hai chiều được nhìn thấy và dùng được: người tìm đăng nhu cầu trong 1–2 bấm từ 5 lối vào, chủ nhà thấy cầu thật (Nhịp cầu), được báo khi tin vừa duyệt, mời cả nhu cầu gần khớp theo giá và kèm ưu đãi riêng.

**Architecture:** Nhu cầu vẫn là `SavedSearch` với `DiscoverableByOwners`. Logic mới nằm trong 4 quy tắc thuần ở `Domain/Rules` (`DemandExpiry`, `DemandPulse`, `NearMatch`, `InvitationOffer`) có test xUnit; service chỉ đọc CSDL rồi gọi quy tắc. Nhịp cầu chỉ đếm nhu cầu trong bộ nhớ, đệm 10 phút; báo khi duyệt chạy bằng Hangfire. Giao diện thêm hộp `PostDemandDialog` dùng chung, route `/nhu-cau`, và các thẻ Nhịp cầu.

**Tech Stack:** ASP.NET Core 8, EF Core 8 + Npgsql/PostGIS, Hangfire, xUnit · React 19, TanStack Router/Query, Vitest, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-10-22-ghep-doi-nhu-cau-design.md`

## Global Constraints

- Nhánh `feat/ghep-doi-nhu-cau`. Commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; không viết lại lịch sử đã đẩy.
- Không tắt máy chủ của người dùng ở cổng 7129 (API) và 8081 (web). Nếu `bin/` bị khoá khi build/test, chạy `dotnet test -c Release` thay vì dừng tiến trình.
- Không đưa khoá bí mật vào git; không deploy AWS.
- Chữ trên giao diện: tiếng Việt phổ thông, không thuật ngữ (theo PR #73). Tên test xUnit: tiếng Việt không dấu kiểu `MacDinh_TheoLyDoBao`, namespace `kgs_api.Tests`.
- Ngưỡng ẩn danh Nhịp cầu: **3 người khác nhau**. Đệm Nhịp cầu: **10 phút**.
- Hạn chế độ mở: **30 ngày**; nhắc **một lần** khi còn **≤ 3 ngày**; gia hạn = **bây giờ + 30 ngày**.
- `Occupants`: **1–20**. Gần khớp theo giá: vượt trần **không quá 10%**. `OfferNote` ≤ **120** ký tự; `OfferPrice` > 0 và < giá niêm yết. Lời nhắn nhu cầu ≤ **300** ký tự.
- Khoảng giá thuê: dưới 3 tr · 3–5 tr · 5–10 tr · 10–20 tr · trên 20 tr. Mua: dưới 2 tỷ · 2–5 tỷ · 5–10 tỷ · 10–20 tỷ · trên 20 tỷ.
- Không đường chờ nào của người dùng chạy so khớp hàng loạt (ngoài `/nhu-cau`: ≤ 20 nhu cầu của chính họ).

## Review Focus

1. **Nhu cầu đã hết hạn vẫn lộ ra cho chủ nhà hoặc vẫn được đếm trong Nhịp cầu** trước khi job 08:30 chạy — mọi chỗ đọc nhu cầu phải lọc `DiscoverableUntil > now`, không chỉ dựa vào cờ. Test: `DemandExpiryTests.IsOpen_HetHanLaDong` và `OpenAt_LocDungTrenDanhSach` (Task 2); Task 3, 10, 13 đọc nhu cầu qua đúng biểu thức `DemandExpiry.OpenAt`.
2. **Một người có nhiều bộ lọc ở cùng quận bị đếm nhiều lần** làm con số vượt ngưỡng 3 giả. Test: `DemandPulseTests.MotNguoiNhieuBoLoc_DemMotLan` (Task 3).
3. **Khách quay lại sau đăng nhập mất bản nháp** (JSON hỏng, sessionStorage bị chặn, mở ở tab khác). Mong đợi: hộp vẫn mở được, trống, không lỗi. Test: `demandDraft.test.ts` (Task 5).
4. **Giá ưu đãi bằng hoặc cao hơn giá niêm yết, hoặc tin đổi giá sau khi mời.** Mong đợi: từ chối khi mời; khi nhận lời ghi cứng đúng con số đã mời. Test: `InvitationOfferTests` (Task 9) + kiểm tra trên trình duyệt (Task 14).
5. **Nhu cầu không có trần giá bị xếp vào nhóm gần khớp** hoặc `OverBudgetPercent` chia cho 0. Test: `NearMatchTests.KhongCoTranGia_KhongCoBanNoi` (Task 9).

---

# ĐỢT 1 — ai cũng thấy và dùng được

### Task 1: Dữ liệu mới, migration và điều kiện `Occupants`

**Files:**
- Modify: `kgs-api/kgs-api/Domain/Entity/SubEntity/SavedSearch.cs` (thêm sau `DiscoverableSince`)
- Modify: `kgs-api/kgs-api/Domain/Entity/SubEntity/ListingInvitation.cs`, `ListingInquiry.cs`
- Modify: `kgs-api/kgs-api/Dtos/ListingDtos.cs` (cuối `PublicListingSearchQuery`)
- Modify: `kgs-api/kgs-api/Domain/Rules/ListingSearchFilter.cs` (cạnh điều kiện `PetsAllowed`)
- Create: migration `AddDemandMarketplace` trong `kgs-api/kgs-api/Migrations/`
- Test: `kgs-api/kgs-api.Tests/OccupantsFilterTests.cs`

**Interfaces:**
- Produces: `SavedSearch.DiscoverableUntil : DateTime?`, `SavedSearch.ExpiryRemindedAt : DateTime?`; `ListingInvitation.OfferPrice : decimal?`, `ListingInvitation.OfferNote : string?` (`[MaxLength(120)]`); `ListingInquiry.OfferPrice : decimal?`, `ListingInquiry.OfferNote : string?` (`[MaxLength(120)]`); `PublicListingSearchQuery.Occupants : int?` (`[Range(1, 20)]`, mặc định `null`, thêm ở CUỐI record).

- [ ] **Step 1: Viết test hỏng** — theo mẫu `Has3DFilterTests` (LINQ-to-objects trên `ListingSearchFilter.Apply`), dữ liệu 3 tin `Terms.MaxOccupants` = `null`, `2`, `4`:
  - `Occupants3_GiuTinKhongGhiVaTinChoPhepDu` → kết quả đúng 2 tin (`null` và `4`).
  - `KhongDatOccupants_KhongLoaiTinNao` → 3 tin.
- [ ] **Step 2: Chạy, thấy hỏng** — `dotnet test kgs-api/kgs-api.Tests --filter OccupantsFilterTests` → lỗi biên dịch `Occupants`.
- [ ] **Step 3: Thêm thuộc tính và điều kiện lọc** — `if (query.Occupants is not null) q = q.Where(l => l.Terms.MaxOccupants == null || l.Terms.MaxOccupants >= query.Occupants);` kèm chú thích một dòng: tin bỏ trống số người tối đa vẫn khớp (khác `PetsAllowed`, vì đa số tin không khai).
- [ ] **Step 4: Chạy test** → PASS.
- [ ] **Step 5: Tạo migration** — `dotnet ef migrations add AddDemandMarketplace -p kgs-api/kgs-api`. Trong `Up`, sau các `AddColumn`, thêm:
  `migrationBuilder.Sql("UPDATE \"SavedSearches\" SET \"DiscoverableUntil\" = now() + interval '30 days' WHERE \"DiscoverableByOwners\" = true;");`
  Kiểm tra `Down` chỉ xoá 6 cột.
- [ ] **Step 6: Build** — `dotnet build kgs-api/kgs-api` → 0 lỗi.
- [ ] **Step 7: Commit** — `feat(ghep-doi): thêm số người ở, hạn nhu cầu và cột ưu đãi`.

### Task 2: Hạn 30 ngày (`DemandExpiry`) và API nhu cầu

**Files:**
- Create: `kgs-api/kgs-api/Domain/Rules/DemandExpiry.cs`
- Modify: `kgs-api/kgs-api/Dtos/SavedSearchDtos.cs`
- Modify: `kgs-api/kgs-api/Services/SavedSearchService.cs` (`CreateAsync`, `SetDiscoverableAsync`, `ToDtoAsync`, thêm `RenewAsync`) và interface của nó
- Modify: `kgs-api/kgs-api/Controllers/SavedSearchesController.cs`
- Modify: `kgs-api/kgs-api/Services/SavedSearchAlertJob.cs`
- Modify: `kgs-api/kgs-api/Services/MatchmakingService.cs` (`LoadDemandsAsync`)
- Test: `kgs-api/kgs-api.Tests/DemandExpiryTests.cs`

**Interfaces:**
- Consumes: cột của Task 1.
- Produces:
  - `public enum ExpiryAction { None, Remind, Close }`
  - `static class DemandExpiry`: `Lifetime = 30 ngày`, `RemindBefore = 3 ngày`; `DateTime UntilFrom(DateTime now)`; `bool IsOpen(bool discoverable, DateTime? until, DateTime now)` (mở khi cờ bật và `until` null hoặc > now); `ExpiryAction Decide(bool discoverable, DateTime? until, DateTime? remindedAt, DateTime now)`; `Expression<Func<SavedSearch, bool>> OpenAt(DateTime now)` — biểu thức EF dịch được, dùng cho mọi truy vấn đọc nhu cầu đang mở (Task 3, Task 10).
  - `CreateSavedSearchRequest` thêm ở cuối: `bool Discoverable = false`, `[MaxLength(300)] string? DemandNote = null`.
  - `SavedSearchDto` thêm ở cuối: `DateTime? DiscoverableUntil`, `int MatchingListings`, `int MatchingOwners`.
  - `Task<SavedSearchDto> RenewAsync(Guid id, CancellationToken ct)` → `POST /api/saved-searches/{id}/renew`.

- [ ] **Step 1: Viết test hỏng** (`DemandExpiryTests`, `now = 2026-10-23 08:00Z`):
  - `UntilFrom_Them30Ngay` → `now.AddDays(30)`.
  - `IsOpen_HetHanLaDong` → `IsOpen(true, now.AddMinutes(-1), now) == false`; `IsOpen(true, null, now) == true`; `IsOpen(false, now.AddDays(5), now) == false`.
  - `Decide_Con3Ngay_ChuaNhac_LaNhac` → `Remind` với `until = now.AddDays(3)`, `remindedAt = null`.
  - `Decide_DaNhac_KhongNhacLai` → `None` với `until = now.AddDays(2)`, `remindedAt = now.AddDays(-1)`.
  - `Decide_QuaHan_LaDong` → `Close` với `until = now` (biên: bằng now là hết hạn).
  - `Decide_TatSan_KhongLamGi` → `None` với `discoverable = false`.
  - `OpenAt_LocDungTrenDanhSach` → áp `OpenAt(now).Compile()` trên 3 `SavedSearch` (mở còn hạn / mở quá hạn / tắt) → 1.
- [ ] **Step 2: Chạy, thấy hỏng** — `--filter DemandExpiryTests`.
- [ ] **Step 3: Viết `DemandExpiry`**.
- [ ] **Step 4: Chạy test** → PASS.
- [ ] **Step 5: Nối vào service và controller**:
  - `CreateAsync`: khi `request.Discoverable` thì `DiscoverableByOwners = true`, `DiscoverableSince = now`, `DiscoverableUntil = UntilFrom(now)`, `DemandNote` cắt khoảng trắng (rỗng → null).
  - `SetDiscoverableAsync`: bật → đặt `Since` (nếu đang tắt), `Until = UntilFrom(now)`, `ExpiryRemindedAt = null`; tắt → `Until = null`.
  - `RenewAsync`: bật cờ (đặt `Since` nếu đang tắt), `Until = UntilFrom(now)`, `ExpiryRemindedAt = null`.
  - `ToDtoAsync`: `MatchingListings = BuildMatchQuery(...).CountAsync()`, `MatchingOwners = BuildMatchQuery(...).Select(l => l.Asset.UserId).Distinct().CountAsync()`.
  - `MatchmakingService.LoadDemandsAsync`: thay `s.DiscoverableByOwners` bằng `.Where(DemandExpiry.OpenAt(DateTime.UtcNow))`.
- [ ] **Step 6: Bước hết hạn trong `SavedSearchAlertJob`** — thêm `public async Task ProcessDemandExpiryAsync(DateTime now, CancellationToken ct)`, gọi ở đầu `RunAsync` (trước `if (searches.Count == 0) return;`). Đọc nhu cầu `DiscoverableByOwners && DiscoverableUntil != null`; `Remind` → gửi `_notifier.SendAsync(userId, "Nhu cầu “{Name}” sắp hết hạn", "Còn {n} ngày nữa chủ nhà sẽ không mời được bạn. Gia hạn thêm 30 ngày nếu bạn vẫn đang tìm.", "/nhu-cau", "Gia hạn", ct)`, gửi thành công mới đặt `ExpiryRemindedAt = now`; `Close` → `DiscoverableByOwners = false` (giữ `DiscoverableUntil` để giao diện hiện "Đã hết hạn"). Lưu một lần.
- [ ] **Step 7: Build và chạy toàn bộ test** — `dotnet test kgs-api/kgs-api.Tests` → toàn bộ PASS.
- [ ] **Step 8: Commit** — `feat(ghep-doi): hạn 30 ngày, gia hạn và đăng nhu cầu một lần gọi`.

### Task 3: Nhịp cầu (`DemandPulse`)

**Files:**
- Create: `kgs-api/kgs-api/Domain/Rules/DemandPulse.cs`
- Create: `kgs-api/kgs-api/Services/DemandPulseService.cs` (+ `IDemandPulseService` trong `Interfaces/`, đăng ký scoped trong `Extensions/ApplicationServiceExtensions.cs`)
- Create: `kgs-api/kgs-api/Controllers/DemandPulseController.cs`
- Create: `kgs-api/kgs-api/Dtos/DemandPulseDtos.cs`
- Test: `kgs-api/kgs-api.Tests/DemandPulseTests.cs`

**Interfaces:**
- Consumes: `DemandExpiry.OpenAt`, `SavedSearchService.Deserialize`, `AdministrativeNames.CanonicalCity/CanonicalDistrict`.
- Produces:
  - `sealed record PulseInput(string UserId, ListingType? Type, string? City, string? District, decimal? Budget)` — `Budget = PriceMax ?? TotalCostMax`.
  - `sealed record PulseBand(string Label, decimal? Min, decimal? Max, int People)`; `sealed record PulseGroup(ListingType? Type, string City, string? District, int People, IReadOnlyList<PulseBand> Bands)`.
  - `static class DemandPulse`: `const int MinPeople = 3`; `IReadOnlyList<PulseGroup> Compute(IEnumerable<PulseInput> demands)`; `int? BandIndex(ListingType type, decimal budget)`.
  - DTO: `DemandPulseDto(ListingType? Type, string City, string? District, int People, IReadOnlyList<DemandPulseBandDto> Bands)`, `DemandPulseBandDto(string Label, decimal? Min, decimal? Max, int People)`, `DemandPulseResponse(DemandPulseDto? Group)`.
  - `IDemandPulseService.GetAsync(ListingType? type, string? city, string? district, CancellationToken ct) : Task<DemandPulseDto?>`; `GetTopAsync(ListingType? type, int take, CancellationToken ct) : Task<IReadOnlyList<DemandPulseDto>>`.
  - `GET /api/demand-pulse?type=&city=&district=` → `DemandPulseResponse`; `GET /api/demand-pulse/top?type=` → danh sách (take = 6). Cả hai `[AllowAnonymous]`.

Quy tắc gộp (không suy ra được từ chữ ký): bỏ nhu cầu thiếu `City`. Mỗi nhu cầu góp vào các khoá `(Type, City, null)`, `(null, City, null)`, và nếu có quận thêm `(Type, City, District)`, `(null, City, District)` (khi `Type` null chỉ góp vào khoá `null`). `People` = số `UserId` khác nhau. Khoảng giá chỉ tính cho khoá có `Type`; ranh giới theo trần: thuê `≤3tr | ≤5tr | ≤10tr | ≤20tr | >20tr`, mua `≤2 tỷ | ≤5 tỷ | ≤10 tỷ | ≤20 tỷ | >20 tỷ`; nhãn đúng như Global Constraints. Bỏ khoảng và nhóm có `People < MinPeople`.

- [ ] **Step 1: Viết test hỏng** (`DemandPulseTests`):
  - `MotNguoiNhieuBoLoc_DemMotLan` — 1 người × 3 nhu cầu + 2 người khác cùng (Thuê, HCM, Bình Thạnh) → nhóm quận có `People == 3`.
  - `DuoiBaNguoi_AnNhom` — 2 người → không có nhóm nào cho quận đó.
  - `KhongGhiQuan_ChiVaoCapTinh` — 3 người không quận → có nhóm `(Rent, HCM, null)` People 3, không có nhóm quận.
  - `KhoangGiaThue` — `BandIndex(Rent, 3_000_000) == 0`, `BandIndex(Rent, 5_000_000) == 1`, `BandIndex(Rent, 25_000_000) == 4`.
  - `KhoangGiaMua` — `BandIndex(Sale, 2_000_000_000) == 0`, `BandIndex(Sale, 11_000_000_000) == 3`.
  - `KhongTranGia_ChiVaoTong` — 3 người không trần giá → `People == 3`, `Bands` rỗng.
  - `KhoangDuoiBaNguoi_BiAn` — 3 người: 2 người trần 4 tr, 1 người trần 8 tr → `People == 3` nhưng `Bands` rỗng (cả hai khoảng đều dưới 3 người).
- [ ] **Step 2: Chạy, thấy hỏng**.
- [ ] **Step 3: Viết `DemandPulse`**.
- [ ] **Step 4: Chạy test** → PASS.
- [ ] **Step 5: Viết `DemandPulseService`** — đọc `Where(DemandExpiry.OpenAt(now)).Select(s => new { s.UserId, s.CriteriaJson })`, giải mã, chuẩn hoá tên tỉnh/quận, `Compute`, cất toàn bộ kết quả vào `IMemoryCache` khoá `"demand-pulse"` 10 phút. `GetAsync` chuẩn hoá tham số rồi tìm đúng khoá; `GetTopAsync` lấy các nhóm có `District != null` và `Type == type`, giảm dần theo `People`.
- [ ] **Step 6: Controller + đăng ký DI**; build; gọi thử `curl -k https://localhost:7129/api/demand-pulse/top?type=1` khi API của người dùng đang chạy bản mới (nếu không, bỏ qua bước này — Task 8 kiểm trên trình duyệt).
- [ ] **Step 7: Commit** — `feat(ghep-doi): Nhịp cầu — đếm người đang tìm theo khu vực, ẩn dưới 3`.

### Task 4: Dữ liệu mẫu

**Files:**
- Modify: `kgs-api/kgs-api/Services/Seeding/ShowcaseCatalog.cs` (`People`, `Demand`, `Demands`)
- Modify: `kgs-api/kgs-api/Services/Seeding/ShowcaseSeeder.cs` (`DemandsAsync`, ~dòng 790)
- Test: `kgs-api/kgs-api.Tests/ShowcaseCatalogTests.cs`

**Interfaces:**
- Consumes: `DemandPulse.Compute`, `DemandExpiry.UntilFrom`, `NearMatch` chưa có — dùng hàm riêng dưới đây.
- Produces: `Demand` thêm tham số cuối `int? Occupants = null`; `static decimal ShowcaseCatalog.NearPriceBudget(decimal listingPrice)` = làm tròn xuống bội 100.000 của `listingPrice / 1.05m` (cho thuê) — trần ngân sách thấp hơn giá tin khoảng 5%.

- [ ] **Step 1: Viết test hỏng**:
  - `NhuCau_NhipCauDatNguongItNhatBaQuan` — dựng `PulseInput` từ `Demands.Where(d => d.Discoverable)` (UserId = `Person`, Budget = `PriceMax`) → số nhóm có `District != null && Type != null` ≥ 3.
  - `NhuCau_DuSoLuong` — `Demands.Count(d => d.Discoverable)` trong [35, 40]; số `Person` khác nhau trong nhóm này ≥ 12.
  - `NearPriceBudget_VuotKhongQua10PhanTram` — với giá 5_500_000 → ngân sách 5_200_000 (vượt ~5,8%); với 3_200_000 → 3_000_000.
  - Test cũ `NhuCau_DungTuVungChuan` vẫn phải đạt.
- [ ] **Step 2: Chạy, thấy hỏng**.
- [ ] **Step 3: Thêm dữ liệu** — 12 người tìm mới vào `People` (email `@kgs.test`, tên Việt thật, số điện thoại không trùng); 35–40 nhu cầu mở, dồn vào các quận đã có tin (Bình Thạnh, Gò Vấp, Thủ Đức, Cầu Giấy, Thủ Dầu Một — dùng mã `Place` sẵn có làm chỗ tham chiếu), đa dạng trần giá để có khoảng giá đạt ngưỡng, có `Occupants` và lời nhắn đời thường. Giữ 3 nhu cầu cũ.
- [ ] **Step 4: Seeder** — `DiscoverableUntil = d.Discoverable ? now.AddDays(4 + i % 25) : null` (để có vài nhu cầu sắp hết hạn trình diễn nhắc nhở); `Occupants` vào `PublicListingSearchQuery`. Sau khi tạo tin, sinh thêm **2 nhu cầu gần khớp**: chọn 2 tin phòng trọ đã duyệt ở 2 quận khác nhau, tạo nhu cầu cùng loại/tỉnh/quận với `PriceMax = NearPriceBudget(listing.Price)` cho 2 người tìm khác nhau.
- [ ] **Step 5: Chạy toàn bộ test** → PASS.
- [ ] **Step 6: Commit** — `feat(ghep-doi): dữ liệu mẫu đủ để Nhịp cầu và gần khớp hiện ra`.

### Task 5: API phía web, bản nháp của khách và `PostDemandDialog`

**Files:**
- Modify: `quanly-tai-san/src/lib/api/savedSearches.ts`
- Create: `quanly-tai-san/src/lib/api/demandPulse.ts`
- Create: `quanly-tai-san/src/lib/demandDraft.ts`, test `quanly-tai-san/src/lib/demandDraft.test.ts`
- Create: `quanly-tai-san/src/components/demand/PostDemandDialog.tsx`

**Interfaces:**
- Consumes: API của Task 2–3.
- Produces:
  - `SavedSearchCriteria.occupants?: number | null`; `SavedSearchDto` thêm `discoverableUntil: string | null`, `matchingListings: number`, `matchingOwners: number`.
  - `savedSearchesApi.create(name, criteria, notifyEnabled = true, discoverable = false, demandNote: string | null = null)`; `savedSearchesApi.renew(id) => api<SavedSearchDto>(`/saved-searches/${id}/renew`, { method: "POST" })`.
  - `demandPulse.ts`: `DemandPulseBand { label; min: number|null; max: number|null; people }`, `DemandPulse { type: ListingTypeCode|null; city; district: string|null; people; bands: DemandPulseBand[] }`; `demandPulseApi.get({ type?, city?, district? }) : Promise<DemandPulse | null>` (đọc `.group`), `demandPulseApi.top(type?) : Promise<DemandPulse[]>`.
  - `demandDraft.ts`: `DEMAND_DRAFT_KEY = "kgs:nhu-cau-nhap"`; `interface DemandDraft { name: string; criteria: SavedSearchCriteria; note: string; notify: boolean }`; `saveDemandDraft(d, storage?)`, `takeDemandDraft(storage?): DemandDraft | null` — cùng khuôn với `lib/voice/handoff.ts` (đọc xong xoá, mọi lỗi → null).
  - `PostDemandDialog({ open, onOpenChange, criteria, suggestedName, draft? }: { open: boolean; onOpenChange(v: boolean): void; criteria: SavedSearchCriteria; suggestedName: string; draft?: DemandDraft | null })`.

- [ ] **Step 1: Viết test hỏng** (`demandDraft.test.ts`, dùng một `Storage` giả như `handoff.test.ts`):
  - lưu rồi lấy ra đúng bản nháp; lấy lần hai trả `null`.
  - JSON hỏng → `null` và khoá bị xoá.
  - thiếu `criteria` → `null`.
  - storage ném lỗi ở `getItem` → `null`, không ném.
- [ ] **Step 2: Chạy, thấy hỏng** — `npx vitest run src/lib/demandDraft.test.ts`.
- [ ] **Step 3: Viết `demandDraft.ts`**; chạy lại → PASS.
- [ ] **Step 4: API client** — sửa `savedSearches.ts`, tạo `demandPulse.ts`.
- [ ] **Step 5: `PostDemandDialog`** — các ô: Tên (mặc định `suggestedName`), Số người ở (1–20, để trống được), Dọn vào trước ngày (`availableBy`), Có thú cưng (checkbox → `petsAllowed: true | null`), Lời nhắn cho chủ nhà (đếm ký tự, tối đa 300), "Báo tôi khi có tin mới khớp" (bật sẵn). Nút **"Đăng nhu cầu"**:
  - đã đăng nhập → `savedSearchesApi.create(name, {...criteria, occupants, availableBy, petsAllowed}, notify, true, note)`, toast `"Đã đăng — chủ nhà phù hợp có thể mời bạn"` với action "Xem nhu cầu" → `/nhu-cau`; invalidate `["saved-searches"]`.
  - khách → `saveDemandDraft(...)`, `navigate({ to: "/login", search: { redirect: <href hiện tại> } })` (lấy href như `ProtectedRoute`). Trang chứa hộp tự mở lại khi có bản nháp (Task 6), nên không cần thêm tham số `postDemand`.
  - Có `draft` → điền sẵn từ bản nháp thay cho `criteria`/`suggestedName`.
  - Một dòng giải thích dưới tiêu đề: "Chủ nhà có căn phù hợp sẽ thấy nhu cầu này (không thấy tên hay số điện thoại của bạn) và gửi lời mời xem nhà."
- [ ] **Step 6: Kiểm tra** — `npx tsc --noEmit -p .` và `npm run lint` trong `quanly-tai-san` → 0 lỗi mới; `npm test` → PASS.
- [ ] **Step 7: Commit** — `feat(ghep-doi): hộp Đăng nhu cầu dùng chung, giữ bản nháp cho khách`.

### Task 6: Năm lối vào và thẻ Nhịp cầu

**Files:**
- Create: `quanly-tai-san/src/components/demand/DemandPulseLine.tsx`, `DemandPulseCard.tsx`, `useDemandDraftResume.ts`
- Modify: `quanly-tai-san/src/routes/tin-dang.index.tsx` (cạnh `SavedSearchesPopover` ~dòng 1024; banner ít kết quả gần `totalCount` ~dòng 1011)
- Modify: `quanly-tai-san/src/components/public/SavedSearchesPopover.tsx` (form "Lưu bộ lọc hiện tại" ~dòng 146)
- Modify: `quanly-tai-san/src/components/voice/VoiceAssistant.tsx`
- Modify: `quanly-tai-san/src/routes/index.tsx` (mục mới trước mục "Có nhà cho thuê hoặc bán?" ~dòng 821)

**Interfaces:**
- Consumes: Task 5.
- Produces:
  - `DemandPulseLine({ type, city, district }: { type?: ListingTypeCode; city?: string; district?: string })` — một dòng "28 người đang tìm thuê ở Quận Bình Thạnh · 12 người 3–5 triệu" (khoảng đông nhất); không render gì khi `null`.
  - `DemandPulseCard({ pulse }: { pulse: DemandPulse })` — thẻ cho trang chủ, bấm → `/tin-dang?type=&city=&district=`.
  - `useDemandDraftResume(): DemandDraft | null` — khi đã đăng nhập, gọi `takeDemandDraft()` đúng một lần lúc mount.
  - Tham số tìm kiếm mới của `/tin-dang`: `dang_nhu_cau?: 1` (giống `tro_ly`).

- [ ] **Step 1: Tìm nhà** — nút "Đăng nhu cầu" (biểu tượng `Handshake`) ngay cạnh `SavedSearchesPopover`, mở `PostDemandDialog` với `toCriteria(savedSearchFilters)` và `suggestedSearchName`. Khi `!query.isLoading && totalCount < 5`: thẻ "Chưa có nhiều căn khớp — đăng nhu cầu này, chủ nhà phù hợp sẽ mời bạn" + nút. `DemandPulseLine` với loại/tỉnh/quận đang lọc, đặt dưới dòng "{totalCount} bất động sản". Có `useDemandDraftResume()` → mở hộp với bản nháp. Có `dang_nhu_cau=1` → sau khi áp bàn giao của trợ lý thì mở hộp.
- [ ] **Step 2: Popover lưu bộ lọc** — checkbox "Cho chủ nhà phù hợp mời tôi" trong form lưu (mặc định tắt); bật thì gọi `create(..., discoverable = true)`. Sửa mô tả toast cũ "Lời mời sẽ đến email và mục “Lời mời xem nhà”" thành "… và trang “Nhu cầu của tôi”".
- [ ] **Step 3: KiGi** — cạnh nút "Xem N căn", thêm nút "Đăng nhu cầu này" (hiện khi `payload` có): `saveHandoff(last.current)`, `voice.stop()`, `navigate({ to: "/tin-dang", search: { tro_ly: 1, dang_nhu_cau: 1 } })`.
- [ ] **Step 4: Trang chủ** — mục "Không muốn tự lục tìm?" với một câu giải thích, nút "Đăng nhu cầu" (mở hộp với tiêu chí rỗng, tên gợi ý "Nhu cầu tìm nhà của tôi") và lưới `DemandPulseCard` từ `demandPulseApi.top(1)` (ẩn lưới khi rỗng). Có `useDemandDraftResume()`.
- [ ] **Step 5: Kiểm tra** — tsc, lint, `npm test` → sạch.
- [ ] **Step 6: Commit** — `feat(ghep-doi): năm lối vào Đăng nhu cầu và thẻ Nhịp cầu`.

### Task 7: Trang "Nhu cầu của tôi" và điều hướng

**Files:**
- Create: `quanly-tai-san/src/routes/nhu-cau.tsx`, `quanly-tai-san/src/components/demand/MyDemandCard.tsx`
- Modify: `quanly-tai-san/src/components/navigation/AccountSheet.tsx` (dòng 73; `AccountItem` thêm `badge?: number`)
- Modify: `quanly-tai-san/src/routes/yeu-cau.index.tsx` (bỏ tab "invites", chuyển hướng)
- Modify: `quanly-tai-san/src/components/matchmaking/InvitationsList.tsx` (xuất `INVITATIONS_KEY`)
- Regenerate: `quanly-tai-san/src/routeTree.gen.ts` (chạy `npm run build:dev` hoặc để dev server tự sinh)

**Interfaces:**
- Consumes: `SavedSearchDto` mới, `savedSearchesApi.renew/setDiscoverable/remove`, `InvitationsList`.
- Produces: route `/nhu-cau` (bọc `ProtectedRoute` như `/yeu-cau`); `MyDemandCard({ search }: { search: SavedSearchDto })`.

- [ ] **Step 1: `MyDemandCard`** — tên; tóm tắt điều kiện (loại, khu vực, giá, số người ở); nhãn trạng thái: `discoverableByOwners` → "Đang mở cho chủ nhà · còn N ngày"; tắt và `discoverableUntil` đã qua → "Đã hết hạn"; còn lại → "Chỉ nhận báo tin mới". Dòng "Đang khớp {matchingListings} căn của {matchingOwners} chủ nhà" là liên kết sang `/tin-dang` với bộ lọc (dùng cách `SavedSearchesPopover.onApply` đang dựng tham số). Nút: Gia hạn (khi đang mở còn ≤ 7 ngày hoặc đã hết hạn) / Mở cho chủ nhà hoặc Tắt / Sửa lời nhắn (dùng `setDiscoverable(id, true, note)`) / Xoá (hỏi lại trước khi xoá).
- [ ] **Step 2: Trang `/nhu-cau`** — tiêu đề "Nhu cầu của tôi", nút "Đăng nhu cầu mới" (mở `PostDemandDialog` tiêu chí rỗng); phần 1 danh sách `MyDemandCard` của các bộ lọc (nhu cầu đang mở lên đầu), trạng thái trống có lời mời gọi đăng; phần 2 "Lời mời xem nhà" = `<InvitationsList />`.
- [ ] **Step 3: Menu** — thay mục "Lời mời xem nhà" bằng `{ label: "Nhu cầu của tôi", icon: Handshake, path: "/nhu-cau", badge }` với `badge` = số lời mời `status === 1 && !expired` từ query `INVITATIONS_KEY` (chỉ khi đã đăng nhập); render huy hiệu khi `badge > 0`.
- [ ] **Step 4: `/yeu-cau`** — `beforeLoad: ({ search }) => { if (search.tab === "invites") throw redirect({ to: "/nhu-cau" }); }`; bỏ `TabsTrigger`/`TabsContent` "invites".
- [ ] **Step 5: Kiểm tra** — regenerate route tree, tsc, lint, `npm test`.
- [ ] **Step 6: Commit** — `feat(ghep-doi): trang Nhu cầu của tôi, menu và chuyển hướng lời mời`.

### Task 8: Kiểm tra Đợt 1 trên trình duyệt

- [ ] **Step 1:** Chạy lại seed trình diễn (cách đã dùng trong dự án) để có dữ liệu Task 4; khởi động bản mới của API và web theo `.claude/launch.json` (không đụng tiến trình của người dùng ở 7129/8081 — nếu chúng đang chạy bản cũ, nhờ người dùng khởi động lại).
- [ ] **Step 2:** Trang chủ: mục "Không muốn tự lục tìm?" và ≥ 3 thẻ Nhịp cầu.
- [ ] **Step 3:** Tìm nhà: nút Đăng nhu cầu; lọc một quận ít tin → banner; dòng Nhịp cầu hiện ở Bình Thạnh.
- [ ] **Step 4:** Khách bấm Đăng nhu cầu → đăng nhập bằng tài khoản mẫu `@kgs.test` → quay lại Tìm nhà, hộp tự mở đúng bản nháp → đăng → toast → `/nhu-cau` có thẻ "Đang mở cho chủ nhà · còn 30 ngày" và số căn khớp.
- [ ] **Step 5:** Gia hạn, Tắt, Xoá chạy đúng; `/yeu-cau?tab=invites` chuyển sang `/nhu-cau`; console không lỗi. Chụp màn hình làm bằng chứng.

---

# ĐỢT 2 — chủ nhà mời hiệu quả

### Task 9: Quy tắc `NearMatch` và `InvitationOffer`

**Files:**
- Create: `kgs-api/kgs-api/Domain/Rules/NearMatch.cs`, `kgs-api/kgs-api/Domain/Rules/InvitationOffer.cs`
- Test: `kgs-api/kgs-api.Tests/NearMatchTests.cs`, `kgs-api/kgs-api.Tests/InvitationOfferTests.cs`

**Interfaces:**
- Produces:
  - `static class NearMatch`: `const decimal Tolerance = 0.10m`; `PublicListingSearchQuery? Relax(PublicListingSearchQuery q)` — `null` khi cả `PriceMax` lẫn `TotalCostMax` đều null, ngược lại nhân các trần có mặt với 1,1; `int OverBudgetPercent(decimal listingCost, decimal budget)` — `ceil((cost − budget) / budget × 100)`, trả 0 khi `cost ≤ budget` hoặc `budget ≤ 0`; `decimal MonthlyCost(Listing l)` — `Price + ServiceFee + ParkingFee + InternetFee` (đúng công thức `ListingSearchFilter`).
  - `static class InvitationOffer`: `const int MaxNoteLength = 120`; `string? Validate(decimal? offerPrice, string? offerNote, decimal listedPrice)` — trả câu lỗi tiếng Việt hoặc `null` khi hợp lệ.

- [ ] **Step 1: Viết test hỏng**:
  - `NearMatchTests`: `Relax_Noi10PhanTram` (PriceMax 5_000_000 → 5_500_000, TotalCostMax 6_000_000 → 6_600_000); `KhongCoTranGia_KhongCoBanNoi` (→ null); `OverBudget_LamTronLen` (5_300_000 vs 5_000_000 → 6); `OverBudget_KhongVuot_La0`; `OverBudget_NganSach0_La0`.
  - `InvitationOfferTests`: `KhongUuDai_HopLe` (null, null → null); `GiaBangGiaNiemYet_TuChoi`; `GiaCaoHon_TuChoi`; `GiaAm_TuChoi`; `GiaBang0_TuChoi`; `DongUuDai121KyTu_TuChoi`; `GiaThapHon_HopLe` (4_800_000 < 5_000_000 → null).
- [ ] **Step 2: Chạy, thấy hỏng**.
- [ ] **Step 3: Viết hai lớp**.
- [ ] **Step 4: Chạy test** → PASS.
- [ ] **Step 5: Commit** — `feat(ghep-doi): quy tắc gần khớp theo giá và kiểm tra ưu đãi`.

### Task 10: `MatchmakingService` — lọc sơ, nhóm gần khớp, ưu đãi

**Files:**
- Modify: `kgs-api/kgs-api/Services/MatchmakingService.cs`
- Modify: `kgs-api/kgs-api/Dtos/MatchmakingDtos.cs`, `kgs-api/kgs-api/Dtos/Dtos.cs` (`ReceivedInquiryDto`, `SentInquiryDto` ~dòng 42–58) và chỗ chiếu (projection) của chúng trong `MarketplaceEngagementService`

**Interfaces:**
- Consumes: `NearMatch`, `InvitationOffer`, `DemandExpiry.OpenAt`.
- Produces:
  - `enum DemandMatchKind { Exact = 1, NearPrice = 2 }`.
  - `AnonymousDemandDto` thêm ở cuối: `DemandMatchKind MatchKind`, `int? OverBudgetPercent`, `int? Occupants`, `DateTime? AvailableBy`, `bool? PetsAllowed`, `decimal? OfferPrice`, `string? OfferNote`.
  - `InviteRequest(Guid DemandId, [MaxLength(500)] string? Message, decimal? OfferPrice = null, [MaxLength(120)] string? OfferNote = null)`.
  - `SeekerInvitationDto` thêm ở cuối: `decimal? OfferPrice`, `string? OfferNote` (trường `Price` sẵn có là giá niêm yết).
  - `ReceivedInquiryDto`, `SentInquiryDto` thêm ở cuối: `decimal? OfferPrice`, `string? OfferNote`.
  - `public static bool PassesPrefilter(PublicListingSearchQuery c, ListingType listingType, string listingCity)` — loại nhu cầu khác loại tin hoặc khác tỉnh/thành (sau chuẩn hoá); nhu cầu không ghi thì giữ.
  - `Task<int> CountMatchingDemandsAsync(Guid listingId, CancellationToken ct)` — dùng cho Task 11 (không kiểm người đang đăng nhập; loại nhu cầu của chính chủ tin; đếm khớp hoàn toàn + gần khớp).

- [ ] **Step 1: Viết test hỏng** cho `PassesPrefilter` trong `kgs-api.Tests/MatchmakingPrefilterTests.cs`: khác loại → false; cùng loại khác tỉnh → false; nhu cầu không ghi loại và tỉnh → true; "TP. HCM" khớp "Thành phố Hồ Chí Minh" → true.
- [ ] **Step 2: Chạy, thấy hỏng**; viết `PassesPrefilter`; chạy → PASS.
- [ ] **Step 3: Lấy thêm thông tin tin** — `GetOwnedApprovedListingAsync` trả record `OwnedListing(string Title, Point? Location, ListingType Type, string City, decimal Price, decimal MonthlyCost)`.
- [ ] **Step 4: Danh sách nhu cầu** — `GetDemandsForListingAsync` và `GetDemandCountsAsync`: giải mã một lần, lọc sơ, rồi `MatchesAsync`; nếu không khớp và `NearMatch.Relax(c)` khác null thì thử bản nới → `NearPrice` với `OverBudgetPercent` = lớn nhất giữa (`Price` so `PriceMax`) và (`MonthlyCost` so `TotalCostMax`). Sắp xếp: chưa mời trước, rồi `Exact` trước `NearPrice`, rồi mới bật trước. `Occupants/AvailableBy/PetsAllowed` lấy từ tiêu chí; `OfferPrice/OfferNote` từ lời mời đã gửi.
- [ ] **Step 5: Mời kèm ưu đãi** — `InviteAsync` gọi `InvitationOffer.Validate(request.OfferPrice, request.OfferNote, listing.Price)`; có lỗi → `ValidationFailedException(lỗi)`; lưu vào `ListingInvitation`. Nội dung thông báo cho người tìm thêm "· Ưu đãi riêng: {giá}" khi có.
- [ ] **Step 6: Nhận lời ghi cứng ưu đãi** — `RespondAsync` khi `Accept`: sau khi có `inquiryId`, nạp `ListingInquiry` đó và chép `OfferPrice`, `OfferNote` từ lời mời (chỉ khi inquiry chưa có ưu đãi). Sửa chú thích cũ còn nhắc "hợp đồng" trong khối này.
- [ ] **Step 7: Chiếu DTO** — `ProjectSeeker` và các projection inquiry trả thêm hai trường.
- [ ] **Step 8: Chạy toàn bộ test** → PASS.
- [ ] **Step 9: Commit** — `feat(ghep-doi): nhóm gần khớp theo giá, lời mời kèm ưu đãi riêng`.

### Task 11: Báo chủ tin khi tin vừa được duyệt

**Files:**
- Create: `kgs-api/kgs-api/Services/DemandMatchNotifyJob.cs` (đăng ký scoped cùng chỗ `SavedSearchAlertJob`)
- Modify: `kgs-api/kgs-api/Controllers/AdminListingsController.cs` (`Approve` ~dòng 157, `BulkModerate` ~dòng 258)
- Modify: `kgs-api/kgs-api/Services/MatchmakingService.cs` (tách phần đếm để job gọi được không qua `_currentUser`)

**Interfaces:**
- Consumes: `IMatchmakingService.CountMatchingDemandsAsync(Guid listingId, CancellationToken ct)` (Task 10).
- Produces: `DemandMatchNotifyJob.RunAsync(Guid listingId, CancellationToken ct)`.

- [ ] **Step 1: Viết job** — nạp tin (`Title`, `Status`, `Asset.UserId`); bỏ qua nếu không còn `Approved`; `n = CountMatchingDemandsAsync`; `n > 0` → `_notifier.SendAsync(ownerId, $"Tin “{Title}” khớp {n} người đang tìm", "Họ đã đăng nhu cầu và đang chờ chủ nhà mời. Mời ngay để họ xem căn của bạn trước.", $"/tin-cua-toi?nhu_cau={listingId}", "Mời ngay", ct)`. Lỗi thì ghi log, không ném lại.
- [ ] **Step 2: Đưa vào hàng đợi** — tiêm `IBackgroundJobClient`; sau `NotifyAsync` ở `Approve`, và sau vòng gửi thông báo ở `BulkModerate` khi `request.Approve` (mỗi tin đã duyệt một lần): `_jobs.Enqueue<DemandMatchNotifyJob>(j => j.RunAsync(listing.Id, CancellationToken.None))`.
- [ ] **Step 3: Mở thẳng danh sách nhu cầu** — `tin-cua-toi.tsx` đọc tham số `nhu_cau` (Guid) và mở `ListingDemandsSheet` của tin đó khi trang tải xong.
- [ ] **Step 4: Build, chạy toàn bộ test, tsc, lint** → sạch.
- [ ] **Step 5: Commit** — `feat(ghep-doi): báo chủ tin số người đang tìm ngay khi tin được duyệt`.

### Task 12: Giao diện phía chủ nhà và hiển thị ưu đãi

**Files:**
- Modify: `quanly-tai-san/src/lib/api/matchmaking.ts`, `quanly-tai-san/src/lib/api/` (kiểu inquiry nhận/gửi)
- Modify: `quanly-tai-san/src/components/matchmaking/ListingDemandsSheet.tsx`, `InvitationsList.tsx`
- Modify: `quanly-tai-san/src/routes/tin-cua-toi.tsx` (huy hiệu ~dòng 305), `quanly-tai-san/src/routes/yeu-cau.index.tsx` (đoạn giới thiệu, thẻ yêu cầu), `quanly-tai-san/src/routes/dang-tin.tsx` (bước "Thông số & giá")

**Interfaces:**
- Consumes: DTO của Task 10; `DemandPulseLine` (Task 6).
- Produces: `AnonymousDemand` thêm `matchKind: 1 | 2`, `overBudgetPercent: number | null`, `occupants: number | null`, `availableBy: string | null`, `petsAllowed: boolean | null`, `offerPrice: number | null`, `offerNote: string | null`; `SeekerInvitation` thêm `offerPrice`, `offerNote`; `matchmakingApi.invite(listingId, demandId, message, offerPrice: number | null = null, offerNote: string | null = null)`.

- [ ] **Step 1: `ListingDemandsSheet`** — hai nhóm "Khớp hoàn toàn" và "Gần khớp theo giá" (nhóm thứ hai có nhãn "Ngân sách thấp hơn giá tin {overBudgetPercent}%"); mỗi thẻ thêm số người ở, ngày muốn dọn vào, thú cưng. Hộp mời thêm "Giá ưu đãi cho riêng bạn" (`CurrencyInput`, nhu cầu gần khớp điền sẵn `criteria.priceMax ?? criteria.totalCostMax`) và "Dòng ưu đãi" (≤ 120 ký tự, có đếm); chặn gửi khi giá ≥ giá tin, hiện lỗi máy chủ trả về.
- [ ] **Step 2: `InvitationsList`** — khi có `offerPrice`: khối nổi bật "Giá niêm yết {price} → giá cho bạn {offerPrice}" (dùng `formatListingPrice` theo `rentPaymentCycle`), kèm `offerNote`; liên kết nhỏ "Báo ưu đãi sai sự thật" mở luồng báo vi phạm tin sẵn có với lý do "Sai thông tin".
- [ ] **Step 3: `/yeu-cau`** — thẻ yêu cầu (nhận và gửi) hiện ưu đãi đã ghi cứng; viết lại đoạn giới thiệu, bỏ mọi chữ "hợp đồng" (mô-đun đã gỡ), ví dụ: "Người quan tâm tin của bạn gửi yêu cầu xem nhà ở đây. Liên hệ, hẹn giờ xem và cập nhật trạng thái để họ biết bạn đã nhận."
- [ ] **Step 4: "Tin của tôi"** — huy hiệu luôn hiện: `count > 0` → nổi bật "{count} người đang tìm căn như thế này"; `0` → mờ "Chưa có ai — nhu cầu mới sẽ được báo cho bạn".
- [ ] **Step 5: Đăng tin bước 2** — dưới ô giá: `DemandPulseLine` với loại tin, tỉnh, quận đã chọn ở bước 1, chữ "Có N người đang tìm thuê ở {quận} — tin của bạn sẽ được giới thiệu tới họ sau khi duyệt." (thêm prop `variant: "seeker" | "owner"` cho `DemandPulseLine` để chọn câu).
- [ ] **Step 6: Kiểm tra** — tsc, lint, `npm test` → sạch.
- [ ] **Step 7: Commit** — `feat(ghep-doi): chủ nhà mời kèm ưu đãi, người tìm thấy ưu đãi`.

### Task 13: Chỉ số ghép đôi trên Tổng quan quản trị

**Files:**
- Create: `kgs-api/kgs-api/Domain/Rules/MatchmakingStats.cs`
- Modify: `kgs-api/kgs-api/Services/Admin/AdminOverviewService.cs`
- Modify: `quanly-tai-san/src/routes/admin.overview.tsx` và kiểu tương ứng trong `quanly-tai-san/src/lib/api/`
- Test: `kgs-api/kgs-api.Tests/AdminOverviewTests.cs`

**Interfaces:**
- Produces: `MatchmakingStatsDto(int OpenDemands, int InvitationsSent, int Accepted, int WithOffer, double AcceptRate, double OfferRate)`; `AdminOverviewDto` thêm tham số cuối `MatchmakingStatsDto? Matchmaking = null`; `static MatchmakingStatsDto MatchmakingStats.From(int open, int sent, int accepted, int withOffer)` (tỉ lệ = phần trên `sent`, `sent == 0` → 0).

- [ ] **Step 1: Viết test hỏng** — `GhepDoi_TiLeTrenSoLoiMoi` (`From(10, 20, 5, 8)` → `AcceptRate 0.25`, `OfferRate 0.4`); `GhepDoi_ChuaMoiAi_TiLe0`.
- [ ] **Step 2: Chạy, thấy hỏng**; viết `From`; chạy → PASS.
- [ ] **Step 3: Truy vấn trong cửa sổ `days`** — `OpenDemands` = nhu cầu `OpenAt(now)` (không phụ thuộc cửa sổ); lời mời có `CreatedAt` trong cửa sổ: tổng, `Status == Accepted`, `OfferPrice != null || OfferNote != null`.
- [ ] **Step 4: Giao diện** — một khối "Ghép đôi" 4 ô: Nhu cầu đang mở · Lời mời đã gửi · Tỉ lệ nhận lời · Lời mời có ưu đãi.
- [ ] **Step 5: Chạy toàn bộ test, tsc, lint** → sạch.
- [ ] **Step 6: Commit** — `feat(ghep-doi): chỉ số ghép đôi trên trang tổng quan quản trị`.

### Task 14: Kiểm tra toàn nhánh và mở PR

- [ ] **Step 1:** `dotnet test kgs-api/kgs-api.Tests` → toàn bộ PASS; trong `quanly-tai-san`: `npx tsc --noEmit -p .`, `npm run lint`, `npm test` → sạch.
- [ ] **Step 2: Trình duyệt, phía chủ nhà** — đăng nhập chủ tin mẫu có tin trùng một nhu cầu gần khớp; "Tin của tôi" có huy hiệu nổi bật; mở danh sách → thấy nhóm "Gần khớp theo giá" với % đúng; mời với giá ưu đãi ≥ giá tin → bị chặn; mời với giá thấp hơn + dòng ưu đãi → thành công.
- [ ] **Step 3: Trình duyệt, phía người tìm** — đăng nhập người tìm đó → `/nhu-cau` thấy lời mời có "Giá niêm yết … → giá cho bạn …"; nhận lời → `/yeu-cau` (đã gửi) và hộp thư chủ tin đều thấy ưu đãi.
- [ ] **Step 4:** Duyệt một tin đang chờ (tài khoản quản trị mẫu) → chủ tin nhận thông báo "khớp N người đang tìm" (nếu có nhu cầu khớp); trang tổng quan quản trị có khối Ghép đôi; bước 2 Đăng tin có dòng Nhịp cầu. Chụp màn hình làm bằng chứng.
- [ ] **Step 5:** `git push -u origin feat/ghep-doi-nhu-cau`, mở PR vào `main` (thân PR tóm tắt hai đợt, kết thúc bằng `🤖 Generated with [Claude Code](https://claude.com/claude-code)`), gắn PR vào phiên bằng công cụ ccd_pr.
