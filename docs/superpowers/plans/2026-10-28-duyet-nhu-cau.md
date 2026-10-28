# Kiểm duyệt "Đăng nhu cầu" — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhu cầu mở cho chủ nhà phải qua kiểm duyệt: sạch thì duyệt ngay, có dấu hiệu spam thì chờ quản trị.

**Architecture:** Thêm trạng thái `DemandReview` vào `SavedSearch`; `DemandExpiry.OpenAt` chỉ nhận nhu cầu đã duyệt nên mọi chỗ đọc tự lọc. Quy tắc thuần `DemandScreening` quyết định giữ hay duyệt; `SavedSearchService` gọi nó khi mở / bật lại / đổi lời nhắn. Quản trị duyệt qua `AdminDemandsController` và trang `/admin/nhu-cau`.

**Tech Stack:** ASP.NET Core 8, EF Core 8 + PostgreSQL, xUnit · React 19, TanStack Router/Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-duyet-nhu-cau-design.md`

## Global Constraints

- Nhánh `feat/duyet-nhu-cau`. Commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `DemandReviewStatus`: `Approved = 1`, `Pending = 2`, `Rejected = 3`; cột mặc định `1` (dữ liệu cũ = đã duyệt).
- Ngưỡng đăng dày: từ nhu cầu mở thứ 4 trong 24 giờ (≥3 cái khác có `DiscoverableSince` trong 24 giờ qua).
- Lý do hiện cho người dùng đúng nguyên văn bảng mục 4 của đặc tả.
- Lý do từ chối bắt buộc, ≤300 ký tự.
- Không tắt máy chủ của người dùng ở 7129/8081; bin bị khoá thì `dotnet test -c Release`.
- Lint: chỉ chạy `eslint --fix` trên file mình sửa (máy có CRLF làm prettier báo hàng nghìn lỗi `␍` có sẵn).

## Review Focus

1. **Số tiền bị nhầm là số điện thoại** ("dưới 5.000.000", "4,5 triệu") → nhu cầu sạch bị giữ oan. Test: `DemandScreeningTests.SoTien_KhongPhaiSoDienThoai` (Task 1).
2. **Sửa lời nhắn của nhu cầu đã duyệt thành có số điện thoại** → phải quay về chờ duyệt, chủ nhà không thấy nữa. Test: `DemandScreeningTests` không đủ — kiểm ở Task 2 bằng `SavedSearchReviewTests.SuaLoiNhan_ThemSoDienThoai_ChoDuyetLai` trên hàm thuần `DemandScreening.NeedsRescreen`.
3. **Nhu cầu chờ duyệt lọt vào Nhịp cầu hoặc danh sách chủ nhà** → `OpenAt` phải loại. Test: `DemandExpiryTests.OpenAt_BoQuaChuaDuyet` (Task 1).
4. **Quản trị duyệt một nhu cầu người dùng đã tắt hoặc đã xoá** → 404/409, không lỗi 500. Test: kiểm tra trên trình duyệt/API ở Task 5.
5. **Viết lách tránh lọc** ("0 9 0 1 2 3 4 5 6 7", "zalo" viết hoa, có dấu) → vẫn bắt. Test: `DemandScreeningTests.SoDienThoai_CoDauCach_VanBat`, `KenhRieng_KhongPhanBietHoaThuongVaDau` (Task 1).

---

### Task 1: Trạng thái duyệt, quy tắc `DemandScreening`, `OpenAt`, migration

**Files:**
- Create: `kgs-api/kgs-api/Domain/Rules/DemandScreening.cs`
- Modify: `kgs-api/kgs-api/Domain/Enums.cs` (thêm `DemandReviewStatus`), `Domain/Entity/SubEntity/SavedSearch.cs`, `Domain/Rules/DemandExpiry.cs` (`OpenAt`)
- Create: migration `AddDemandReview`
- Test: `kgs-api/kgs-api.Tests/DemandScreeningTests.cs`, `DemandExpiryTests.cs`

**Interfaces:**
- Produces: `SavedSearch.DemandReview : DemandReviewStatus` (mặc định `Approved`), `DemandReviewReason : string?` (≤300), `DemandReviewedAt : DateTime?`; `static IReadOnlyList<string> DemandScreening.Screen(string name, string? note, bool emailConfirmed, int openedLast24h)`; `static bool DemandScreening.NeedsRescreen(string? oldNote, string? newNote)` (true khi lời nhắn đã chuẩn hoá khác nhau).

- [ ] **Step 1: Test hỏng** — `DemandScreeningTests`: `LoiNhanBinhThuong_Sach` ("2 người đi làm Quận 1, dọn vào đầu tháng" → rỗng); `LienKet_BiGiu` ("xem thêm tại abc.vn" → chứa "Lời nhắn có đường liên kết"); `SoDienThoai_BiGiu` ("gọi 0901234567"); `SoDienThoai_CoDauCach_VanBat` ("0 9 0 1 . 2 3 4 . 5 6 7"); `SoTien_KhongPhaiSoDienThoai` ("dưới 5.000.000, tối đa 4,5 triệu" → rỗng); `Email_BiGiu`; `KenhRieng_KhongPhanBietHoaThuongVaDau` ("liên hệ ZALO"); `RaoVat_BiGiu` ("môi giới nhà đất uy tín"); `ChuaXacThucEmail_BiGiu`; `DangDay_TuCaiThuTu` (openedLast24h 3 → giữ, 2 → sạch); `KiemTraCaTen` (tên chứa số điện thoại). `NeedsRescreen`: khác → true, chỉ khác khoảng trắng → false. `DemandExpiryTests.OpenAt_BoQuaChuaDuyet`: Pending và Rejected bị loại.
- [ ] **Step 2: Chạy, thấy hỏng** — `dotnet test kgs-api/kgs-api.Tests -c Release --filter "DemandScreeningTests|DemandExpiryTests"`.
- [ ] **Step 3: Cài đặt** — số điện thoại: bỏ dấu cách/chấm/gạch/ngoặc giữa các chữ số, tìm chuỗi 9–11 chữ số bắt đầu bằng `0` hoặc `84`; số tiền như "5.000.000" có 7 chữ số không bắt đầu bằng 0 nên không khớp. Chuẩn hoá chữ: bỏ dấu, `đ→d`, chữ thường trước khi so từ khoá. `OpenAt` thêm `&& s.DemandReview == DemandReviewStatus.Approved`.
- [ ] **Step 4: Migration** `dotnet ef migrations add AddDemandReview` (cột `DemandReview` int not null default 1).
- [ ] **Step 5: Chạy toàn bộ test** → PASS. Commit `feat(duyet-nhu-cau): trạng thái duyệt và bộ lọc spam tự động`.

### Task 2: Kiểm tra khi đăng / bật / sửa lời nhắn

**Files:** Modify `Services/SavedSearchService.cs`, `Dtos/SavedSearchDtos.cs`; test `kgs-api.Tests/SavedSearchReviewTests.cs` (cho `NeedsRescreen` + `Decide` bên dưới).

**Interfaces:**
- Consumes: Task 1.
- Produces: `SavedSearchDto` thêm cuối `DemandReviewStatus DemandReview, string? DemandReviewReason`; `static (DemandReviewStatus, string?) DemandScreening.Decide(IReadOnlyList<string> reasons)` → `(Approved, null)` hoặc `(Pending, string.Join("; ", reasons))`.

- [ ] **Step 1: Test hỏng** — `Decide_Rong_DuyetNgay`, `Decide_CoLyDo_ChoDuyet_GopLyDo`, `SuaLoiNhan_ThemSoDienThoai_ChoDuyetLai` (NeedsRescreen true + Screen ra lý do).
- [ ] **Step 2: Chạy, thấy hỏng.**
- [ ] **Step 3: Nối vào service** — một hàm riêng `private async Task ScreenAsync(SavedSearch s, CancellationToken ct)`: đọc `EmailConfirmed` của người dùng (UserManager hoặc repository người dùng sẵn có), đếm nhu cầu khác của họ có `DiscoverableSince` ≥ now−24h, `Decide`, ghi `DemandReview`, `DemandReviewReason`, `DemandReviewedAt = null`. Gọi ở: `CreateAsync` khi `Discoverable`; `SetDiscoverableAsync` khi bật (mọi lần) hoặc khi `NeedsRescreen(cũ, mới)`; `RenewAsync` khi đang `Rejected`. Ghi `DemandNote` mới TRƯỚC khi gọi `ScreenAsync`.
- [ ] **Step 4: Toàn bộ test** → PASS. Commit `feat(duyet-nhu-cau): tự kiểm tra khi đăng, bật lại và sửa lời nhắn`.

### Task 3: API quản trị + thông báo + chỉ số

**Files:** Create `Controllers/AdminDemandsController.cs`, `Services/Admin/AdminDemandService.cs` (+ interface, DI), `Dtos/AdminDemandDtos.cs`; Modify `Services/Admin/AdminOverviewService.cs` (`MatchmakingStatsDto` thêm cuối `int PendingReview = 0`).

**Interfaces:**
- Produces: `[Authorize(Roles="Admin")] [Route("api/admin/demands")]`: `GET pending` → `IReadOnlyList<AdminDemandDto>`; `POST {id}/approve`; `POST {id}/reject` body `RejectDemandRequest([Required, MaxLength(300)] string Reason)`; `POST bulk` body `BulkDemandRequest(List<Guid> Ids, bool Approve, string? Reason)` → `{ handled, skipped }`. `AdminDemandDto(Guid Id, string Name, PublicListingSearchQuery Criteria, string? Note, string? ReviewReason, DateTime SubmittedAt, string UserName, string Email, bool EmailConfirmed, DateTime UserJoinedAt)` — `Criteria` đã bỏ toạ độ như `ToAnonymous`.
- Duyệt: chỉ khi `DiscoverableByOwners && DemandReview == Pending` (khác → 409 "Nhu cầu không còn chờ duyệt"); không tìm thấy → 404. Duyệt: `Approved`, `ReviewReason = null`, `DemandReviewedAt = now`; thông báo người tìm "Nhu cầu “{Name}” đã được duyệt" · "Chủ nhà phù hợp giờ đã thấy nhu cầu của bạn và có thể mời bạn xem nhà." · `/nhu-cau` · "Xem nhu cầu". Từ chối: `Rejected`, `ReviewReason = reason`; thông báo "Nhu cầu “{Name}” chưa được duyệt" · "Lý do: {reason}. Sửa lời nhắn rồi gửi lại trong trang Nhu cầu của tôi." Thông báo gửi sau `SaveChanges`, lỗi gửi chỉ ghi log.

- [ ] **Step 1:** Cài đặt; build sạch.
- [ ] **Step 2:** Thử bằng API với tài khoản quản trị dev: tạo nhu cầu có số điện thoại (người tìm mẫu) → `pending` thấy nó → `approve` → `GET /api/matchmaking/...`/Nhịp cầu có tính nó; tạo cái khác → `reject` → 409 khi duyệt lại.
- [ ] **Step 3:** Commit `feat(duyet-nhu-cau): hàng đợi duyệt nhu cầu cho quản trị`.

### Task 4: Giao diện người tìm

**Files:** Modify `quanly-tai-san/src/lib/api/savedSearches.ts`, `components/demand/PostDemandDialog.tsx`, `components/demand/MyDemandCard.tsx`, `components/public/SavedSearchesPopover.tsx`.

**Interfaces:** `SavedSearchDto` thêm `demandReview: 1 | 2 | 3`, `demandReviewReason: string | null`. `demandState` mới: `"open" | "pending" | "rejected" | "expired" | "alerts"` (pending/rejected chỉ khi `discoverableByOwners`).

- [ ] **Step 1: Test hỏng** (Vitest, `components/demand/demandState.test.ts`, tách `demandState` ra `lib/demandState.ts`): đã duyệt còn hạn → `open`; `demandReview 2` → `pending`; `3` → `rejected`; tắt + hạn qua → `expired`.
- [ ] **Step 2–3:** Cài đặt. Toast sau khi đăng / bật: `demandReview === 2` → `"Đã gửi — đang chờ duyệt"` + mô tả `"Lý do: {reason}. Bạn sẽ nhận thông báo khi có kết quả."`; còn lại giữ toast cũ. `MyDemandCard`: nhãn "Chờ duyệt" (vàng, kèm lý do), "Bị từ chối" (đỏ nhạt, lý do + nút "Sửa lời nhắn và gửi lại" mở ô sửa sẵn có); chỉ `open` hiện "Đang mở cho chủ nhà".
- [ ] **Step 4:** tsc, Vitest, eslint (file đã sửa) sạch. Commit `feat(duyet-nhu-cau): người tìm thấy trạng thái chờ duyệt và lý do`.

### Task 5: Trang quản trị + kiểm tra toàn bộ

**Files:** Create `quanly-tai-san/src/routes/admin.nhu-cau.tsx`, `lib/api/adminDemands.ts`; Modify `components/layout/AdminShell.tsx` (mục "Duyệt nhu cầu", icon `Handshake`, huy hiệu = số pending), `routes/admin.overview.tsx` (ô "Nhu cầu chờ duyệt"), route tree.

- [ ] **Step 1:** Trang theo khuôn `admin.listings.tsx`: thẻ mỗi nhu cầu (tên, `describeDemand(criteria)`, lời nhắn, lý do bị giữ dạng nhãn, người đăng + email + "chưa xác thực" nếu có, thời điểm), nút Duyệt, Từ chối (hộp nhập lý do, bắt buộc, gợi ý sẵn "Lời nhắn có thông tin liên lạc", "Nội dung quảng cáo"), chọn nhiều + duyệt hàng loạt. Trống: "Không có nhu cầu nào chờ duyệt."
- [ ] **Step 2:** tsc/Vitest/eslint; `dotnet test` toàn bộ.
- [ ] **Step 3: Trình duyệt** — áp migration; người tìm mẫu đăng nhu cầu sạch → hiện ngay; đăng nhu cầu có số điện thoại → "Chờ duyệt", chủ nhà không thấy trong danh sách; quản trị thấy trong hàng đợi, duyệt → chủ nhà thấy, người tìm nhận thông báo; từ chối cái khác → nhãn và lý do ở `/nhu-cau`.
- [ ] **Step 4:** Commit, review toàn nhánh, đẩy nhánh và đưa liên kết tạo PR.
