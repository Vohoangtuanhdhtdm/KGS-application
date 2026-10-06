using System.Text.Json;
using kgs_api.Data;
using kgs_api.Domain.Entity;
using kgs_api.Domain.Entity.SubEntity;
using kgs_api.Domain.Rules;
using kgs_api.Domain.ValueObjects;
using kgs_api.Dtos;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using static kgs_api.Domain.Enums;
using static kgs_api.Services.Seeding.ShowcaseCatalog;

namespace kgs_api.Services.Seeding
{
    /// <summary>Bộ dữ liệu trình diễn: dựng một thị trường nhỏ nhưng ĐỦ MẶT cho mọi chức năng
    /// đang có — tìm kiếm mọi loại hình cả bán lẫn thuê, bộ lọc đặc điểm, trợ lý tìm nhà (mô tả
    /// có những mong muốn mềm để xếp hạng), toà nhà 3D, ghép đôi hai chiều (nhu cầu ẩn danh và
    /// lời mời), kiểm duyệt, thống kê tin.
    ///
    /// KHÁC hai bộ có sẵn: SeedCorpusController là corpus đo truy hồi (không được đụng),
    /// SeedDemoController sinh ngẫu nhiên theo số lượng. Bộ này cố định nội dung — cùng một lần
    /// gọi luôn ra cùng tiêu đề, giá, vị trí (chỉ ngày tháng tính lùi từ hôm nay) — để kịch bản
    /// demo trước hội đồng lần nào cũng đi đúng một đường.</summary>
    public sealed class ShowcaseSeeder
    {
        private const int RandomSeed = 20261003;
        private const double MPerDeg = 111_320;

        private readonly ApplicationDbContext _db;
        private readonly UserManager<ApplicationUser> _users;
        private readonly GeometryFactory _gf;

        public ShowcaseSeeder(ApplicationDbContext db, UserManager<ApplicationUser> users, GeometryFactory gf)
        {
            _db = db; _users = users; _gf = gf;
        }

        public sealed record Result(
            int Listings, int Buildings, int Units, Dictionary<string, int> ByType,
            Dictionary<string, int> ByStatus, Dictionary<string, int> ByCity,
            int Views, int Saved, int Inquiries, int Reports, int Demands, int Invitations,
            List<string> Accounts, List<string> SampleSlugs);

        // ==================== Dựng ====================

        public async Task<Result> SeedAsync(bool replaceLegacy, CancellationToken ct, bool purgeUntagged = false)
        {
            await ClearAsync(replaceLegacy, ct, purgeUntagged);

            var rnd = new Random(RandomSeed);
            var now = DateTime.UtcNow;
            var people = await EnsurePeopleAsync();
            var adminId = (await _users.GetUsersInRoleAsync("Admin")).OrderBy(u => u.CreatedAt).FirstOrDefault()?.Id;
            string OwnerId(Owner o) => people[o switch
            {
                Owner.Ngoc => "ngoc", Owner.Hung => "hung", Owner.Bao => "bao", Owner.Ha => "ha", _ => "kho",
            }];
            var places = Places.ToDictionary(p => p.Key);

            var listings = new List<Listing>();
            var assets = new List<Asset>();

            // ---- Tin đăng nguyên căn (mỗi tin một tài sản) ----
            var idx = 0;
            foreach (var spec in Specs)
            {
                for (var i = 0; i < spec.Count; i++, idx++)
                {
                    var place = places[spec.Places[i % spec.Places.Length]];
                    var (asset, listing) = BuildListing(spec, place, i, idx, rnd, now);
                    asset.UserId = OwnerId(PickOwner(spec, place, i));
                    assets.Add(asset);
                    listings.Add(listing);
                }
            }

            // ---- Toà nhà có mô hình 3D: mỗi căn trống một tin ----
            var units = new List<AssetUnit>();
            foreach (var b in Buildings)
            {
                var (asset, bUnits, bListings) = BuildBuilding(b, places[b.Place], rnd, now);
                asset.UserId = OwnerId(b.Owner);
                assets.Add(asset);
                units.AddRange(bUnits);
                listings.AddRange(bListings);
            }

            _db.Assets.AddRange(assets);
            _db.Set<AssetUnit>().AddRange(units);
            _db.Set<Listing>().AddRange(listings);

            // Mốc thời gian và lịch sử kiểm duyệt như dữ liệu thật: tin được tạo, gửi duyệt rồi
            // mới được duyệt/trả về — trang tổng quan quản trị đo thời gian duyệt và tỉ lệ duyệt
            // vòng đầu từ chính những sự kiện này. Bộ sinh ngẫu nhiên RIÊNG để nội dung tin
            // (vốn sinh từ rnd) giữ nguyên qua mọi lần chạy.
            var tr = new Random(RandomSeed + 1);
            void Ev(Listing l, ModerationAction a, int round, DateTime at, string? note = null, List<ModerationReason>? reasons = null)
                => _db.Set<ListingModerationEvent>().Add(new ListingModerationEvent
                {
                    Listing = l, Action = a, Round = round, CreatedAt = at, Note = note, Reasons = reasons ?? new(),
                });
            foreach (var l in listings)
            {
                var wait = TimeSpan.FromHours(1 + tr.NextDouble() * (tr.NextDouble() < 0.8 ? 10 : 40));
                switch (l.Status)
                {
                    case ListingStatus.Approved or ListingStatus.Closed when l.PublishedAt is { } pub:
                        l.CreatedAt = pub - wait - TimeSpan.FromMinutes(tr.Next(5, 90));
                        // ~15% tin từng bị trả về một lần rồi mới được duyệt — tỉ lệ duyệt vòng đầu
                        // không phải 100% như một bộ dữ liệu "quá sạch".
                        if (l.AssetUnit == null && tr.NextDouble() < 0.15)
                        {
                            Ev(l, ModerationAction.Submitted, 1, l.CreatedAt);
                            Ev(l, ModerationAction.ChangesRequested, 2, l.CreatedAt + wait / 2,
                                "Bổ sung giá điện nước và ảnh thật của phòng.",
                                new() { tr.NextDouble() < 0.5 ? ModerationReason.MissingTerms : ModerationReason.MissingOrBadPhotos });
                            Ev(l, ModerationAction.Submitted, 3, pub - wait / 2);
                            Ev(l, ModerationAction.Approved, 4, pub);
                        }
                        else
                        {
                            Ev(l, ModerationAction.Submitted, 1, pub - wait);
                            Ev(l, ModerationAction.Approved, 2, pub);
                        }
                        break;
                    case ListingStatus.Pending:
                        l.CreatedAt = now.AddHours(-(2 + tr.Next(0, 40)));
                        Ev(l, ModerationAction.Submitted, 1, l.CreatedAt);
                        break;
                    case ListingStatus.ChangesRequested or ListingStatus.Rejected:
                        l.CreatedAt = now.AddDays(-4).AddHours(-tr.Next(0, 24));
                        Ev(l, ModerationAction.Submitted, 1, l.CreatedAt);
                        Ev(l, l.Status == ListingStatus.Rejected ? ModerationAction.Rejected : ModerationAction.ChangesRequested,
                            2, l.CreatedAt + wait, l.ModerationNote,
                            l.Status == ListingStatus.Rejected
                                ? new() { ModerationReason.MissingOrBadPhotos }
                                : new() { ModerationReason.MissingTerms, ModerationReason.ThinDescription });
                        break;
                    default: // bản nháp
                        l.CreatedAt = now.AddDays(-tr.Next(1, 10));
                        break;
                }
                l.Asset.CreatedAt = l.Asset.CreatedAt == default || l.CreatedAt < l.Asset.CreatedAt ? l.CreatedAt : l.Asset.CreatedAt;
            }
            await _db.SaveChangesAsync(ct);

            var live = listings.Where(l => l.Status == ListingStatus.Approved).ToList();
            var (views, saved, inquiries, reports) = await EngagementAsync(live, people, rnd, now, ct);
            var (demands, invitations) = await DemandsAsync(listings, people, now, ct);
            reports += await AdminCasesAsync(live, people, adminId, now, ct);
            await NotificationsAsync(listings, people, now, ct);

            return new Result(
                listings.Count, Buildings.Length, units.Count,
                listings.GroupBy(l => l.Asset.TypeProperty.ToString() + "/" + l.Type)
                        .OrderBy(g => g.Key).ToDictionary(g => g.Key, g => g.Count()),
                listings.GroupBy(l => l.Status.ToString()).ToDictionary(g => g.Key, g => g.Count()),
                listings.GroupBy(l => l.Asset.Address.City).ToDictionary(g => g.Key, g => g.Count()),
                views, saved, inquiries, reports, demands, invitations,
                People.Select(p => p.Email).ToList(),
                live.Where(l => l.AssetUnit != null).GroupBy(l => l.AssetId).Select(g => g.First().Slug!)
                    .Concat(live.Where(l => l.AssetUnit == null).Take(3).Select(l => l.Slug!)).ToList());
        }

        /// <summary>Xoá bộ trình diễn: tài sản có nhãn (tin, căn, lượt xem, lưu, yêu cầu, báo vi
        /// phạm, lời mời xoá dây chuyền theo) và các nhu cầu đã lưu của bộ này. Tài khoản giữ lại.
        /// <paramref name="replaceLegacy"/>: xoá luôn dữ liệu của bộ demo ngẫu nhiên cũ.</summary>
        public async Task<int> ClearAsync(bool replaceLegacy, CancellationToken ct, bool purgeUntagged = false)
        {
            var purged = 0;
            if (purgeUntagged)
            {
                // Dữ liệu tạo tay khi thử nghiệm (không thuộc bộ nào): xoá tài sản — tin, căn, ảnh,
                // lượt xem, yêu cầu… xoá dây chuyền theo. Tài khoản giữ nguyên. Ảnh thật trên
                // Cloudinary được xếp hàng xoá (FileCleanupJob) chứ không bỏ mồ côi trên mây.
                var known = new[] { Tag, "[demo-3d]", "[demo-gd1]" };
                var stray = await _db.Assets.Where(a => a.Notes == null || !known.Contains(a.Notes)).ToListAsync(ct);
                var ids = stray.Select(a => a.Id).ToList();
                var files = (await _db.ListingImages.Where(i => ids.Contains(i.Listing.AssetId))
                        .Select(i => new { i.File.PublicId, i.File.Url, i.File.ContentType }).ToListAsync(ct))
                    .Concat(await _db.AssetMedia.Where(m => ids.Contains(m.AssetId))
                        .Select(m => new { m.File.PublicId, m.File.Url, m.File.ContentType }).ToListAsync(ct));
                foreach (var f in files.Where(f => !string.IsNullOrEmpty(f.PublicId) && f.Url.Contains("res.cloudinary.com")))
                    _db.FileDeletionQueueItems.Add(new FileDeletionQueueItem
                    {
                        PublicId = f.PublicId,
                        ResourceType = f.ContentType?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) == true ? "image" : "raw",
                    });
                _db.Assets.RemoveRange(stray);
                purged = stray.Count;
            }

            // Toà nhà demo 3D cũ đứng đúng chỗ toà Xô Viết Nghệ Tĩnh của bộ này — luôn thay.
            var tags = replaceLegacy
                ? new[] { Tag, "[demo-3d]", "[demo-gd1]" }
                : new[] { Tag, "[demo-3d]" };
            var assets = await _db.Assets.Where(a => tags.Contains(a.Notes!)).ToListAsync(ct);
            _db.Assets.RemoveRange(assets);

            var emails = People.Select(p => p.Email.ToUpperInvariant()).ToList();
            var names = Demands.Select(d => d.Name).ToList();
            var searches = await _db.Set<SavedSearch>()
                .Where(s => names.Contains(s.Name) && emails.Contains(s.User.NormalizedEmail!))
                .ToListAsync(ct);
            _db.Set<SavedSearch>().RemoveRange(searches);

            // Thông báo của các tài khoản trong bộ — dựng lại cùng dữ liệu, không để chuông
            // đếm dồn qua mỗi lần chạy lại.
            var notes = await _db.Notifications.Where(n => emails.Contains(n.User.NormalizedEmail!)).ToListAsync(ct);
            _db.Notifications.RemoveRange(notes);

            await _db.SaveChangesAsync(ct);
            return assets.Count + purged;
        }

        // ==================== Tin nguyên căn ====================

        private (Asset, Listing) BuildListing(Spec s, Place p, int i, int idx, Random rnd, DateTime now)
        {
            var isSale = s.Mode == ListingType.Sale;
            var area = Math.Round(Lerp(s.Area.Min, s.Area.Max, rnd.NextDouble()) / (s.Area.Max > 500 ? 50 : 1)) * (s.Area.Max > 500 ? 50 : 1);
            var hl = Highlights[(idx * 7 + i) % Highlights.Length];

            int? bed = s.Type switch
            {
                AssetDomainType.Room => 1,
                AssetDomainType.Apartment => area < 60 ? 1 + rnd.Next(2) : area < 90 ? 2 : 3,
                AssetDomainType.PrivateHouse => Math.Clamp((int)(area / 22) + rnd.Next(2), 2, 6),
                AssetDomainType.Villa => 4 + rnd.Next(3),
                AssetDomainType.Shophouse => 2 + rnd.Next(2),
                _ => null,
            };
            int? bath = s.Type switch
            {
                AssetDomainType.Room => 1,
                AssetDomainType.Apartment => bed >= 2 ? 2 : 1,
                AssetDomainType.PrivateHouse or AssetDomainType.Villa or AssetDomainType.Shophouse => bed!.Value - rnd.Next(2),
                AssetDomainType.Office or AssetDomainType.CommercialSpace => 1,
                _ => null,
            };
            int? floors = s.Type switch
            {
                AssetDomainType.PrivateHouse => p.Factor > 1.3 ? 3 + rnd.Next(3) : 1 + rnd.Next(4),
                AssetDomainType.Villa => 2 + rnd.Next(2),
                AssetDomainType.Shophouse => 4 + rnd.Next(2),
                _ => null,
            };
            double? front = s.Type switch
            {
                AssetDomainType.PrivateHouse => Math.Round(Lerp(3.5, 6, rnd.NextDouble()), 1),
                AssetDomainType.Land => Math.Round(Lerp(4, 12, rnd.NextDouble())),
                AssetDomainType.Villa => Math.Round(Lerp(10, 20, rnd.NextDouble())),
                AssetDomainType.Shophouse => Math.Round(Lerp(5, 8, rnd.NextDouble())),
                AssetDomainType.CommercialSpace => Math.Round(Lerp(4, 10, rnd.NextDouble())),
                AssetDomainType.Warehouse => Math.Round(Lerp(15, 40, rnd.NextDouble())),
                _ => null,
            };
            var dir = isSale && s.Type is not (AssetDomainType.Warehouse or AssetDomainType.Office)
                ? PropertyVocabulary.Directions[rnd.Next(PropertyVocabulary.Directions.Length)]
                : null;
            var legal = isSale ? PickLegal(s.Type, p, rnd) : null;
            var furniture = PickFurniture(s, rnd);

            var price = Price(s, p, area, rnd);
            var amenities = PickAmenities(s, furniture, hl.Short, rnd);
            var status = StatusFor(idx);

            // "Gần {near}" mà địa điểm vốn bắt đầu bằng "gần ..." sẽ thành "Gần gần".
            var nearGan = p.Near.StartsWith("gần ") ? p.Near : "gần " + p.Near;
            string Fill(string t) => t
                .Replace("Gần {near}", char.ToUpper(nearGan[0]) + nearGan[1..])
                .Replace("gần {near}", nearGan)
                .Replace("{area}", area.ToString("0"))
                .Replace("{d}", ShortArea(p.District))
                .Replace("{street}", p.Street)
                .Replace("{near0}", p.Near.Split(',')[0])
                .Replace("{near}", p.Near)
                .Replace("{hlSentence}", hl.Sentence)
                .Replace("{hl}", hl.Short)
                .Replace("{bed}", bed?.ToString() ?? "")
                .Replace("{bath}", bath?.ToString() ?? "")
                .Replace("{floors}", floors?.ToString() ?? "")
                .Replace("{front}", front?.ToString("0.#") ?? "")
                .Replace("{dir}", dir ?? "")
                .Replace("{legalLower}", legal?.ToLowerInvariant() ?? "")
                .Replace("{legal}", legal ?? "")
                .Replace("{furnLower}", furniture?.ToLowerInvariant() ?? "cơ bản");

            var title = Fill(s.Titles[i % s.Titles.Length]);
            var asset = new Asset
            {
                Name = $"{TypeName(s.Type)} {p.Street} #{i + 1}",
                TypeProperty = s.Type,
                OwnershipType = AssetOwnershipType.Owned,
                Status = isSale ? AssetStatus.ForSale : status == ListingStatus.Closed ? AssetStatus.RentedOut : AssetStatus.Vacant,
                Address = new Address
                {
                    City = p.City,
                    District = p.District,
                    Ward = p.Ward,
                    Detail = $"{10 + (idx * 37) % 380} {p.Street}",
                },
                Location = Jitter(p, rnd),
                Area = area,
                Bedrooms = bed,
                Bathrooms = bath,
                Floors = floors,
                Frontage = front,
                HouseDirection = dir,
                LegalStatus = legal,
                FurnitureState = furniture,
                Notes = Tag,
            };

            var listing = new Listing
            {
                Asset = asset,
                Title = title.Length > 190 ? title[..190] : title,
                Description = Fill(s.Descriptions[i % s.Descriptions.Length]),
                Price = price,
                Type = s.Mode,
                RentPaymentCycle = isSale ? null : PaymentCycle.Monthly,
                Status = status,
                Slug = status == ListingStatus.Draft ? null : SlugFor(s, p, idx, rnd),
                PublishedAt = status is ListingStatus.Approved or ListingStatus.Closed ? now.AddDays(-(1 + (idx * 13) % 55)).AddHours(-rnd.Next(0, 20)) : null,
                BumpedAt = idx % 17 == 4 ? now.AddDays(-rnd.Next(0, 3)) : null,
                ModerationNote = status switch
                {
                    ListingStatus.Rejected => "Ảnh chưa đúng với bất động sản trong tin. Vui lòng chụp ảnh thật và gửi duyệt lại.",
                    ListingStatus.ChangesRequested => "Cần chỉnh sửa: thiếu điều kiện thuê (cọc, điện nước, nội quy); mô tả quá sơ sài. Sửa xong bạn gửi duyệt lại.",
                    _ => null,
                },
                Amenities = amenities,
                Terms = isSale ? new ListingTerms() : Terms(s.Type, amenities, hl.Short, rnd, now),
                Images = Images(s.Images, status, idx, rnd),
            };
            return (asset, listing);
        }

        private static ListingStatus StatusFor(int idx) => (idx % 20) switch
        {
            3 or 7 => ListingStatus.Pending,   // hàng đợi kiểm duyệt
            11 => ListingStatus.Draft,
            13 => ListingStatus.ChangesRequested,   // admin trả về — tab "Cần chỉnh sửa" của chủ tin
            15 => ListingStatus.Rejected,
            19 => ListingStatus.Closed,
            _ => ListingStatus.Approved,
        };

        private static Owner PickOwner(Spec s, Place p, int i)
        {
            var local = p.City switch
            {
                "Thành phố Hà Nội" => Owner.Bao,
                "Thành phố Hồ Chí Minh" => Owner.Ngoc,
                _ => Owner.Ha,
            };
            return s.Type switch
            {
                AssetDomainType.Office or AssetDomainType.CommercialSpace or AssetDomainType.Warehouse
                    => p.City is "Thành phố Hồ Chí Minh" or "Tỉnh Bình Dương" ? Owner.Kho : local,
                _ when s.Mode == ListingType.Sale => local == Owner.Ngoc || i % 2 == 0 ? Owner.Hung : local,
                AssetDomainType.Villa => Owner.Hung,
                _ => local,
            };
        }

        private static decimal Price(Spec s, Place p, double area, Random r)
        {
            var f = p.Factor;
            double u(double a, double b) => Lerp(a, b, r.NextDouble());
            var sale = s.Mode == ListingType.Sale;
            var (v, step) = s.Type switch
            {
                AssetDomainType.Room => (u(2.6e6, 4.4e6) * f, 1e5),
                AssetDomainType.Apartment when sale => (area * u(38e6, 55e6) * f, 5e7),
                AssetDomainType.Apartment => (u(6e6, 12e6) * f * Math.Pow(area / 70, 0.7), 5e5),
                AssetDomainType.PrivateHouse when sale => (area * u(70e6, 110e6) * f, 1e8),
                AssetDomainType.PrivateHouse => (u(12e6, 22e6) * f * Math.Pow(area / 70, 0.5), 5e5),
                AssetDomainType.Land => (area * u(28e6, 45e6) * f, 5e7),
                AssetDomainType.Villa when sale => (area * u(110e6, 150e6) * f, 5e8),
                AssetDomainType.Villa => (u(60e6, 110e6) * f, 5e6),
                AssetDomainType.Shophouse when sale => (area * u(170e6, 230e6) * f, 5e8),
                AssetDomainType.Shophouse => (u(45e6, 80e6) * f, 1e6),
                AssetDomainType.Office => (area * u(280e3, 420e3) * f, 5e5),
                AssetDomainType.CommercialSpace => (u(18e6, 45e6) * f * Math.Pow(area / 80, 0.5), 1e6),
                AssetDomainType.Warehouse when sale => (area * u(11e6, 16e6), 1e8),
                AssetDomainType.Warehouse => (area * u(70e3, 95e3), 1e6),
                _ => (u(5e6, 10e6), 1e5),
            };
            return (decimal)(Math.Max(1, Math.Round(v / step)) * step);
        }

        private static string? PickLegal(AssetDomainType t, Place p, Random r)
        {
            var x = r.NextDouble();
            var hanoi = p.City == "Thành phố Hà Nội";
            return t switch
            {
                AssetDomainType.Apartment => x < 0.6 ? "Sổ hồng riêng" : x < 0.85 ? "Hợp đồng mua bán" : "Đang chờ sổ",
                AssetDomainType.Land => x < 0.5 ? "Sổ đỏ" : x < 0.9 ? "Sổ hồng riêng" : "Đang chờ sổ",
                AssetDomainType.Warehouse => "Sổ hồng riêng",
                _ => hanoi ? (x < 0.7 ? "Sổ đỏ" : "Sổ hồng riêng")
                           : x < 0.7 ? "Sổ hồng riêng" : x < 0.85 ? "Sổ hồng chung" : "Sổ đỏ",
            };
        }

        private static string? PickFurniture(Spec s, Random r)
        {
            var x = r.NextDouble();
            return s.Type switch
            {
                AssetDomainType.Room => x < 0.3 ? "Đầy đủ" : x < 0.9 ? "Cơ bản" : "Không nội thất",
                AssetDomainType.Apartment when s.Mode == ListingType.Rent => x < 0.7 ? "Đầy đủ" : "Cơ bản",
                AssetDomainType.Apartment => x < 0.35 ? "Đầy đủ" : x < 0.8 ? "Cơ bản" : "Không nội thất",
                AssetDomainType.PrivateHouse or AssetDomainType.Villa => x < 0.4 ? "Đầy đủ" : x < 0.8 ? "Cơ bản" : "Không nội thất",
                AssetDomainType.Office => x < 0.5 ? "Cơ bản" : "Không nội thất",
                _ => null,
            };
        }

        private static List<string> PickAmenities(Spec s, string? furniture, string highlight, Random r)
        {
            string[] pool = s.Type switch
            {
                AssetDomainType.Room => new[] { AmenityKeys.AirConditioner, AmenityKeys.WaterHeater, AmenityKeys.PrivateBathroom, AmenityKeys.Loft, AmenityKeys.Window, AmenityKeys.Wifi, AmenityKeys.Parking, AmenityKeys.WashingMachine, AmenityKeys.Fridge, AmenityKeys.Security },
                AssetDomainType.Apartment => new[] { AmenityKeys.AirConditioner, AmenityKeys.WaterHeater, AmenityKeys.PrivateKitchen, AmenityKeys.Balcony, AmenityKeys.Elevator, AmenityKeys.Security, AmenityKeys.Parking, AmenityKeys.WashingMachine, AmenityKeys.Fridge, AmenityKeys.Wifi },
                AssetDomainType.PrivateHouse or AssetDomainType.Villa => new[] { AmenityKeys.Parking, AmenityKeys.Balcony, AmenityKeys.Window, AmenityKeys.Security, AmenityKeys.PrivateKitchen, AmenityKeys.AirConditioner },
                AssetDomainType.Office => new[] { AmenityKeys.Elevator, AmenityKeys.Parking, AmenityKeys.Security, AmenityKeys.AirConditioner, AmenityKeys.Wifi },
                AssetDomainType.Shophouse => new[] { AmenityKeys.Parking, AmenityKeys.Security, AmenityKeys.Balcony },
                AssetDomainType.CommercialSpace or AssetDomainType.Warehouse => new[] { AmenityKeys.Parking, AmenityKeys.Security },
                _ => Array.Empty<string>(),
            };
            var take = s.Type switch
            {
                AssetDomainType.Room or AssetDomainType.Apartment => 3 + r.Next(5),
                _ => r.Next(pool.Length + 1),
            };
            var list = pool.OrderBy(_ => r.Next()).Take(take).ToList();
            if (s.Type == AssetDomainType.Room && !list.Contains(AmenityKeys.PrivateBathroom) && r.NextDouble() < 0.8)
                list.Add(AmenityKeys.PrivateBathroom);
            if (highlight == "có ban công" && pool.Contains(AmenityKeys.Balcony) && !list.Contains(AmenityKeys.Balcony))
                list.Add(AmenityKeys.Balcony);
            // Tiện nghi "nội thất" phải khớp trạng thái nội thất, không thì hai nơi nói hai điều.
            if (furniture == "Đầy đủ" && s.Type is AssetDomainType.Room or AssetDomainType.Apartment)
                list.Add(AmenityKeys.Furnished);
            return list.Distinct().Order().ToList();
        }

        private static ListingTerms Terms(AssetDomainType t, List<string> amenities, string highlight, Random r, DateTime now)
        {
            if (t is AssetDomainType.Office or AssetDomainType.CommercialSpace or AssetDomainType.Warehouse or AssetDomainType.Shophouse)
                return new ListingTerms
                {
                    DepositMonths = 2 + r.Next(2),
                    MinLeaseMonths = new[] { 12, 24, 36 }[r.Next(3)],
                    ServiceFee = t == AssetDomainType.Office ? r.Next(2, 6) * 1_000_000m : null,
                    AvailableFrom = now.AddDays(r.Next(0, 45)),
                };

            var residential = t is AssetDomainType.Room or AssetDomainType.Apartment;
            return new ListingTerms
            {
                DepositMonths = residential ? 1 + (r.NextDouble() < 0.3 ? 1 : 0) : 2,
                ElectricityPrice = t == AssetDomainType.Room ? r.Next(35, 41) * 100m : null,
                WaterPrice = t == AssetDomainType.Room ? (r.NextDouble() < 0.6 ? 100_000m : 20_000m) : null,
                WaterPricing = t == AssetDomainType.Room ? (r.NextDouble() < 0.6 ? WaterPricingMode.PerPerson : WaterPricingMode.PerCubicMeter) : null,
                ServiceFee = t == AssetDomainType.Apartment ? r.Next(3, 10) * 100_000m : r.NextDouble() < 0.6 ? 100_000m : null,
                ParkingFee = amenities.Contains(AmenityKeys.Parking) ? (r.NextDouble() < 0.5 ? 0m : 100_000m) : null,
                InternetFee = amenities.Contains(AmenityKeys.Wifi) ? 0m : null,
                MinLeaseMonths = t == AssetDomainType.Room ? (r.NextDouble() < 0.6 ? 6 : 3) : 12,
                AvailableFrom = now.AddDays(r.Next(0, 30)),
                MaxOccupants = t == AssetDomainType.Room ? 2 + r.Next(2) : null,
                PetsAllowed = highlight == "cho nuôi thú cưng" ? true : r.NextDouble() < 0.5 ? false : null,
                CurfewFree = t == AssetDomainType.Room ? r.NextDouble() < 0.7 : null,
                SharedWithOwner = t == AssetDomainType.Room ? r.NextDouble() < 0.2 : false,
                CookingAllowed = residential ? true : null,
            };
        }

        // ==================== Toà nhà 3D ====================

        private (Asset, List<AssetUnit>, List<Listing>) BuildBuilding(Building b, Place p, Random rnd, DateTime now)
        {
            // Khung hình chữ nhật xoay, tâm đặt đúng vị trí tài sản.
            var mLng = MPerDeg * Math.Cos(p.Lat * Math.PI / 180);
            var rot = b.RotateDeg * Math.PI / 180;
            var footprint = new[] { (-1, -1), (1, -1), (1, 1), (-1, 1) }.Select(c =>
            {
                var x0 = c.Item1 * b.Width / 2;
                var y0 = c.Item2 * b.Depth / 2;
                var x = x0 * Math.Cos(rot) - y0 * Math.Sin(rot);
                var y = x0 * Math.Sin(rot) + y0 * Math.Cos(rot);
                return new[] { Math.Round(p.Lng + x / mLng, 7), Math.Round(p.Lat + y / MPerDeg, 7) };
            }).ToList();

            var asset = new Asset
            {
                Name = b.Name,
                TypeProperty = b.Type,
                OwnershipType = AssetOwnershipType.Owned,
                Status = AssetStatus.InUse,
                Address = new Address { City = p.City, District = p.District, Ward = p.Ward, Detail = $"{120 + b.Floors} {p.Street}" },
                Location = _gf.CreatePoint(new Coordinate(p.Lng, p.Lat)),
                Area = Math.Round(b.Width * b.Depth),
                Floors = b.Floors,
                Bedrooms = b.Type == AssetDomainType.Office ? null : 1,
                Bathrooms = b.Type == AssetDomainType.Office ? null : 1,
                LegalStatus = "Sổ hồng riêng",
                FurnitureState = b.Type == AssetDomainType.Office ? "Cơ bản" : "Đầy đủ",
                Notes = Tag,
                FootprintJson = b.Modeled ? JsonSerializer.Serialize(footprint) : null,
                FloorHeightMeters = b.Modeled ? b.FloorHeight : null,
                BuildingModelPublished = b.Modeled,
            };

            var units = new List<AssetUnit>();
            var listings = new List<Listing>();
            var n = 0;
            for (var f = 1; f <= b.Floors; f++)
            {
                foreach (var (name, area) in b.Units(f))
                {
                    // Tầng trệt (ki-ốt, sảnh, cửa hàng) luôn đang dùng — tin của toà nhà là các căn ở.
                    var vacant = !(f == 1 && b.Floors > 5) && rnd.NextDouble() < b.VacantRate;
                    var unit = new AssetUnit
                    {
                        Asset = asset, Name = name, FloorNumber = f, Area = area,
                        Status = vacant ? UnitStatus.Vacant : (rnd.NextDouble() < 0.06 ? UnitStatus.UnderMaintenance : UnitStatus.Occupied),
                    };
                    units.Add(unit);
                    if (!vacant) continue;

                    // Không phải căn trống nào cũng đã có tin — đủ các ca chủ nhà thật gặp:
                    //   • toà mới khai (chưa 3D): một bản nháp, còn lại chưa đăng;
                    //   • toà đã có 3D: cứ 4 căn trống thì 1 căn chưa đăng tin (nút "Đăng tin căn
                    //     này", ảnh chung của toà), căn trống thứ hai đang chờ duyệt.
                    var unitStatus = ListingStatus.Approved;
                    if (!b.Modeled)
                    {
                        if (n > 0) { n++; continue; }
                        unitStatus = ListingStatus.Draft;
                    }
                    else if (n % 4 == 3) { n++; continue; }
                    else if (n == 1) unitStatus = ListingStatus.Pending;

                    var sale = b.SaleShare > 0 && n % 2 == 1 && rnd.NextDouble() < b.SaleShare * 2;
                    var price = UnitPrice(b, f, area, sale, rnd);
                    var amenities = UnitAmenities(b);
                    listings.Add(new Listing
                    {
                        Asset = asset,
                        AssetUnit = unit,
                        Title = UnitTitle(b, p, name, f, area, sale),
                        Description = $"{name}, tầng {f}, diện tích {area:0} m². {b.Description}\n\nXem toà nhà ở dạng 3D để biết vị trí căn và các căn còn trống khác.",
                        Price = price,
                        Type = sale ? ListingType.Sale : ListingType.Rent,
                        RentPaymentCycle = sale ? null : PaymentCycle.Monthly,
                        Status = unitStatus,
                        Slug = unitStatus == ListingStatus.Draft ? null : $"{(sale ? "ban" : "thue")}-{b.Key}-{Slugify(name)}-{(uint)rnd.Next():x6}",
                        PublishedAt = unitStatus == ListingStatus.Approved ? now.AddDays(-(1 + rnd.Next(0, 25))) : null,
                        Amenities = amenities,
                        Terms = sale ? new ListingTerms() : Terms(b.Type, amenities, "", rnd, now),
                        Images = Images(b.Images, unitStatus, n + b.Floors, rnd),
                    });
                    n++;
                }
            }
            return (asset, units, listings);
        }

        private static decimal UnitPrice(Building b, int floor, double area, bool sale, Random r) => b.Key switch
        {
            "b-ltt" => Math.Round((decimal)(area * 450_000) / 500_000m) * 500_000m,
            "b-caugiay" => (area > 30 ? 5_500_000m : 4_200_000m) + floor * 100_000m,
            "b-tdmu" => 2_600_000m - (floor - 1) * 100_000m,
            "b-myan" when sale => Math.Round((decimal)(area * 38_000_000) / 50_000_000m) * 50_000_000m + floor * 30_000_000m,
            "b-myan" => (area > 60 ? 10_000_000m : 8_000_000m) + floor * 200_000m,
            _ => (area > 32 ? 6_500_000m : 5_200_000m) + floor * 100_000m,
        };

        private static string UnitTitle(Building b, Place p, string unit, int floor, double area, bool sale) => b.Type switch
        {
            AssetDomainType.Office => $"Cho thuê {unit.ToLowerInvariant()} {area:0} m² — {b.Name}, {ShortArea(p.District)}",
            AssetDomainType.Room => $"Phòng {area:0} m² tầng {floor} {b.Name.Replace("Nhà trọ cao tầng ", "đường ").Replace("Chung cư mini ", "chung cư mini ")}, {ShortArea(p.District)}",
            _ when sale => $"Bán căn hộ {area:0} m² tầng {floor} — {b.Name}",
            _ => $"Căn hộ dịch vụ {area:0} m² tầng {floor}, {p.Street}, {ShortArea(p.District)}",
        };

        private static List<string> UnitAmenities(Building b) => b.Type switch
        {
            AssetDomainType.Office => new() { AmenityKeys.AirConditioner, AmenityKeys.Elevator, AmenityKeys.Parking, AmenityKeys.Security },
            AssetDomainType.Room when b.Key == "b-tdmu" => new() { AmenityKeys.Wifi, AmenityKeys.Parking, AmenityKeys.PrivateBathroom, AmenityKeys.Security, AmenityKeys.WashingMachine },
            AssetDomainType.Room => new() { AmenityKeys.AirConditioner, AmenityKeys.Elevator, AmenityKeys.PrivateBathroom, AmenityKeys.Wifi, AmenityKeys.Security, AmenityKeys.Furnished },
            _ => new() { AmenityKeys.AirConditioner, AmenityKeys.Elevator, AmenityKeys.Balcony, AmenityKeys.Furnished, AmenityKeys.PrivateKitchen, AmenityKeys.Security },
        };

        // ==================== Tương tác ====================

        private async Task<(int, int, int, int)> EngagementAsync(
            List<Listing> live, Dictionary<string, string> people, Random rnd, DateTime now, CancellationToken ct)
        {
            var today = DateOnly.FromDateTime(now);
            var views = new List<ListingView>();
            foreach (var l in live)
            {
                // Tin mới nhiều lượt xem hơn, rải 30 ngày — biểu đồ thống kê không phẳng lì.
                var total = 4 + rnd.Next(0, 70);
                for (var v = 0; v < total; v++)
                {
                    var daysAgo = (int)Math.Floor(Math.Pow(rnd.NextDouble(), 1.7) * 30);
                    views.Add(new ListingView
                    {
                        ListingId = l.Id,
                        ViewerHash = $"sc{l.Id:N}"[..20] + v.ToString("D4"),
                        ViewedAt = now.AddDays(-daysAgo).AddHours(-rnd.Next(0, 12)),
                        ViewedOn = today.AddDays(-daysAgo),
                    });
                }
                l.ViewCount = total;
            }

            bool In(Listing l, string city, string? district = null) =>
                l.Asset.Address.City == city && (district == null || l.Asset.Address.District == district);
            var khoaPicks = live.Where(l => l.Type == ListingType.Rent && In(l, "Thành phố Hồ Chí Minh", "Quận Bình Thạnh")).Take(5).ToList();
            var maiPicks = live.Where(l => l.Type == ListingType.Sale && l.Asset.TypeProperty == AssetDomainType.PrivateHouse
                                           && In(l, "Thành phố Hồ Chí Minh", "Thành phố Thủ Đức")).Take(4).ToList();
            var huyPicks = live.Where(l => l.Type == ListingType.Rent && In(l, "Tỉnh Bình Dương", "Thành phố Thủ Dầu Một")
                                           && l.Price <= 3_000_000).Take(4).ToList();

            var saved = khoaPicks.Select(l => (people["khoa"], l))
                .Concat(maiPicks.Select(l => (people["mai"], l)))
                .Concat(huyPicks.Select(l => (people["huy"], l)))
                .Select((x, k) => new SavedListing { UserId = x.Item1, ListingId = x.l.Id, SavedAt = now.AddDays(-(k % 9)) })
                .ToList();

            var inquiries = new List<ListingInquiry>();
            void Ask(string who, Listing? l, string msg, InquiryStatus st, int daysAgo)
            {
                if (l is null) return;
                inquiries.Add(new ListingInquiry
                {
                    ListingId = l.Id, FromUserId = people[who], ToUserId = l.Asset.UserId,
                    Message = msg, PreferredViewingAt = now.AddDays(2 + daysAgo % 4).Date.AddHours(17),
                    Status = st, CreatedAt = now.AddDays(-daysAgo),
                    // Đã phản hồi thì có mốc phản hồi — hồ sơ người đăng tính "thường trả lời
                    // trong khoảng" từ đây.
                    UpdatedAt = st == InquiryStatus.New ? null : now.AddDays(-daysAgo).AddHours(2 + daysAgo * 1.5),
                });
            }
            Ask("khoa", khoaPicks.ElementAtOrDefault(0), "Chào chị, phòng còn trống không ạ? Em đi làm ở Quận 1, muốn xem phòng chiều thứ Bảy.", InquiryStatus.New, 1);
            Ask("khoa", khoaPicks.ElementAtOrDefault(1), "Phòng có chỗ để xe máy và giờ giấc tự do không ạ? Em muốn dọn vào đầu tháng.", InquiryStatus.Contacted, 4);
            Ask("mai", maiPicks.ElementAtOrDefault(0), "Gia đình tôi muốn xem nhà cuối tuần này. Nhà có sổ hồng riêng và đã hoàn công chưa anh?", InquiryStatus.Viewed, 6);
            Ask("mai", maiPicks.ElementAtOrDefault(1), "Nhà gần trường tiểu học nào ạ? Giá có thương lượng được không?", InquiryStatus.New, 2);
            Ask("huy", huyPicks.ElementAtOrDefault(0), "Em là sinh viên ĐH Thủ Dầu Một, phòng có wifi riêng không ạ? Em ở một mình.", InquiryStatus.New, 0);

            var reports = new List<ListingReport>();
            var rentalsToReport = live.Where(l => l.Type == ListingType.Rent && l.AssetUnit == null).Skip(8).Take(2).ToList();
            if (rentalsToReport.Count > 0)
                reports.Add(new ListingReport
                {
                    ListingId = rentalsToReport[0].Id, ReporterUserId = people["khoa"], Reason = ListingReportReason.AlreadyTaken,
                    Detail = "Gọi hỏi thì chủ nhà nói phòng đã cho thuê từ tuần trước.", Status = ListingReportStatus.Pending,
                    CreatedAt = now.AddDays(-2),
                });
            if (rentalsToReport.Count > 1)
                reports.Add(new ListingReport
                {
                    ListingId = rentalsToReport[1].Id, ReporterUserId = people["huy"], Reason = ListingReportReason.WrongInfo,
                    Detail = "Giá thực tế cao hơn trên tin khoảng 500 nghìn, chưa tính phí dịch vụ.", Status = ListingReportStatus.Pending,
                    CreatedAt = now.AddDays(-1),
                });

            _db.Set<ListingView>().AddRange(views);
            _db.Set<SavedListing>().AddRange(saved);
            _db.Set<ListingInquiry>().AddRange(inquiries);
            _db.Set<ListingReport>().AddRange(reports);
            await _db.SaveChangesAsync(ct);
            return (views.Count, saved.Count, inquiries.Count, reports.Count);
        }

        /// <summary>Ca của khu quản trị: báo vi phạm ĐÃ xử lý (bỏ qua; xác nhận rồi trả về sửa) và
        /// một tài khoản đăng tin lừa đảo đã bị khoá, tin bị gỡ — đúng như các thao tác thật để
        /// lại (trạng thái tin, sự kiện kiểm duyệt, ghi chú, người xử lý). Trả về số báo cáo.</summary>
        private async Task<int> AdminCasesAsync(
            List<Listing> live, Dictionary<string, string> people, string? adminId, DateTime now, CancellationToken ct)
        {
            var reports = new List<ListingReport>();
            var rentals = live.Where(l => l.Type == ListingType.Rent && l.AssetUnit == null).Skip(14).Take(2).ToList();
            if (rentals.Count > 0)
                reports.Add(new ListingReport
                {
                    ListingId = rentals[0].Id, ReporterUserId = people["mai"], Reason = ListingReportReason.WrongInfo,
                    Detail = "Ảnh trông không giống phòng thật.", Status = ListingReportStatus.Dismissed,
                    CreatedAt = now.AddDays(-9), HandledAt = now.AddDays(-8), HandledByUserId = adminId,
                    HandlerNote = "Đã đối chiếu ảnh với chủ tin — đúng phòng, không vi phạm.",
                });
            if (rentals.Count > 1)
            {
                var l = rentals[1];
                reports.Add(new ListingReport
                {
                    ListingId = l.Id, ReporterUserId = people["khoa"], Reason = ListingReportReason.WrongInfo,
                    Detail = "Tin ghi giá 3,5 triệu nhưng gọi thì chủ báo 4 triệu chưa gồm điện nước.", Status = ListingReportStatus.Resolved,
                    CreatedAt = now.AddDays(-6), HandledAt = now.AddDays(-5), HandledByUserId = adminId,
                    HandlerNote = "Trả về cho chủ tin cập nhật giá đúng.",
                });
                l.Status = ListingStatus.ChangesRequested;
                l.ModerationNote = "Theo báo cáo của người dùng: giá trên tin chưa đúng thực tế. Cập nhật giá và chi phí rồi gửi duyệt lại.";
                _db.Set<ListingModerationEvent>().Add(new ListingModerationEvent
                {
                    // Vòng 5: luôn sau các vòng đã có (tin từng bị trả về có tới 4 vòng).
                    Listing = l, Action = ModerationAction.ChangesRequested, Round = 5, CreatedAt = now.AddDays(-5),
                    Note = l.ModerationNote, Reasons = new() { ModerationReason.PriceOrCostIssue },
                });
            }

            // Tài khoản lừa đảo: 2 tin phòng trọ giá rẻ bất thường, đã duyệt rồi bị gỡ khi khoá.
            var spam = await _users.FindByIdAsync(people["spam"]);
            var place = Places.First(p => p.Key == "q10-3thang2");
            var reason = "Đăng tin lừa đảo: yêu cầu chuyển cọc trước khi xem phòng, ảnh lấy từ tin của người khác.";
            for (var k = 0; k < 2; k++)
            {
                var asset = new Asset
                {
                    UserId = people["spam"], Name = $"Phòng trọ Ba Tháng Hai #{k + 1}", TypeProperty = AssetDomainType.Room,
                    OwnershipType = AssetOwnershipType.Owned, Status = AssetStatus.Vacant, Notes = Tag,
                    Address = new Address { City = place.City, District = place.District, Ward = place.Ward, Detail = $"{200 + k} {place.Street}" },
                    Location = _gf.CreatePoint(new Coordinate(place.Lng + 0.001 * (k + 1), place.Lat)), Area = 25, Bedrooms = 1, Bathrooms = 1,
                };
                var pub = now.AddDays(-4 + k);
                var listing = new Listing
                {
                    Asset = asset, Type = ListingType.Rent, RentPaymentCycle = PaymentCycle.Monthly,
                    Title = $"Phòng trọ 25 m² full nội thất chỉ 1,5 triệu gần ĐH Bách Khoa #{k + 1}",
                    Description = "Phòng đẹp giá rẻ nhất khu vực, chuyển cọc giữ phòng trước qua tài khoản, xem phòng sau.",
                    Price = 1_500_000, Status = ListingStatus.Rejected,
                    Slug = $"thue-phong-tro-q10-vipham-{k + 1}", PublishedAt = pub, CreatedAt = pub.AddHours(-3),
                    ModerationNote = AdminRules.LockTakedownNote(reason, wasPending: false),
                    Amenities = new() { AmenityKeys.AirConditioner, AmenityKeys.Furnished },
                    Terms = new ListingTerms { DepositMonths = 1 },
                    Images = Images("room", ListingStatus.Approved, 40 + k, new Random(RandomSeed + 7 + k)),
                };
                _db.Assets.Add(asset);
                _db.Set<Listing>().Add(listing);
                void Ev(ModerationAction a, int round, DateTime at, string? note = null, List<ModerationReason>? rs = null)
                    => _db.Set<ListingModerationEvent>().Add(new ListingModerationEvent
                    {
                        Listing = listing, Action = a, Round = round, CreatedAt = at, Note = note, Reasons = rs ?? new(),
                    });
                Ev(ModerationAction.Submitted, 1, pub.AddHours(-2));
                Ev(ModerationAction.Approved, 2, pub);
                Ev(ModerationAction.TakenDown, 3, now.AddDays(-1), listing.ModerationNote,
                    new() { ModerationReason.ProhibitedContent });
                if (k == 0)
                    reports.Add(new ListingReport
                    {
                        Listing = listing, ReporterUserId = people["huy"], Reason = ListingReportReason.Scam,
                        Detail = "Chủ tin đòi chuyển khoản 1 triệu giữ phòng trước khi cho xem, gọi lại thì chặn số.",
                        Status = ListingReportStatus.Resolved, CreatedAt = now.AddDays(-2),
                        HandledAt = now.AddDays(-1), HandledByUserId = adminId, HandlerNote = "Xác nhận lừa đảo — gỡ tin và khoá tài khoản.",
                    });
            }
            if (spam is not null)
            {
                spam.LockoutEnabled = true;
                spam.LockoutEnd = AdminRules.LockEnd(new DateTimeOffset(now), null);
                spam.AdminLockReason = reason;
                spam.AdminLockedAt = now.AddDays(-1);
                spam.AdminLockedByUserId = adminId;
            }

            _db.Set<ListingReport>().AddRange(reports);
            await _db.SaveChangesAsync(ct);
            return reports.Count;
        }

        /// <summary>Nhu cầu đã lưu và lời mời xem nhà — dữ liệu cho ghép đôi hai chiều. Lời mời
        /// chỉ gửi cho tin THẬT SỰ khớp nhu cầu, xét bằng đúng truy vấn khớp mà hệ thống dùng
        /// (SavedSearchService.BuildMatchQuery), như khi chủ nhà mời thật.</summary>
        private async Task<(int, int)> DemandsAsync(
            List<Listing> listings, Dictionary<string, string> people, DateTime now, CancellationToken ct)
        {
            var searches = new List<(Demand D, SavedSearch S, PublicListingSearchQuery Q)>();
            foreach (var d in Demands)
            {
                var q = new PublicListingSearchQuery(
                    Type: d.Type, City: d.City, District: d.District, PriceMin: d.PriceMin, PriceMax: d.PriceMax,
                    BedroomsMin: d.BedroomsMin, Keyword: null, Latitude: null, Longitude: null, RadiusMeters: null,
                    TotalCostMax: null, PetsAllowed: null, CurfewFree: null, SharedWithOwner: null, AvailableBy: null,
                    Amenities: null, SortBy: null,
                    PropertyTypes: d.Types?.ToList(), LegalStatuses: d.Legal?.ToList(), Has3D: d.Has3D ? true : null);
                var s = new SavedSearch
                {
                    UserId = people[d.Person],
                    Name = d.Name,
                    CriteriaJson = JsonSerializer.Serialize(q),
                    // Tắt thông báo: tài khoản @kgs.test không có hộp thư thật, job gửi thư chỉ
                    // tốn công. Huy hiệu "tin mới" vẫn hiện nhờ LastCheckedAt lùi vài ngày.
                    NotifyEnabled = false,
                    LastCheckedAt = now.AddDays(-5),
                    DiscoverableByOwners = d.Discoverable,
                    DemandNote = d.Note,
                    DiscoverableSince = d.Discoverable ? now.AddDays(-10) : null,
                };
                searches.Add((d, s, q));
            }
            _db.Set<SavedSearch>().AddRange(searches.Select(x => x.S));
            await _db.SaveChangesAsync(ct);

            var live = listings.Where(l => l.Status == ListingStatus.Approved).AsQueryable();
            var invitations = new List<ListingInvitation>();
            void Invite(string person, string message)
            {
                var x = searches.First(s => s.D.Person == person && s.D.Discoverable);
                var match = SavedSearchService.BuildMatchQuery(live, x.Q, _gf).FirstOrDefault();
                if (match is null) return;
                invitations.Add(new ListingInvitation
                {
                    ListingId = match.Id, SavedSearchId = x.S.Id,
                    OwnerUserId = match.Asset.UserId, SeekerUserId = x.S.UserId,
                    Message = message, Status = InvitationStatus.Pending, CreatedAt = now.AddHours(-20),
                });
            }
            Invite("khoa", "Chào bạn, phòng mình ở Bình Thạnh vừa trống, đúng tầm giá bạn tìm, có chỗ để xe. Mời bạn qua xem.");
            Invite("mai", "Chào chị, tôi đang có căn nhà ở Thủ Đức sổ hồng riêng, hẻm xe hơi, gần trường tiểu học. Mời chị xem thử.");
            Invite("huy", "Chào em, nhà trọ gần ĐH Thủ Dầu Một còn phòng, wifi mạnh, giờ giấc tự do. Em ghé xem nhé.");

            _db.Set<ListingInvitation>().AddRange(invitations);
            await _db.SaveChangesAsync(ct);
            return (searches.Count, invitations.Count);
        }

        /// <summary>Thông báo trong ứng dụng khớp với câu chuyện của bộ dữ liệu — cùng câu chữ và
        /// đường dẫn hệ thống thật gửi (yêu cầu xem nhà, lời mời, kiểm duyệt, bộ lọc đã lưu), để
        /// mở tài khoản nào ra chuông cũng có việc để xem.</summary>
        private async Task NotificationsAsync(
            List<Listing> listings, Dictionary<string, string> people, DateTime now, CancellationToken ct)
        {
            var ids = listings.Select(l => l.Id).ToList();
            var notes = new List<Notification>();
            void Add(string userId, string title, string body, string link, string label, double hoursAgo, bool read = false)
                => notes.Add(new Notification
                {
                    UserId = userId, Title = title, Body = body, LinkPath = link, LinkLabel = label,
                    CreatedAt = now.AddHours(-hoursAgo), ReadAt = read ? now.AddHours(-hoursAgo + 1) : null,
                });

            var inquiries = await _db.Set<ListingInquiry>().Include(i => i.Listing).Include(i => i.FromUser)
                .Where(i => ids.Contains(i.ListingId)).ToListAsync(ct);
            foreach (var i in inquiries)
                Add(i.ToUserId, $"Có người hỏi thuê: {i.Listing.Title}",
                    $"{i.FromUser.Name} vừa gửi yêu cầu xem nhà. Lời nhắn: {i.Message}",
                    "/yeu-cau", "Xem yêu cầu", (now - i.CreatedAt).TotalHours, read: i.Status != InquiryStatus.New);

            var invitations = await _db.Set<ListingInvitation>().Include(i => i.Listing).Include(i => i.SavedSearch)
                .Where(i => ids.Contains(i.ListingId)).ToListAsync(ct);
            foreach (var inv in invitations)
                Add(inv.SeekerUserId, $"Chủ nhà mời bạn xem nhà: {inv.Listing.Title}",
                    $"Tin này khớp nhu cầu \"{inv.SavedSearch?.Name}\" bạn đang tìm. Lời nhắn của chủ nhà: \"{inv.Message}\". " +
                    "Chủ nhà chưa biết bạn là ai — thông tin liên hệ chỉ được gửi đi khi bạn nhận lời.",
                    "/yeu-cau?tab=invites", "Xem lời mời", 20);

            foreach (var l in listings.Where(l => l.Status == ListingStatus.ChangesRequested))
                Add(l.Asset.UserId, $"Tin đăng cần chỉnh sửa: {l.Title}", l.ModerationNote ?? "",
                    "/tin-cua-toi", "Mở tin để sửa", 72);
            foreach (var l in listings.Where(l => l.Status == ListingStatus.Rejected))
                Add(l.Asset.UserId, $"Tin đăng bị từ chối: {l.Title}",
                    $"Lý do: {l.ModerationNote} Bạn có thể sửa lại nội dung và gửi duyệt lần nữa.",
                    "/tin-cua-toi", "Mở tin để sửa", 72, read: true);
            foreach (var l in listings.Where(l => l.Status == ListingStatus.Approved && l.AssetUnit == null).Take(12))
                Add(l.Asset.UserId, $"Tin đăng đã được duyệt: {l.Title}",
                    "Tin của bạn đã hiển thị công khai trên KGS.", "/tin-cua-toi", "Xem tin đã đăng",
                    (now - (l.PublishedAt ?? now)).TotalHours, read: true);

            Add(people["khoa"], "3 tin mới khớp bộ lọc \"Phòng trọ Bình Thạnh dưới 5 triệu\"",
                "Có 3 tin mới khớp bộ lọc của bạn kể từ lần xem trước. Mở trang tìm nhà để xem.",
                "/tin-dang", "Xem tin mới", 6);

            _db.Notifications.AddRange(notes);
            await _db.SaveChangesAsync(ct);
        }

        // ==================== Tiện ích ====================

        /// <summary>Tạo (hoặc tìm lại) các tài khoản của bộ. Trả về khoá → UserId.</summary>
        private async Task<Dictionary<string, string>> EnsurePeopleAsync()
        {
            var map = new Dictionary<string, string>();
            foreach (var p in People)
            {
                var user = await _users.FindByEmailAsync(p.Email);
                if (user is null)
                {
                    user = new ApplicationUser
                    {
                        UserName = p.Email, Email = p.Email, EmailConfirmed = true,
                        Name = p.Name, PhoneNumber = p.Phone,
                        CreatedAt = DateTime.UtcNow.AddMonths(-p.JoinedMonthsAgo),
                    };
                    var created = await _users.CreateAsync(user, DemoPassword);
                    if (!created.Succeeded)
                        throw new InvalidOperationException(string.Join("; ", created.Errors.Select(e => e.Description)));
                }
                map[p.Key] = user.Id;
            }
            return map;
        }

        private Point Jitter(Place p, Random r)
        {
            // Lệch 40–150 m theo một hướng bất kỳ: các tin cùng phố không chồng lên nhau mà vẫn
            // nằm trên/sát phố đó.
            var a = r.NextDouble() * 2 * Math.PI;
            var d = Lerp(40, 150, r.NextDouble());
            var lat = p.Lat + d * Math.Sin(a) / MPerDeg;
            var lng = p.Lng + d * Math.Cos(a) / (MPerDeg * Math.Cos(p.Lat * Math.PI / 180));
            return _gf.CreatePoint(new Coordinate(Math.Round(lng, 6), Math.Round(lat, 6)));
        }

        private static List<ListingImage> Images(string poolKey, ListingStatus status, int idx, Random r)
        {
            var pool = ImagePools[poolKey];
            // Một ít tin không ảnh, có chủ đích: gợi ý "tin chưa có ảnh" ở bảng thống kê cần có ca thật.
            var n = status == ListingStatus.Draft ? r.Next(0, 2) : idx % 13 == 5 ? 0 : 3 + r.Next(Math.Min(4, pool.Length - 2));
            // Không lặp ảnh trong một tin — ảnh trùng làm trang tin trông giả và trùng khoá ở giao diện.
            return pool.OrderBy(_ => r.Next()).Take(n).Select((url, k) => new ListingImage
            {
                File = new StoredFile
                {
                    Url = url, PublicId = $"showcase/{Guid.NewGuid():N}", FileName = $"anh-{k + 1}.jpg",
                    ContentType = "image/jpeg", SizeBytes = 150_000 + r.Next(0, 700_000),
                },
                SortOrder = k,
            }).ToList();
        }

        private static string SlugFor(Spec s, Place p, int idx, Random r)
            => $"{(s.Mode == ListingType.Sale ? "ban" : "thue")}-{Slugify(TypeName(s.Type))}-{Slugify(ShortArea(p.District))}-{idx + 1}-{(uint)r.Next():x6}";

        public static string ShortArea(string district) => district
            .Replace("Thành phố ", "").Replace("Huyện ", "").Replace("Thị xã ", "")
            .Replace("Quận ", Char.IsDigit(district.LastOrDefault()) ? "Quận " : "");

        private static string TypeName(AssetDomainType t) => t switch
        {
            AssetDomainType.Room => "Phòng trọ",
            AssetDomainType.Apartment => "Căn hộ",
            AssetDomainType.PrivateHouse => "Nhà phố",
            AssetDomainType.Land => "Đất nền",
            AssetDomainType.Villa => "Biệt thự",
            AssetDomainType.Shophouse => "Shophouse",
            AssetDomainType.Office => "Văn phòng",
            AssetDomainType.CommercialSpace => "Mặt bằng",
            AssetDomainType.Warehouse => "Kho xưởng",
            _ => "Bất động sản",
        };

        private static double Lerp(double a, double b, double t) => a + (b - a) * t;

        private static string Slugify(string s)
        {
            var stripped = new string(s.Normalize(System.Text.NormalizationForm.FormD)
                .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)
                         != System.Globalization.UnicodeCategory.NonSpacingMark).ToArray());
            var lower = stripped.Normalize(System.Text.NormalizationForm.FormC).ToLowerInvariant().Replace('đ', 'd');
            return System.Text.RegularExpressions.Regex.Replace(lower, "[^a-z0-9]+", "-").Trim('-');
        }
    }
}
