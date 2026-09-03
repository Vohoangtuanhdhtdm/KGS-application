using CloudinaryDotNet.Actions;
using kgs_api.Common.Filters;
using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.ValueObjects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;


namespace kgs_api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/dev/seed")]
    public sealed class SeedController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory;
        private readonly IWebHostEnvironment _env;

        public SeedController(
            ApplicationDbContext db,
            ICurrentUserService currentUser,
            GeometryFactory geometryFactory,
            IWebHostEnvironment env)
        {
            _db = db;
            _currentUser = currentUser;
            _geometryFactory = geometryFactory;
            _env = env;
        }

        [HttpPost]
        public async Task<IActionResult> Seed([FromQuery] bool force = false, CancellationToken ct = default)
        {
            if (!_env.IsDevelopment())
                return NotFound();

            var userId = _currentUser.UserId;

            var existing = await _db.Assets.CountAsync(a => a.UserId == userId, ct);
            if (existing > 0 && !force)
                return Conflict(new
                {
                    message = $"Tài khoản đã có {existing} tài sản. Gọi lại với ?force=true để xoá sạch và tạo lại.",
                    existingAssets = existing
                });

            if (force && existing > 0)
            {
                // Xoá theo đúng thứ tự tránh vi phạm FK — Asset trước (cascade dọn theo toàn
                // bộ bảng con, nay gồm cả Listings và ListingImages), Reminder/CashFlow độc
                // lập, Contact xoá sau cùng vì FK Restrict từ LeaseContract.
                var oldAssets = await _db.Assets.Where(a => a.UserId == userId).ToListAsync(ct);
                _db.Assets.RemoveRange(oldAssets);
                var oldReminders = await _db.Reminders.Where(r => r.UserId == userId).ToListAsync(ct);
                _db.Reminders.RemoveRange(oldReminders);
                await _db.SaveChangesAsync(ct);

                var oldContacts = await _db.ContactParties.Where(c => c.UserId == userId).ToListAsync(ct);
                _db.ContactParties.RemoveRange(oldContacts);
                await _db.SaveChangesAsync(ct);
            }

            var now = DateTime.UtcNow;

            // ---------- 1. ĐỐI TÁC ----------
            var tenant = new ContactParty { UserId = userId, Type = ContactType.Tenant, FullName = "Nguyễn Văn An", Phone = "0901234567", Email = "an.nguyen@example.com" };
            var landlord = new ContactParty { UserId = userId, Type = ContactType.Landlord, FullName = "Trần Thị Bình", Phone = "0912345678" };
            var broker = new ContactParty { UserId = userId, Type = ContactType.Broker, FullName = "Lê Minh Cường", Phone = "0923456789", Email = "cuong.le@example.com" };
            var vendor = new ContactParty { UserId = userId, Type = ContactType.Vendor, FullName = "Cơ sở sửa chữa Đại Phát", Phone = "0934567890" };
            await _db.ContactParties.AddRangeAsync(new[] { tenant, landlord, broker, vendor }, ct);

            // ---------- 2. TÀI SẢN — nay có đủ 6 trường marketing mới ----------
            var asset1 = new Asset
            {
                UserId = userId,
                Name = "Nhà phố Quận 7",
                TypeProperty = AssetDomainType.PrivateHouse,
                OwnershipType = AssetOwnershipType.Owned,
                Status = AssetStatus.RentedOut,
                Address = new Address { City = "TP. Hồ Chí Minh", District = "Quận 7", Ward = "Phường Tân Phong", Detail = "123 Nguyễn Thị Thập" },
                Location = Point(106.7219, 10.7300),
                Area = 120,
                CurrentValue = 8_500_000_000m,
                AcquisitionDate = now.AddYears(-5),
                Notes = "Nhà 3 tầng, hướng Đông Nam.",
                // ← MỚI
                Floors = 3,
                Bedrooms = 4,
                Bathrooms = 3,
                HouseDirection = "Đông Nam",
                LegalStatus = "Sổ hồng riêng",
                FurnitureState = "Đầy đủ"
            };

            var asset2 = new Asset
            {
                UserId = userId,
                Name = "Chung cư mini Bình Thạnh",
                TypeProperty = AssetDomainType.Apartment,
                OwnershipType = AssetOwnershipType.Leasehold,
                Status = AssetStatus.RentedOut,
                Address = new Address { City = "TP. Hồ Chí Minh", District = "Quận Bình Thạnh", Ward = "Phường 25", Detail = "45 Điện Biên Phủ" },
                Location = Point(106.7100, 10.8010),
                Area = 200,
                AcquisitionDate = now.AddMonths(-8),
                Notes = "Thuê nguyên căn từ chủ, chia 4 phòng cho thuê lại.",
                // ← MỚI
                Floors = 4,
                Bedrooms = 1,
                Bathrooms = 1,
                HouseDirection = "Tây Nam",
                LegalStatus = "Hợp đồng thuê dài hạn",
                FurnitureState = "Cơ bản"
            };

            var asset3 = new Asset
            {
                UserId = userId,
                Name = "Đất nền TP. Thủ Đức",
                TypeProperty = AssetDomainType.Land,
                OwnershipType = AssetOwnershipType.Owned,
                Status = AssetStatus.ForSale,
                Address = new Address { City = "TP. Hồ Chí Minh", District = "TP. Thủ Đức", Ward = "Phường Long Trường", Detail = "Lô A12, KDC Nam Long" },
                Location = Point(106.8080, 10.8100),
                Area = 100,
                CurrentValue = 4_200_000_000m,
                AcquisitionDate = now.AddYears(-3)
                // Đất — không có Floors/Bedrooms/Bathrooms/nội thất, để trống hợp lý
            };

            // ← MỚI — tài sản thứ 4, chỉ để test tin đăng ở trạng thái Chờ duyệt
            var asset4 = new Asset
            {
                UserId = userId,
                Name = "Căn hộ Demo Quận 2",
                TypeProperty = AssetDomainType.Apartment,
                OwnershipType = AssetOwnershipType.Owned,
                Status = AssetStatus.ForSale,
                Address = new Address { City = "TP. Hồ Chí Minh", District = "TP. Thủ Đức (Q2 cũ)", Ward = "Phường Thảo Điền", Detail = "88 Xa lộ Hà Nội" },
                Location = Point(106.7500, 10.8050),
                Area = 75,
                CurrentValue = 3_000_000_000m,
                AcquisitionDate = now.AddYears(-1),
                Floors = 1,
                Bedrooms = 2,
                Bathrooms = 2,
                HouseDirection = "Đông",
                LegalStatus = "Sổ hồng riêng",
                FurnitureState = "Đầy đủ"
            };

            await _db.Assets.AddRangeAsync(new[] { asset1, asset2, asset3, asset4 }, ct);

            // ---------- 3. PHÒNG (cho asset2) ----------
            var unit1 = new AssetUnit { Asset = asset2, Name = "Phòng 101", FloorNumber = 1, Area = 30, Status = UnitStatus.Occupied };
            var unit2 = new AssetUnit { Asset = asset2, Name = "Phòng 102", FloorNumber = 1, Area = 30, Status = UnitStatus.Vacant };
            var unit3 = new AssetUnit { Asset = asset2, Name = "Phòng 201", FloorNumber = 2, Area = 35, Status = UnitStatus.Occupied };
            var unit4 = new AssetUnit { Asset = asset2, Name = "Phòng 202", FloorNumber = 2, Area = 35, Status = UnitStatus.UnderMaintenance };
            await _db.AssetUnits.AddRangeAsync(new[] { unit1, unit2, unit3, unit4 }, ct);

            // ---------- 4. HỢP ĐỒNG ----------
            var contract1 = new LeaseContract
            {
                Asset = asset1,
                AssetUnitId = null,
                Direction = ContractDirection.LeaseOut,
                Status = ContractStatus.Active,
                Counterparty = tenant,
                StartDate = now.AddMonths(-11),
                EndDate = now.AddDays(20),
                RentAmount = 25_000_000m,
                PaymentCycle = PaymentCycle.Monthly,
                PaymentDueDay = 5,
                DepositAmount = 50_000_000m,
                TaxResponsibility = TaxResponsibility.Landlord,
                Notes = "Hợp đồng 12 tháng, thanh toán đầu tháng."
            };
            var contract2 = new LeaseContract
            {
                Asset = asset2,
                AssetUnitId = null,
                Direction = ContractDirection.LeaseIn,
                Status = ContractStatus.Active,
                Counterparty = landlord,
                StartDate = now.AddMonths(-8),
                EndDate = now.AddMonths(16),
                RentAmount = 30_000_000m,
                PaymentCycle = PaymentCycle.Monthly,
                PaymentDueDay = 1,
                DepositAmount = 60_000_000m,
                TaxResponsibility = TaxResponsibility.Landlord,
                Notes = "Thuê nguyên căn 24 tháng."
            };
            var contract3 = new LeaseContract
            {
                Asset = asset2,
                AssetUnit = unit1,
                Direction = ContractDirection.LeaseOut,
                Status = ContractStatus.Active,
                Counterparty = tenant,
                StartDate = now.AddMonths(-6),
                EndDate = now.AddMonths(6),
                RentAmount = 6_500_000m,
                PaymentCycle = PaymentCycle.Monthly,
                PaymentDueDay = 10,
                DepositAmount = 6_500_000m,
                TaxResponsibility = TaxResponsibility.Landlord
            };
            await _db.LeaseContracts.AddRangeAsync(new[] { contract1, contract2, contract3 }, ct);

            // ---------- 5. SỔ THU CHI — 6 tháng gần nhất ----------
            var cashFlows = new List<CashFlowEntry>();
            for (int i = 5; i >= 0; i--)
            {
                var month = now.AddMonths(-i);
                cashFlows.Add(new CashFlowEntry { UserId = userId, Asset = asset1, LeaseContract = contract1, Direction = CashFlowDirection.Income, Category = CashFlowCategory.RentIncome, Amount = 25_000_000m, OccurredAt = month, Description = $"Tiền thuê tháng {month:MM/yyyy} — Nhà phố Quận 7" });
                cashFlows.Add(new CashFlowEntry { UserId = userId, Asset = asset2, LeaseContract = contract2, Direction = CashFlowDirection.Expense, Category = CashFlowCategory.RentExpense, Amount = 30_000_000m, OccurredAt = month, Description = $"Trả tiền thuê chủ nhà tháng {month:MM/yyyy}" });
                cashFlows.Add(new CashFlowEntry { UserId = userId, Asset = asset2, AssetUnit = unit1, LeaseContract = contract3, Direction = CashFlowDirection.Income, Category = CashFlowCategory.RentIncome, Amount = 6_500_000m, OccurredAt = month, Description = $"Tiền thuê phòng 101 tháng {month:MM/yyyy}" });
                cashFlows.Add(new CashFlowEntry { UserId = userId, Asset = asset2, Direction = CashFlowDirection.Expense, Category = CashFlowCategory.ElectricityBill, Amount = 2_800_000m + (i * 100_000), OccurredAt = month.AddDays(3), Description = $"Tiền điện tháng {month:MM/yyyy}" });
                cashFlows.Add(new CashFlowEntry { UserId = userId, Asset = asset2, Direction = CashFlowDirection.Expense, Category = CashFlowCategory.WaterBill, Amount = 900_000m, OccurredAt = month.AddDays(3), Description = $"Tiền nước tháng {month:MM/yyyy}" });
            }
            var yearStart = new DateTime(now.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            cashFlows.Add(new CashFlowEntry { UserId = userId, Asset = asset1, Direction = CashFlowDirection.Expense, Category = CashFlowCategory.BusinessLicenseTax, Amount = 1_000_000m, OccurredAt = yearStart.AddDays(20), Description = "Thuế môn bài năm " + now.Year });
            cashFlows.Add(new CashFlowEntry { UserId = userId, Asset = asset1, Direction = CashFlowDirection.Expense, Category = CashFlowCategory.PersonalIncomeTax, Amount = 15_000_000m, OccurredAt = yearStart.AddMonths(1), Description = "Thuế TNCN 5% tiền cho thuê" });
            cashFlows.Add(new CashFlowEntry { UserId = userId, Asset = asset1, Direction = CashFlowDirection.Expense, Category = CashFlowCategory.ValueAddedTax, Amount = 15_000_000m, OccurredAt = yearStart.AddMonths(1), Description = "Thuế GTGT 5% tiền cho thuê" });
            cashFlows.Add(new CashFlowEntry { UserId = userId, Asset = asset3, Direction = CashFlowDirection.Expense, Category = CashFlowCategory.NonAgriculturalLandTax, Amount = 2_400_000m, OccurredAt = yearStart.AddMonths(2), Description = "Thuế sử dụng đất phi nông nghiệp" });
            await _db.CashFlowEntries.AddRangeAsync(cashFlows, ct);

            // ---------- 6. NHẮC LỊCH ----------
            var reminders = new List<Reminder>
            {
                new() { UserId = userId, Asset = asset1, LeaseContract = contract1, Type = ReminderType.RentCollection, Title = "Thu tiền thuê: Nhà phố Quận 7", DueDate = NextMonthDay(now, 5), Cycle = RecurrenceCycle.Monthly, NotifyDaysBefore = 3, IsActive = true },
                new() { UserId = userId, Asset = asset1, LeaseContract = contract1, Type = ReminderType.ContractExpiry, Title = "Hợp đồng sắp hết hạn: Nhà phố Quận 7", DueDate = contract1.EndDate, Cycle = RecurrenceCycle.None, NotifyDaysBefore = 30, IsActive = true },
                new() { UserId = userId, Asset = asset2, LeaseContract = contract2, Type = ReminderType.RentPayment, Title = "Đóng tiền thuê cho chủ nhà: Chung cư mini Bình Thạnh", DueDate = NextMonthDay(now, 1), Cycle = RecurrenceCycle.Monthly, NotifyDaysBefore = 3, IsActive = true },
                new() { UserId = userId, Asset = asset1, Type = ReminderType.TaxDue, Title = "Đóng thuế môn bài năm sau", DueDate = new DateTime(now.Year + 1, 1, 30, 0, 0, 0, DateTimeKind.Utc), Cycle = RecurrenceCycle.Annually, NotifyDaysBefore = 15, IsActive = true },
                new() { UserId = userId, Asset = asset2, Type = ReminderType.Maintenance, Title = "Bảo dưỡng máy lạnh định kỳ", DueDate = now.AddDays(5), Cycle = RecurrenceCycle.SemiAnnually, NotifyDaysBefore = 7, IsActive = true }
            };
            await _db.Reminders.AddRangeAsync(reminders, ct);

            // ---------- 9. GIẤY TỜ ----------
            await _db.AssetDocuments.AddRangeAsync(new[]
            {
                new AssetDocument { Asset = asset1, Type = DocumentType.LandTitle, Title = "Sổ hồng nhà phố Quận 7", File = new StoredFile { Url = "https://placeholder.example/sohong.pdf", PublicId = "seed/sohong-q7", FileName = "so-hong.pdf", ContentType = "application/pdf" }, IssueDate = now.AddYears(-5) },
                new AssetDocument { Asset = asset1, Type = DocumentType.ElectricityContract, Title = "Hợp đồng điện lực", File = new StoredFile { Url = "https://placeholder.example/hd-dien.pdf", PublicId = "seed/hd-dien", FileName = "hd-dien.pdf", ContentType = "application/pdf" }, IssueDate = now.AddYears(-2), ExpiryDate = now.AddDays(25) },
                new AssetDocument { Asset = asset2, LeaseContract = contract2, Type = DocumentType.LeaseContract, Title = "HĐ thuê nguyên căn từ chủ nhà", File = new StoredFile { Url = "https://placeholder.example/hd-thue.pdf", PublicId = "seed/hd-thue", FileName = "hd-thue.pdf", ContentType = "application/pdf" }, IssueDate = now.AddMonths(-8), ExpiryDate = contract2.EndDate }
            }, ct);

            // ---------- 10. LƯU KHỐI NGHIỆP VỤ ----------
            // Tách khỏi khối Property bên dưới cho rõ ràng.
            await _db.SaveChangesAsync(ct);

            // ================================================================
            // 11. ⭐ MỚI — PROPERTY (TIN ĐĂNG CÔNG KHAI), rải theo khoảng cách
            // để test tìm kiếm bán kính (patch-10) và bố cục marketplace mới.
            //
            // Điểm tham chiếu để test: trung tâm Quận 1 — (10.7769, 106.7009)
            // Khoảng cách dưới đây là gần đúng (đủ để test): 0.01 độ vĩ/kinh
            // ≈ 1.1km ở khu vực TP.HCM.
            //
            // ⚠️ Ảnh dùng URL Unsplash công khai — KHÔNG PHẢI ảnh Cloudinary
            // thật của bạn, chỉ để có thumbnail hiển thị khi test giao diện.
            // PublicId đặt dạng "seed/..." không trỏ file Cloudinary thật nào
            // — khi Clear/force xoá, không gọi qua IFileStorageService nên
            // không có tác dụng phụ gì.
            // ================================================================

            const string img1 = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800";
            const string img2 = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800";
            const string img3 = "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800";
            const string img4 = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800";

            StoredFile SeedImage(string url, string tag) => new()
            {
                Url = url,
                PublicId = $"seed/{tag}",
                FileName = $"{tag}.jpg",
                ContentType = "image/jpeg",
                SizeBytes = 250_000
            };

            // Tin đăng nay là BẢN ĐĂNG của tài sản: không còn sao chép địa chỉ, diện tích,
            // toạ độ hay đặc điểm sang một bảng thứ hai. Nhờ vậy khối seed này ngắn đi
            // khoảng hai phần ba so với trước, và không thể có chuyện tin đăng nói một
            // đằng còn tài sản nói một nẻo — đúng lỗi mà bản seed cũ đang mắc phải
            // (Property của nhà Quận 7 gắn toạ độ nằm ở Quận 4).
            var listing1 = new Listing
            {
                Asset = asset1,
                Title = "Bán nhà phố Quận 7 view đẹp — Demo",
                Description = "Nhà 3 tầng, khu an ninh, gần trường học. Dữ liệu demo để kiểm thử tìm kiếm theo bán kính.",
                Price = 8_500_000_000m,
                Type = ListingType.Sale,
                Status = ListingStatus.Approved,
                Slug = $"ban-nha-pho-quan-7-demo-{Guid.NewGuid().ToString("N")[..6]}",
                ViewCount = 12,
                PublishedAt = now.AddDays(-6),
                Terms = new ListingTerms { DepositMonths = 1, AvailableFrom = now },
                Amenities = new List<string> { AmenityKeys.Parking, AmenityKeys.Security },
                Images = new List<ListingImage> { new() { File = SeedImage(img1, "nha-q7"), SortOrder = 0 } }
            };

            // Tin 2 — CHO THUÊ THEO PHÒNG. Đây là thứ hệ thống cũ không làm được: tin đăng
            // gắn với AssetUnit chứ không phải cả toà nhà. Đúng nghiệp vụ của người thuê
            // nguyên căn rồi chia phòng cho thuê lại.
            var listing2 = new Listing
            {
                Asset = asset2,
                AssetUnit = unit2,
                Title = "Cho thuê phòng 102 — chung cư mini Bình Thạnh",
                Description = "Phòng 30m², nội thất cơ bản, giờ giấc tự do, gần chợ và trường học. Dữ liệu demo.",
                Price = 6_500_000m,
                Type = ListingType.Rent,
                RentPaymentCycle = PaymentCycle.Monthly,
                Status = ListingStatus.Approved,
                Slug = $"cho-thue-phong-102-binh-thanh-demo-{Guid.NewGuid().ToString("N")[..6]}",
                ViewCount = 34,
                PublishedAt = now.AddDays(-3),
                // Tin đăng theo phòng khai đủ điều kiện thuê — dùng để demo bộ lọc
                // "dưới 8 triệu tổng chi phí, cho nuôi thú cưng, giờ giấc tự do".
                Terms = new ListingTerms
                {
                    DepositMonths = 1,
                    ElectricityPrice = 3_800m,
                    WaterPrice = 100_000m,
                    WaterPricing = WaterPricingMode.PerPerson,
                    ServiceFee = 150_000m,
                    ParkingFee = 100_000m,
                    InternetFee = 100_000m,
                    MinLeaseMonths = 6,
                    AvailableFrom = now.AddDays(7),
                    MaxOccupants = 2,
                    PetsAllowed = true,
                    CurfewFree = true,
                    SharedWithOwner = false,
                    CookingAllowed = true
                },
                Amenities = new List<string>
                {
                    AmenityKeys.AirConditioner, AmenityKeys.WaterHeater,
                    AmenityKeys.PrivateBathroom, AmenityKeys.Window,
                    AmenityKeys.Wifi, AmenityKeys.Parking
                },
                Images = new List<ListingImage> { new() { File = SeedImage(img2, "phong-102"), SortOrder = 0 } }
            };

            var listing3 = new Listing
            {
                Asset = asset3,
                Title = "Bán đất nền TP. Thủ Đức, sổ riêng — Demo",
                Description = "Lô góc 100m², sổ hồng riêng, đường 12m. Dữ liệu demo.",
                Price = 4_200_000_000m,
                Type = ListingType.Sale,
                Status = ListingStatus.Approved,
                Slug = $"ban-dat-nen-thu-duc-demo-{Guid.NewGuid().ToString("N")[..6]}",
                ViewCount = 8,
                PublishedAt = now.AddDays(-15),
                Images = new List<ListingImage> { new() { File = SeedImage(img3, "dat-thu-duc"), SortOrder = 0 } }
            };

            // Tin 4 — CHỜ DUYỆT: phải KHÔNG xuất hiện ở marketplace công khai.
            var listing4 = new Listing
            {
                Asset = asset4,
                Title = "Bán căn hộ Quận 2 (chờ duyệt) — Demo",
                Description = "Căn hộ 2 phòng ngủ, bàn giao nội thất. Tin này dùng để kiểm thử luồng kiểm duyệt.",
                Price = 3_900_000_000m,
                Type = ListingType.Sale,
                Status = ListingStatus.Pending,
                Slug = $"ban-can-ho-quan-2-cho-duyet-demo-{Guid.NewGuid().ToString("N")[..6]}",
                ViewCount = 0,
                Images = new List<ListingImage> { new() { File = SeedImage(img4, "can-ho-q2"), SortOrder = 0 } }
            };

            await _db.Listings.AddRangeAsync(new[] { listing1, listing2, listing3, listing4 }, ct);

            // MỘT SaveChanges. Bản cũ phải gọi hai lần vì Property có khoá int identity và
            // Asset.LinkedPropertyId cần Id thật; quan hệ nay đã đảo chiều nên hết ràng buộc đó.
            await _db.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Đã tạo dữ liệu mẫu thành công (Listing = bản đăng của Asset).",
                created = new
                {
                    assets = 4,
                    assetUnits = 4,
                    contacts = 4,
                    leaseContracts = 3,
                    cashFlowEntries = cashFlows.Count,
                    reminders = reminders.Count,
                    documents = 3,
                    listings = 4
                },
                assetIds = new[] { asset1.Id, asset2.Id, asset3.Id, asset4.Id },
                listingSlugs = new
                {
                    banNhaQ7 = listing1.Slug,
                    choThuePhong102 = listing2.Slug,
                    banDatThuDuc = listing3.Slug,
                    choDuyet = listing4.Slug
                },
                nextSteps = new[]
                {
                    "GET /api/listings/search — phải thấy 3 tin (tin chờ duyệt không hiện)",
                    "GET /api/listings/search?latitude=10.7769&longitude=106.7009&radiusMeters=5000 — chỉ thấy phòng 102 Bình Thạnh (~2.9km)",
                    "GET /api/listings/search?latitude=10.7769&longitude=106.7009&radiusMeters=10000 — thêm nhà phố Quận 7 (~5.7km)",
                    "GET /api/listings/search?latitude=10.7769&longitude=106.7009&radiusMeters=15000 — thấy cả 3 tin",
                    "Toạ độ nay lấy TỪ TÀI SẢN, không còn cột riêng trên tin đăng — sửa vị trí tài sản là tin đăng đổi theo",
                    "Tin phòng 102 gắn AssetUnit: đây là đăng tin THEO PHÒNG, thứ bản cũ không làm được",
                    "Đăng nhập Admin → GET /api/admin/listings/pending → thấy tin Quận 2 → duyệt thử",
                    "GET /api/assets/nearby?latitude=10.7769&longitude=106.7009&radiusMeters=15000 — PostGIS cho Asset",
                    "GET /api/contracts/expiring?days=30 — phải thấy HĐ Nhà phố Quận 7",
                    "GET /api/reports/tax?year=" + now.Year + " — báo cáo thuế"
                }
            });
        }

        [HttpDelete]
        public async Task<IActionResult> Clear(CancellationToken ct)
        {
            if (!_env.IsDevelopment())
                return NotFound();

            var userId = _currentUser.UserId;

            // Listings cascade theo Assets (FK OnDelete.Cascade) nên không cần xoá riêng —
            // trước đây Property đứng độc lập nên phải xoá bằng tay trước.
            var assets = await _db.Assets.Where(a => a.UserId == userId).ToListAsync(ct);
            var reminders = await _db.Reminders.Where(r => r.UserId == userId).ToListAsync(ct);
            var cashFlows = await _db.CashFlowEntries.Where(c => c.UserId == userId).ToListAsync(ct);
            _db.CashFlowEntries.RemoveRange(cashFlows);
            _db.Reminders.RemoveRange(reminders);
            _db.Assets.RemoveRange(assets);
            await _db.SaveChangesAsync(ct);

            var contacts = await _db.ContactParties.Where(c => c.UserId == userId).ToListAsync(ct);
            _db.ContactParties.RemoveRange(contacts);
            await _db.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Đã xoá sạch dữ liệu nghiệp vụ của tài khoản (tin đăng cascade theo tài sản).",
                removed = new { assets = assets.Count, contacts = contacts.Count, reminders = reminders.Count, cashFlows = cashFlows.Count }
            });
        }

        private NetTopologySuite.Geometries.Point Point(double longitude, double latitude)
            => _geometryFactory.CreatePoint(new Coordinate(longitude, latitude));

        private static DateTime NextMonthDay(DateTime from, int day)
        {
            var next = from.AddMonths(1);
            return new DateTime(next.Year, next.Month, Math.Min(day, DateTime.DaysInMonth(next.Year, next.Month)), 0, 0, 0, DateTimeKind.Utc);
        }
    }
}
