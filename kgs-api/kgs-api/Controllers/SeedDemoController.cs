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
    /// <summary>Dựng dữ liệu demo để chạy thử TOÀN BỘ chức năng Giai đoạn 1.
    ///
    /// Khác với <see cref="SeedCorpusController"/>: corpus kia có hợp đồng riêng — seed cố
    /// định, toàn tin cho thuê đã duyệt, một chủ — vì nó phục vụ đo lường truy hồi và phải
    /// cho ra cùng một tập dữ liệu qua mọi lần chạy. Đụng vào đó là làm hỏng khả năng so
    /// sánh giữa các lần đánh giá.
    ///
    /// Bộ này thì ngược lại: cố tình đa dạng, vì mỗi màn hình của Giai đoạn 1 cần một hình
    /// dạng dữ liệu khác nhau và một tập toàn tin-đã-duyệt sẽ khiến quá nửa số màn hình
    /// hiện ra trống trơn khi đem đi thử:
    ///
    ///   • hàng đợi kiểm duyệt   → phải có tin Pending
    ///   • vòng đời tin đăng     → phải có Draft, Rejected, Closed
    ///   • trang tìm kiếm        → phải có CẢ tin bán lẫn tin thuê (bộ lọc mặc định là Bán)
    ///   • biểu đồ thống kê      → phải có dòng ListingViews rải theo ngày, không chỉ ViewCount
    ///   • báo vi phạm           → phải có ÍT NHẤT HAI chủ tin, vì không ai tự báo tin mình
    ///   • hồ sơ người đăng      → nhiều chủ thì "N tin đang đăng" mới khác nhau
    ///   • tin tương tự          → nhiều tin cùng quận, cùng loại, giá gần nhau</summary>
    [ApiController]
    [Authorize]
    [Route("api/dev/demo-data")]
    public sealed class SeedDemoController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory;
        private readonly UserManager<ApplicationUser> _users;
        private readonly IWebHostEnvironment _env;

        public SeedDemoController(
            ApplicationDbContext db, ICurrentUserService currentUser,
            GeometryFactory geometryFactory, UserManager<ApplicationUser> users,
            IWebHostEnvironment env)
        {
            _db = db; _currentUser = currentUser; _geometryFactory = geometryFactory;
            _users = users; _env = env;
        }

        /// <summary>Nhãn nhận dạng dữ liệu demo. Xoá chỉ đụng đúng những gì có nhãn này,
        /// nên tin thật do người dùng tự đăng không bao giờ bị cuốn theo.</summary>
        private const string DemoTag = "[demo-gd1]";

        private static readonly (string Name, double Lat, double Lng, double Factor)[] Districts =
        {
            ("Quận 1",          10.7756, 106.7019, 1.85),
            ("Quận 3",          10.7841, 106.6879, 1.55),
            ("Quận 4",          10.7578, 106.7050, 1.20),
            ("Quận 7",          10.7340, 106.7215, 1.35),
            ("Quận 10",         10.7729, 106.6674, 1.30),
            ("Quận Bình Thạnh", 10.8106, 106.7091, 1.15),
            ("Quận Phú Nhuận",  10.7994, 106.6797, 1.25),
            ("Quận Gò Vấp",     10.8386, 106.6653, 0.95),
            ("Quận Tân Bình",   10.8014, 106.6528, 1.05),
            ("TP. Thủ Đức",     10.8506, 106.7719, 0.85),
        };

        private static readonly string[] Wards = { "Phường 1", "Phường 5", "Phường 12", "Phường 15", "Phường 25" };

        private static readonly string[] Streets =
        {
            "Nguyễn Văn Cừ", "Lê Văn Sỹ", "Cách Mạng Tháng 8", "Điện Biên Phủ", "Phan Xích Long",
            "Nguyễn Thị Minh Khai", "Trần Hưng Đạo", "Hoàng Văn Thụ", "Quang Trung", "Xô Viết Nghệ Tĩnh",
        };

        private static readonly string[] Images =
        {
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
            "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
            "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
            "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
        };

        private static readonly (string Email, string Name, string Phone)[] DemoOwners =
        {
            ("chuthue.demo@kgs.test",  "Trần Thị Bích Ngọc", "0903112233"),
            ("moigioi.demo@kgs.test",  "Nguyễn Văn Hùng",    "0912445566"),
            ("nguoithue.demo@kgs.test","Lê Minh Khoa",       "0987778899"),
        };

        /// <param name="count">Số tin đăng cần sinh. Mặc định 120.</param>
        /// <param name="seed">Đổi seed để có tập dữ liệu khác.</param>
        [HttpPost]
        public async Task<IActionResult> Generate(
            [FromQuery] int count = 120,
            [FromQuery] int seed = 20260904,
            CancellationToken ct = default)
        {
            // Chặn ở môi trường thật. Endpoint này ghi thẳng vào CSDL và tạo tài khoản —
            // không có lý do gì để nó tồn tại ngoài máy của lập trình viên.
            if (!_env.IsDevelopment()) return NotFound();

            count = Math.Clamp(count, 10, 500);
            var rnd = new Random(seed);
            var now = DateTime.UtcNow;
            var callerId = _currentUser.UserId;

            var ownerIds = await EnsureDemoOwnersAsync(callerId);

            var assets = new List<Asset>();
            var listings = new List<Listing>();

            for (var i = 0; i < count; i++)
            {
                var d = Districts[rnd.Next(Districts.Length)];

                // Người gọi giữ 40% số tin — bảng thống kê và "tin của tôi" của chính họ
                // phải có gì đó để xem ngay sau khi seed.
                var ownerId = rnd.NextDouble() < 0.4 ? callerId : ownerIds[rnd.Next(ownerIds.Count)];

                // 35% tin bán. Trang tìm kiếm mặc định lọc "Bán", nên một tập toàn tin thuê
                // sẽ mở ra là danh sách rỗng — đúng thứ khiến người thử tưởng hệ thống hỏng.
                var isSale = rnd.NextDouble() < 0.35;

                var lat = d.Lat + (rnd.NextDouble() - 0.5) * 0.03;
                var lng = d.Lng + (rnd.NextDouble() - 0.5) * 0.03;

                var assetType = isSale
                    ? (rnd.NextDouble() < 0.5 ? AssetDomainType.PrivateHouse : AssetDomainType.Apartment)
                    : AssetDomainType.PrivateHouse;

                var area = isSale ? rnd.Next(45, 160) : rnd.Next(18, 45);
                var bedrooms = isSale ? rnd.Next(2, 5) : 1;

                var street = Streets[rnd.Next(Streets.Length)];
                var houseNo = rnd.Next(1, 300);

                var asset = new Asset
                {
                    UserId = ownerId,
                    Name = $"{(isSale ? "Nhà" : "Phòng trọ")} {street} {houseNo}",
                    TypeProperty = assetType,
                    OwnershipType = AssetOwnershipType.Owned,
                    Status = isSale ? AssetStatus.ForSale : AssetStatus.Vacant,
                    Address = new Address
                    {
                        City = "TP. Hồ Chí Minh",
                        District = d.Name,
                        Ward = Wards[rnd.Next(Wards.Length)],
                        Detail = $"{houseNo} {street}",
                    },
                    Location = _geometryFactory.CreatePoint(new Coordinate(lng, lat)),
                    Area = area,
                    Bedrooms = bedrooms,
                    Bathrooms = isSale ? rnd.Next(1, 4) : 1,
                    Floors = isSale ? rnd.Next(1, 5) : 1,
                    Frontage = isSale ? rnd.Next(3, 9) : null,
                    HouseDirection = isSale ? new[] { "Đông", "Tây", "Nam", "Bắc", "Đông Nam" }[rnd.Next(5)] : null,
                    LegalStatus = isSale ? "Sổ hồng riêng" : null,
                    FurnitureState = rnd.NextDouble() < 0.6 ? "Đầy đủ nội thất" : "Cơ bản",
                    Notes = DemoTag,
                };

                var price = isSale
                    ? (decimal)Math.Round(area * d.Factor * rnd.Next(85, 135) / 10.0) * 10_000_000m / 10m
                    : (decimal)(rnd.Next(28, 75) * 100_000 * d.Factor / 100) * 100;

                // Làm tròn cho giống giá người thật đăng: không ai ghi "4.837.291 đ/tháng".
                price = isSale
                    ? Math.Round(price / 100_000_000m) * 100_000_000m
                    : Math.Round(price / 100_000m) * 100_000m;
                if (price <= 0) price = isSale ? 3_000_000_000m : 3_000_000m;

                var status = PickStatus(rnd);
                var published = status is ListingStatus.Approved or ListingStatus.Closed
                    ? now.AddDays(-rnd.Next(1, 75))
                    : (DateTime?)null;

                var amenities = BuildAmenities(rnd, isSale);

                var listing = new Listing
                {
                    Asset = asset,
                    Title = BuildTitle(rnd, isSale, area, bedrooms, d.Name, street),
                    Description = BuildDescription(rnd, isSale, area, bedrooms, d.Name, street),
                    Price = price,
                    Type = isSale ? ListingType.Sale : ListingType.Rent,
                    RentPaymentCycle = isSale ? null : PaymentCycle.Monthly,
                    Status = status,
                    // Bản nháp chưa có slug — đúng như luồng thật, slug chỉ sinh khi gửi duyệt.
                    Slug = status == ListingStatus.Draft
                        ? null
                        : $"{(isSale ? "ban" : "thue")}-{Slugify(d.Name)}-{i + 1}-{Guid.NewGuid().ToString("N")[..6]}",
                    ViewCount = 0,   // sẽ cộng lên đúng bằng số dòng ListingViews sinh bên dưới
                    PublishedAt = published,
                    BumpedAt = rnd.NextDouble() < 0.15 ? now.AddDays(-rnd.Next(0, 10)) : null,
                    ModerationNote = status == ListingStatus.Rejected
                        ? "Ảnh không rõ hoặc không phải ảnh thật của bất động sản. Vui lòng chụp lại và gửi duyệt lần nữa."
                        : null,
                    Amenities = amenities,
                    Terms = isSale ? new ListingTerms() : BuildTerms(rnd, amenities, now),
                    Images = BuildImages(rnd, status),
                };

                assets.Add(asset);
                listings.Add(listing);
            }

            _db.Assets.AddRange(assets);
            _db.Set<Listing>().AddRange(listings);
            await _db.SaveChangesAsync(ct);

            var engagement = await GenerateEngagementAsync(listings, ownerIds, callerId, rnd, now, ct);

            return Ok(new
            {
                message = "Đã dựng dữ liệu demo cho Giai đoạn 1.",
                listings = listings.Count,
                byStatus = listings.GroupBy(l => l.Status)
                                   .ToDictionary(g => g.Key.ToString(), g => g.Count()),
                byType = listings.GroupBy(l => l.Type)
                                 .ToDictionary(g => g.Key.ToString(), g => g.Count()),
                owners = ownerIds.Count,
                engagement.views,
                engagement.saved,
                engagement.inquiries,
                engagement.reports,
            });
        }

        /// <summary>Xoá sạch dữ liệu demo. Nhận ra bằng nhãn trên Asset.Notes nên tin thật
        /// không bị đụng tới. Tài khoản demo giữ lại — xoá chúng sẽ kéo theo cả những thứ
        /// người thử đã tự tạo trong lúc chạy thử.</summary>
        [HttpPost("clear")]
        public async Task<IActionResult> Clear(CancellationToken ct)
        {
            if (!_env.IsDevelopment()) return NotFound();

            var demo = await _db.Assets.Where(a => a.Notes == DemoTag).ToListAsync(ct);
            _db.Assets.RemoveRange(demo);   // Listings, Images, Views, Reports cascade theo
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã xoá dữ liệu demo.", removed = demo.Count });
        }

        // ==================== Nội bộ ====================

        /// <summary>Tạo (hoặc tìm lại) các tài khoản demo. Cần NHIỀU chủ tin vì báo vi phạm
        /// cấm tự báo tin của mình — chỉ một chủ thì không thử được chức năng đó.</summary>
        private async Task<List<string>> EnsureDemoOwnersAsync(string callerId)
        {
            var ids = new List<string>();

            foreach (var (email, name, phone) in DemoOwners)
            {
                var user = await _users.FindByEmailAsync(email);
                if (user is null)
                {
                    user = new ApplicationUser
                    {
                        UserName = email,
                        Email = email,
                        EmailConfirmed = true,
                        Name = name,
                        PhoneNumber = phone,
                        // Rải ngày tham gia để hồ sơ người đăng hiện ra khác nhau —
                        // "tham gia 2 năm" cạnh "mới tham gia" là thứ cần nhìn thấy khi thử.
                        CreatedAt = DateTime.UtcNow.AddMonths(-Random.Shared.Next(1, 30)),
                    };
                    await _users.CreateAsync(user, "Demo@12345");
                }
                ids.Add(user.Id);
            }

            ids.Add(callerId);
            return ids;
        }

        /// <summary>Phân bố trạng thái. Đa số đã duyệt (nếu không thì marketplace trống),
        /// nhưng phải có đủ mỗi loại còn lại để màn hình tương ứng có gì đó mà hiện.</summary>
        private static ListingStatus PickStatus(Random rnd)
        {
            var v = rnd.NextDouble();
            if (v < 0.70) return ListingStatus.Approved;
            if (v < 0.85) return ListingStatus.Pending;    // hàng đợi kiểm duyệt
            if (v < 0.91) return ListingStatus.Draft;      // soạn dở
            if (v < 0.96) return ListingStatus.Closed;     // đã cho thuê / mở lại được
            return ListingStatus.Rejected;                 // bị từ chối, gửi duyệt lại được
        }

        private static List<ListingImage> BuildImages(Random rnd, ListingStatus status)
        {
            // Cố ý để một phần tin không có ảnh: gợi ý "tin chưa có ảnh nào" ở bảng thống kê
            // sẽ không bao giờ xuất hiện nếu mọi tin đều đủ ảnh.
            var n = status == ListingStatus.Draft
                ? rnd.Next(0, 3)
                : (rnd.NextDouble() < 0.12 ? 0 : rnd.Next(2, 6));

            return Enumerable.Range(0, n).Select(i => new ListingImage
            {
                File = new StoredFile
                {
                    Url = Images[(i + rnd.Next(Images.Length)) % Images.Length],
                    PublicId = $"demo/{Guid.NewGuid():N}",
                    FileName = $"anh-{i + 1}.jpg",
                    ContentType = "image/jpeg",
                    SizeBytes = rnd.Next(120_000, 900_000),
                },
                SortOrder = i,
            }).ToList();
        }

        private static ListingTerms BuildTerms(Random rnd, List<string> amenities, DateTime now)
            => new()
            {
                DepositMonths = rnd.NextDouble() < 0.8 ? 1 : 2,
                // Một phần bỏ trống có chủ đích — đó là trạng thái rất phổ biến ngoài đời,
                // và cũng là thứ làm chỉ số "độ đầy đủ" có ý nghĩa.
                ElectricityPrice = rnd.NextDouble() < 0.8 ? rnd.Next(33, 46) * 100m : null,
                WaterPrice = rnd.NextDouble() < 0.75 ? (rnd.NextDouble() < 0.6 ? 100_000m : 25_000m) : null,
                WaterPricing = rnd.NextDouble() < 0.6 ? WaterPricingMode.PerPerson : WaterPricingMode.PerCubicMeter,
                ServiceFee = rnd.NextDouble() < 0.65 ? rnd.Next(1, 4) * 50_000m : null,
                ParkingFee = amenities.Contains(AmenityKeys.Parking) ? rnd.Next(0, 3) * 50_000m : null,
                InternetFee = amenities.Contains(AmenityKeys.Wifi) ? 0m : (rnd.NextDouble() < 0.5 ? 100_000m : null),
                MinLeaseMonths = rnd.NextDouble() < 0.7 ? (rnd.NextDouble() < 0.6 ? 6 : 3) : null,
                AvailableFrom = rnd.NextDouble() < 0.7 ? now.AddDays(rnd.Next(0, 40)) : null,
                MaxOccupants = rnd.NextDouble() < 0.6 ? rnd.Next(2, 5) : null,
                PetsAllowed = TriState(rnd, 0.35, 0.25),
                CurfewFree = TriState(rnd, 0.6, 0.2),
                SharedWithOwner = TriState(rnd, 0.3, 0.25),
                CookingAllowed = TriState(rnd, 0.8, 0.2),
            };

        private static bool? TriState(Random rnd, double trueRate, double unknownRate)
        {
            var v = rnd.NextDouble();
            if (v < unknownRate) return null;
            return v < unknownRate + trueRate;
        }

        private static List<string> BuildAmenities(Random rnd, bool isSale)
        {
            var pool = AmenityKeys.All.ToArray();
            var take = isSale ? rnd.Next(0, 4) : rnd.Next(1, 7);
            return pool.OrderBy(_ => rnd.Next()).Take(take).Distinct().Order().ToList();
        }

        private static string BuildTitle(Random rnd, bool isSale, int area, int bedrooms, string district, string street)
        {
            if (isSale)
                return $"Bán nhà {street}, {district} — {area}m², {bedrooms} phòng ngủ";

            var flavour = new[] { "thoáng mát", "mới xây", "full nội thất", "giờ giấc tự do", "gần chợ" };
            return $"Cho thuê phòng trọ {district} {area}m² — {flavour[rnd.Next(flavour.Length)]}";
        }

        private static string BuildDescription(Random rnd, bool isSale, int area, int bedrooms, string district, string street)
        {
            if (isSale)
                return $"Nhà mặt tiền hẻm xe hơi đường {street}, {district}. Diện tích {area}m², "
                     + $"{bedrooms} phòng ngủ, kết cấu chắc chắn, sổ hồng riêng hoàn công đầy đủ.\n\n"
                     + "Khu dân cư hiện hữu, an ninh, gần trường học và chợ. Tiện di chuyển vào trung tâm.";

            var vibes = new[]
            {
                $"Phòng trọ {area}m² tại {district}, cửa sổ thoáng, yên tĩnh phù hợp làm việc tại nhà. Khu vực an ninh, có bảo vệ.",
                $"Phòng {area}m² gần chợ và tuyến xe buýt, đi lại thuận tiện. Chủ nhà ở riêng, giờ giấc tự do.",
                $"Phòng {area}m² giá tốt cho sinh viên và người mới đi làm. Có chỗ để xe máy, khu vực sạch sẽ.",
            };
            return vibes[rnd.Next(vibes.Length)]
                 + $"\n\nĐịa chỉ tham khảo: đường {street}, {district}. Liên hệ xem phòng trong giờ hành chính.";
        }

        /// <summary>Sinh lượt xem, lượt lưu, yêu cầu xem nhà và báo vi phạm.
        ///
        /// Nếu bỏ phần này thì mọi biểu đồ ở bảng thống kê sẽ là một đường thẳng bằng 0, và
        /// hàng đợi báo vi phạm sẽ rỗng — tức là hai màn hình vừa xây xong không thử được.</summary>
        private async Task<(int views, int saved, int inquiries, int reports)> GenerateEngagementAsync(
            List<Listing> listings, List<string> ownerIds, string callerId,
            Random rnd, DateTime now, CancellationToken ct)
        {
            var live = listings.Where(l => l.Status == ListingStatus.Approved).ToList();
            if (live.Count == 0) return (0, 0, 0, 0);

            var today = DateOnly.FromDateTime(now);
            var views = new List<ListingView>();
            var saved = new List<SavedListing>();
            var inquiries = new List<ListingInquiry>();
            var reports = new List<ListingReport>();

            var savedKeys = new HashSet<(string, Guid)>();
            var reportKeys = new HashSet<(string, Guid)>();

            foreach (var l in live)
            {
                // Rải lượt xem trong 30 ngày, nhiều dần về hiện tại — tin mới đăng bao giờ
                // cũng được xem nhiều hơn, và một đường phẳng lì trông không giống thật.
                var total = rnd.Next(0, 60);
                for (var v = 0; v < total; v++)
                {
                    var daysAgo = (int)Math.Floor(Math.Pow(rnd.NextDouble(), 1.7) * 30);
                    var day = today.AddDays(-daysAgo);

                    views.Add(new ListingView
                    {
                        ListingId = l.Id,
                        // Dấu vân phải DUY NHẤT theo (tin, dấu vân, ngày) — chỉ số duy nhất
                        // sẽ chặn nếu trùng, nên gắn thêm chỉ số v cho chắc chắn không đụng.
                        ViewerHash = $"{Guid.NewGuid():N}"[..24] + $"{v % 100:D2}" + "de",
                        ViewedAt = now.AddDays(-daysAgo).AddHours(-rnd.Next(0, 12)),
                        ViewedOn = day,
                    });
                }
                l.ViewCount = total;

                // Lưu tin: người gọi lưu một phần, để trang "tin đã lưu" của họ có nội dung.
                if (rnd.NextDouble() < 0.25 && savedKeys.Add((callerId, l.Id)))
                    saved.Add(new SavedListing { UserId = callerId, ListingId = l.Id, SavedAt = now.AddDays(-rnd.Next(0, 20)) });

                var otherOwner = ownerIds[rnd.Next(ownerIds.Count)];
                if (otherOwner != callerId && rnd.NextDouble() < 0.2 && savedKeys.Add((otherOwner, l.Id)))
                    saved.Add(new SavedListing { UserId = otherOwner, ListingId = l.Id, SavedAt = now.AddDays(-rnd.Next(0, 20)) });

                // Yêu cầu xem nhà — người gửi phải KHÁC chủ tin.
                if (rnd.NextDouble() < 0.18)
                {
                    var from = ownerIds.FirstOrDefault(id => id != l.Asset.UserId);
                    if (from is not null)
                        inquiries.Add(new ListingInquiry
                        {
                            ListingId = l.Id,
                            FromUserId = from,
                            ToUserId = l.Asset.UserId,
                            Message = "Chào anh/chị, phòng còn trống không ạ? Em muốn xem vào cuối tuần này.",
                            PreferredViewingAt = now.AddDays(rnd.Next(1, 7)),
                            Status = InquiryStatus.New,
                            CreatedAt = now.AddDays(-rnd.Next(0, 15)),
                        });
                }

                // Báo vi phạm — người báo cũng phải khác chủ tin.
                if (rnd.NextDouble() < 0.07)
                {
                    var reporter = ownerIds.FirstOrDefault(id => id != l.Asset.UserId);
                    if (reporter is not null && reportKeys.Add((reporter, l.Id)))
                        reports.Add(new ListingReport
                        {
                            ListingId = l.Id,
                            ReporterUserId = reporter,
                            Reason = (ListingReportReason)rnd.Next(1, 7),
                            Detail = "Gọi hỏi thì chủ nhà nói phòng đã cho thuê từ tháng trước.",
                            Status = ListingReportStatus.Pending,
                            CreatedAt = now.AddDays(-rnd.Next(0, 12)),
                        });
                }
            }

            _db.Set<ListingView>().AddRange(views);
            _db.Set<SavedListing>().AddRange(saved);
            _db.Set<ListingInquiry>().AddRange(inquiries);
            _db.Set<ListingReport>().AddRange(reports);
            await _db.SaveChangesAsync(ct);

            return (views.Count, saved.Count, inquiries.Count, reports.Count);
        }

        /// <summary>Khử dấu bằng chuẩn hoá Unicode, KHÔNG bằng hai chuỗi tra song song.
        ///
        /// Bản đầu ở đây dùng một cặp chuỗi "à á ạ..." / "a a a..." căn tay. Chuỗi đích bị
        /// thừa hai ký tự nên mọi thứ sau vị trí đó lệch một nấc, và "Thủ Đức" ra
        /// "thu-yuc". Cặp chuỗi căn tay luôn mời gọi đúng lỗi đó, còn FormD thì không có gì
        /// để căn lệch. Đây cũng là cách ListingService.ToSlug dùng cho slug thật.</summary>
        private static string Slugify(string s)
        {
            var stripped = new string(
                s.Normalize(System.Text.NormalizationForm.FormD)
                 .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)
                          != System.Globalization.UnicodeCategory.NonSpacingMark)
                 .ToArray());

            // đ/Đ không phải nguyên âm có dấu tổ hợp nên FormD không tách được — phải thay tay.
            var lower = stripped.Normalize(System.Text.NormalizationForm.FormC)
                                .ToLowerInvariant()
                                .Replace('đ', 'd');

            var slug = System.Text.RegularExpressions.Regex.Replace(lower, @"[^a-z0-9]+", "-");
            return slug.Trim('-');
        }
    }
}
