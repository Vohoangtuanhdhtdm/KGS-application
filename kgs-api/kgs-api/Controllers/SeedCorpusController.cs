using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.ValueObjects;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using static kgs_api.Common.Common;
using static kgs_api.Domain.Enums;

namespace kgs_api.Controllers
{
    /// <summary>Sinh corpus tin đăng mô phỏng để đánh giá tìm kiếm.
    ///
    /// Vì sao dữ liệu mô phỏng là hợp lệ ở đây: đánh giá TRUY HỒI cần một tập tài liệu có
    /// NHÃN — biết trước tin nào đúng là phù hợp với truy vấn nào. Tự sinh corpus mà mình
    /// kiểm soát nhãn là cách làm chuẩn trong đo lường IR.
    ///
    /// KHÁC với Module định giá (AVM): mô hình định giá huấn luyện trên giá tự bịa thì vô
    /// nghĩa, nên phần đó vẫn phải chờ dữ liệu thật từ crawler.
    ///
    /// Corpus dựng theo đúng hình dạng nghiệp vụ của đề tài: mỗi tài sản là một khu trọ
    /// nhiều phòng, mỗi phòng một tin đăng riêng.</summary>
    [ApiController]
    [Authorize]
    [Route("api/dev/corpus")]
    public sealed class SeedCorpusController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICurrentUserService _currentUser;
        private readonly GeometryFactory _geometryFactory;
        private readonly IWebHostEnvironment _env;

        public SeedCorpusController(
            ApplicationDbContext db, ICurrentUserService currentUser,
            GeometryFactory geometryFactory, IWebHostEnvironment env)
        {
            _db = db; _currentUser = currentUser; _geometryFactory = geometryFactory; _env = env;
        }

        // Quận nội thành TP.HCM kèm toạ độ trung tâm và hệ số giá so với mặt bằng chung.
        private static readonly (string Name, double Lat, double Lng, double PriceFactor)[] Districts =
        {
            ("Quận 1",          10.7756, 106.7019, 1.85),
            ("Quận 3",          10.7841, 106.6879, 1.55),
            ("Quận 4",          10.7578, 106.7050, 1.20),
            ("Quận 5",          10.7540, 106.6634, 1.25),
            ("Quận 7",          10.7340, 106.7215, 1.35),
            ("Quận 10",         10.7729, 106.6674, 1.30),
            ("Quận Bình Thạnh", 10.8106, 106.7091, 1.15),
            ("Quận Phú Nhuận",  10.7994, 106.6797, 1.25),
            ("Quận Gò Vấp",     10.8386, 106.6653, 0.95),
            ("Quận Tân Bình",   10.8014, 106.6528, 1.05),
            ("TP. Thủ Đức",     10.8506, 106.7719, 0.85),
            ("Quận Bình Tân",   10.7654, 106.6027, 0.80),
        };

        // Ba "tính cách" khu trọ. Mô tả được viết theo giọng khác nhau CÓ CHỦ ĐÍCH: bộ đánh
        // giá cần những câu hỏi kiểu "yên tĩnh để làm việc" phân biệt được với "gần chợ,
        // tiện đi lại", mà hai thứ đó không chia sẻ từ khoá nào.
        private static readonly (string Key, string[] Titles, string[] Descriptions)[] Vibes =
        {
            ("quiet", new[]
                {
                    "Phòng trọ hẻm cụt yên tĩnh", "Phòng yên tĩnh cho người đi làm",
                    "Phòng trọ tách biệt, ít ồn", "Phòng sạch sẽ trong hẻm yên tĩnh"
                },
                new[]
                {
                    "Phòng nằm sâu trong hẻm cụt, gần như không có xe cộ qua lại nên rất yên tĩnh. Có sẵn bàn làm việc cạnh cửa sổ, ánh sáng tự nhiên tốt, thích hợp cho người làm việc tại nhà hoặc sinh viên cần tập trung học.",
                    "Khu trọ ít người, chủ yếu là người đi làm văn phòng nên giờ giấc rất trật tự, buổi tối gần như im lặng hoàn toàn. Không gian thoáng, cửa sổ hướng ra sân sau.",
                    "Hẻm nhỏ ít xe, ban đêm không ồn ào. Phòng có góc kê bàn máy tính, đường truyền internet ổn định, phù hợp làm việc từ xa.",
                    "Không gian riêng tư, tách biệt khỏi mặt đường lớn. Buổi sáng yên ắng, rất dễ tập trung. Khu dân cư trí thức, hàng xóm lịch sự."
                }),
            ("convenient", new[]
                {
                    "Phòng trọ gần chợ, tiện đi lại", "Phòng mặt tiền hẻm xe hơi",
                    "Phòng trọ trung tâm, gần siêu thị", "Phòng gần trạm xe buýt"
                },
                new[]
                {
                    "Vị trí cực kỳ tiện lợi, bước ra đầu hẻm là chợ, siêu thị mini và hàng quán ăn uống. Gần trạm xe buýt, di chuyển vào trung tâm nhanh chóng.",
                    "Ngay mặt tiền hẻm xe hơi, xe máy ra vào thoải mái. Xung quanh đầy đủ tiện ích: chợ, nhà thuốc, phòng khám, quán ăn mở tới khuya.",
                    "Cách siêu thị 300m, gần trường học và bệnh viện. Đường lớn ngay trước hẻm nên gọi xe công nghệ rất dễ, không bị kén tài xế.",
                    "Khu vực sầm uất, buôn bán nhộn nhịp, thuận tiện cho người kinh doanh online hoặc làm ca. Đi vào trung tâm chỉ mất khoảng 15 phút xe máy."
                }),
            ("budget", new[]
                {
                    "Phòng trọ giá rẻ cho sinh viên", "Phòng trọ bình dân sạch sẽ",
                    "Phòng giá tốt gần trường đại học", "Phòng trọ tiết kiệm cho người mới đi làm"
                },
                new[]
                {
                    "Phòng giá mềm, phù hợp sinh viên và người mới đi làm. Có gác lửng để đồ, khu vực nấu ăn chung sạch sẽ. Gần trường đại học, đi bộ được.",
                    "Giá thuê thấp so với mặt bằng khu vực, điện nước tính theo giá nhà nước. Chủ dễ tính, không làm khó chuyện giờ giấc.",
                    "Phòng cơ bản nhưng sạch, đầy đủ điện nước, wifi miễn phí. Xung quanh nhiều quán cơm bình dân, chi phí sinh hoạt thấp.",
                    "Thích hợp cho hai bạn ở ghép để chia tiền. Khu trọ đông sinh viên, không khí trẻ trung, an ninh có camera."
                }),
        };

        private static readonly string[] Images =
        {
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
            "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
            "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
            "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
        };

        /// <summary>Sinh corpus. Dùng seed cố định nên chạy lại cho ra CÙNG một tập dữ liệu —
        /// điều kiện bắt buộc để bộ 40 truy vấn đánh giá còn nguyên giá trị so sánh.</summary>
        [HttpPost]
        public async Task<IActionResult> Generate(
            [FromQuery] int houses = 40,
            [FromQuery] int seed = 20260903,
            CancellationToken ct = default)
        {
            if (!_env.IsDevelopment()) return NotFound();

            houses = Math.Clamp(houses, 1, 200);
            var userId = _currentUser.UserId;
            var rnd = new Random(seed);
            var now = DateTime.UtcNow;

            var assets = new List<Asset>();
            var listings = new List<Listing>();

            for (var h = 0; h < houses; h++)
            {
                var d = Districts[rnd.Next(Districts.Length)];
                var vibe = Vibes[rnd.Next(Vibes.Length)];

                // Toạ độ rải quanh tâm quận trong bán kính ~2km.
                var lat = d.Lat + (rnd.NextDouble() - 0.5) * 0.036;
                var lng = d.Lng + (rnd.NextDouble() - 0.5) * 0.036;

                var asset = new Asset
                {
                    UserId = userId,
                    Name = $"Khu trọ {d.Name} — cơ sở {h + 1}",
                    TypeProperty = AssetDomainType.PrivateHouse,
                    // Phần lớn là đi thuê rồi chia phòng cho thuê lại — đúng định vị sản phẩm.
                    OwnershipType = rnd.NextDouble() < 0.7 ? AssetOwnershipType.Leasehold : AssetOwnershipType.Owned,
                    Status = AssetStatus.RentedOut,
                    Address = new Address
                    {
                        City = "TP. Hồ Chí Minh",
                        District = d.Name,
                        Ward = $"Phường {rnd.Next(1, 16)}",
                        Detail = $"{rnd.Next(10, 400)}/{rnd.Next(1, 40)} đường số {rnd.Next(1, 60)}"
                    },
                    Location = _geometryFactory.CreatePoint(new Coordinate(lng, lat)),
                    Area = rnd.Next(120, 400),
                    Floors = rnd.Next(2, 6),
                    Bedrooms = 1,
                    Bathrooms = 1,
                    LegalStatus = "Hợp đồng thuê dài hạn",
                    FurnitureState = "Cơ bản",
                    Notes = "Dữ liệu mô phỏng phục vụ đánh giá tìm kiếm."
                };
                assets.Add(asset);

                var roomCount = rnd.Next(4, 9);
                for (var r = 0; r < roomCount; r++)
                {
                    var floor = r / 3 + 1;
                    var area = rnd.Next(16, 34);

                    var unit = new AssetUnit
                    {
                        Asset = asset,
                        Name = $"Phòng {floor}{(r % 3) + 1:00}",
                        FloorNumber = floor,
                        Area = area,
                        Status = UnitStatus.Vacant
                    };
                    asset.Units.Add(unit);

                    // Giá bám theo hệ số quận và diện tích, cộng nhiễu — để bộ lọc theo
                    // ngân sách phân biệt được thật sự chứ không phải ngẫu nhiên đều.
                    var basePrice = 2_600_000m + (decimal)area * 95_000m;
                    var price = Math.Round(
                        basePrice * (decimal)d.PriceFactor * (decimal)(0.88 + rnd.NextDouble() * 0.26) / 100_000m)
                        * 100_000m;

                    var isBudget = vibe.Key == "budget";
                    var amenities = BuildAmenities(rnd, price, isBudget);

                    listings.Add(new Listing
                    {
                        Asset = asset,
                        AssetUnit = unit,
                        Title = $"{vibe.Titles[rnd.Next(vibe.Titles.Length)]} — {d.Name} {area}m²",
                        Description = vibe.Descriptions[rnd.Next(vibe.Descriptions.Length)],
                        Price = price,
                        Type = ListingType.Rent,
                        RentPaymentCycle = PaymentCycle.Monthly,
                        Status = ListingStatus.Approved,
                        Slug = $"phong-tro-{Slugify(d.Name)}-{h + 1}-{r + 1}-{Guid.NewGuid().ToString("N")[..6]}",
                        ViewCount = rnd.Next(0, 220),
                        PublishedAt = now.AddDays(-rnd.Next(1, 90)),
                        Amenities = amenities,
                        Terms = new ListingTerms
                        {
                            DepositMonths = rnd.NextDouble() < 0.75 ? 1 : 2,
                            ElectricityPrice = isBudget ? 3_500m : rnd.Next(35, 46) * 100m,
                            WaterPrice = rnd.NextDouble() < 0.6 ? 100_000m : 25_000m,
                            WaterPricing = rnd.NextDouble() < 0.6
                                ? WaterPricingMode.PerPerson
                                : WaterPricingMode.PerCubicMeter,
                            ServiceFee = rnd.NextDouble() < 0.7 ? rnd.Next(1, 4) * 50_000m : null,
                            ParkingFee = amenities.Contains(AmenityKeys.Parking) ? rnd.Next(0, 3) * 50_000m : null,
                            InternetFee = amenities.Contains(AmenityKeys.Wifi) ? 0m : rnd.Next(1, 3) * 50_000m,
                            MinLeaseMonths = rnd.NextDouble() < 0.6 ? 6 : 3,
                            AvailableFrom = now.AddDays(rnd.Next(0, 45)),
                            MaxOccupants = area > 26 ? 3 : 2,
                            // Ba trạng thái, KHÔNG chỉ có/không: một phần tin để trống đúng
                            // như thực tế, và bộ lọc phải xử lý đúng chuyện đó.
                            PetsAllowed = TriState(rnd, 0.28, 0.20),
                            CurfewFree = TriState(rnd, 0.62, 0.12),
                            SharedWithOwner = TriState(rnd, 0.30, 0.18),
                            CookingAllowed = TriState(rnd, 0.70, 0.15)
                        },
                        Images = new List<ListingImage>
                        {
                            new()
                            {
                                File = new StoredFile
                                {
                                    Url = Images[rnd.Next(Images.Length)],
                                    PublicId = $"corpus/{h}-{r}",
                                    FileName = "phong.jpg",
                                    ContentType = "image/jpeg",
                                    SizeBytes = 210_000
                                },
                                SortOrder = 0
                            }
                        }
                    });
                }
            }

            await _db.Assets.AddRangeAsync(assets, ct);
            await _db.Listings.AddRangeAsync(listings, ct);
            await _db.SaveChangesAsync(ct);

            return Ok(new
            {
                message = "Đã sinh corpus mô phỏng.",
                seed,
                created = new { assets = assets.Count, units = assets.Sum(a => a.Units.Count), listings = listings.Count },
                nextSteps = new[]
                {
                    "GET /api/listings/search?type=2 — marketplace nay đã có đủ tin để demo",
                    "GET /api/listings/search?totalCostMax=5000000&petsAllowed=true — thử bộ lọc điều kiện thuê",
                    "POST /api/dev/corpus/clear — xoá riêng corpus, không đụng dữ liệu thật"
                }
            });
        }

        /// <summary>Xoá riêng corpus mô phỏng. Nhận ra bằng Notes của Asset nên dữ liệu thật
        /// do người dùng tự tạo không bị đụng tới.</summary>
        [HttpPost("clear")]
        public async Task<IActionResult> Clear(CancellationToken ct)
        {
            if (!_env.IsDevelopment()) return NotFound();

            var userId = _currentUser.UserId;
            var corpus = await _db.Assets
                .Where(a => a.UserId == userId && a.Notes == "Dữ liệu mô phỏng phục vụ đánh giá tìm kiếm.")
                .ToListAsync(ct);

            _db.Assets.RemoveRange(corpus);   // Listings, Units, Images cascade theo
            await _db.SaveChangesAsync(ct);

            return Ok(new { message = "Đã xoá corpus mô phỏng.", removed = corpus.Count });
        }

        /// <summary>Trả về null với xác suất `unknownRate` — mô phỏng chuyện chủ tin bỏ trống,
        /// vốn là trạng thái rất phổ biến ngoài thực tế.</summary>
        private static bool? TriState(Random rnd, double trueRate, double unknownRate)
        {
            var v = rnd.NextDouble();
            if (v < unknownRate) return null;
            return v < unknownRate + trueRate;
        }

        private static List<string> BuildAmenities(Random rnd, decimal price, bool isBudget)
        {
            var list = new List<string>();

            void Maybe(string key, double p)
            {
                if (rnd.NextDouble() < p) list.Add(key);
            }

            // Tiện nghi tương quan với giá — phòng rẻ hiếm khi có thang máy. Không có tương
            // quan này thì bộ lọc kết hợp giá + tiện nghi sẽ ra kết quả ngẫu nhiên, và bộ
            // đánh giá mất ý nghĩa.
            var tier = isBudget ? 0.0 : price > 6_000_000m ? 1.0 : 0.5;

            Maybe(AmenityKeys.Wifi, 0.85);
            Maybe(AmenityKeys.Parking, 0.80);
            Maybe(AmenityKeys.PrivateBathroom, 0.55 + tier * 0.35);
            Maybe(AmenityKeys.AirConditioner, 0.30 + tier * 0.55);
            Maybe(AmenityKeys.WaterHeater, 0.35 + tier * 0.45);
            Maybe(AmenityKeys.Window, 0.60);
            Maybe(AmenityKeys.Loft, 0.35 - tier * 0.15);
            Maybe(AmenityKeys.Balcony, 0.15 + tier * 0.30);
            Maybe(AmenityKeys.PrivateKitchen, 0.25 + tier * 0.35);
            Maybe(AmenityKeys.Security, 0.30 + tier * 0.40);
            Maybe(AmenityKeys.Elevator, tier * 0.30);
            Maybe(AmenityKeys.Furnished, tier * 0.45);
            Maybe(AmenityKeys.WashingMachine, tier * 0.35);
            Maybe(AmenityKeys.Fridge, 0.10 + tier * 0.35);

            return list.Distinct().Order().ToList();
        }

        private static string Slugify(string s)
        {
            var t = s.Normalize(System.Text.NormalizationForm.FormD);
            var sb = new System.Text.StringBuilder();
            foreach (var c in t)
            {
                if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)
                    != System.Globalization.UnicodeCategory.NonSpacingMark)
                    sb.Append(c);
            }
            return System.Text.RegularExpressions.Regex.Replace(
                sb.ToString().Normalize(System.Text.NormalizationForm.FormC)
                  .ToLowerInvariant().Replace('đ', 'd'),
                @"[^a-z0-9]+", "-").Trim('-');
        }
    }
}
