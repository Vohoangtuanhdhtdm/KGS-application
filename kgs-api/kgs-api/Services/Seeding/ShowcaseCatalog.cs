using kgs_api.Domain.ValueObjects;
using static kgs_api.Domain.Enums;

namespace kgs_api.Services.Seeding
{
    /// <summary>Danh mục cố định của bộ dữ liệu trình diễn — địa điểm, người dùng, loại hình,
    /// toà nhà 3D, ảnh. Tách khỏi phần sinh dữ liệu để đọc và sửa nội dung mà không phải đụng
    /// tới logic (xem ShowcaseSeeder).
    ///
    /// Nguyên tắc chọn dữ liệu:
    ///   • Địa điểm là những tuyến phố CÓ THẬT, toạ độ đặt trên phố đó (lệch tối đa ~150 m), nên
    ///     ghim không rơi xuống sông và khối nhà 3D nằm giữa khu dân cư thật.
    ///   • Tên tỉnh/quận viết đúng tên hành chính chính thức (AdministrativeNames) — có test giữ.
    ///   • Hướng, pháp lý, nội thất dùng đúng từ vựng chuẩn (PropertyVocabulary).
    ///   • Đủ chín loại hình, cả bán lẫn thuê, ở bốn tỉnh/thành — đề tài không chỉ là phòng trọ.</summary>
    public static class ShowcaseCatalog
    {
        /// <summary>Nhãn trên Asset.Notes — xoá bộ dữ liệu chỉ đụng đúng những gì có nhãn này.</summary>
        public const string Tag = "[showcase]";
        public const string DemoPassword = "Demo@12345";

        // ==================== Người dùng ====================

        public sealed record Person(string Key, string Email, string Name, string Phone, int JoinedMonthsAgo);

        /// <summary>Ba tài khoản đầu trùng với bộ demo cũ (SeedDemoController) — người đã quen
        /// đăng nhập bằng chúng vẫn dùng được.</summary>
        public static readonly Person[] People =
        {
            new("ngoc", "chuthue.demo@kgs.test", "Trần Thị Bích Ngọc", "0903112233", 26),   // chủ nhà trọ TP.HCM
            new("hung", "moigioi.demo@kgs.test", "Nguyễn Văn Hùng", "0912445566", 31),      // môi giới nhà đất
            new("khoa", "nguoithue.demo@kgs.test", "Lê Minh Khoa", "0987778899", 8),        // người đi thuê
            new("bao", "chunha.hanoi@kgs.test", "Phạm Quốc Bảo", "0934556677", 19),         // chủ nhà Hà Nội
            new("ha", "chunha.mientrung@kgs.test", "Đặng Thu Hà", "0905667788", 14),        // chủ nhà Đà Nẵng, Bình Dương
            new("kho", "kinhdoanh.demo@kgs.test", "Công ty TNHH Kho vận Sài Gòn", "0283822468", 40), // văn phòng, kho, mặt bằng
            new("mai", "timnha.giadinh@kgs.test", "Võ Thị Mai", "0978123456", 3),           // gia đình đi mua nhà
            new("huy", "timnha.sinhvien@kgs.test", "Huỳnh Gia Huy", "0966234567", 2),       // sinh viên ĐH Thủ Dầu Một
        };

        // ==================== Địa điểm ====================

        /// <param name="Factor">Hệ số giá so với mặt bằng chung (1,0 ≈ quận ven trung tâm TP.HCM).</param>
        /// <param name="Near">Đặc điểm khu vực — đưa vào mô tả để tìm theo mong muốn mềm có cái mà khớp.</param>
        public sealed record Place(
            string Key, string City, string District, string Ward, string Street,
            double Lat, double Lng, double Factor, string Near);

        private const string Hcm = "Thành phố Hồ Chí Minh";
        private const string Hn = "Thành phố Hà Nội";
        private const string Dn = "Thành phố Đà Nẵng";
        private const string Bd = "Tỉnh Bình Dương";

        public static readonly Place[] Places =
        {
            new("q1-letthanhton", Hcm, "Quận 1", "Phường Bến Nghé", "Lê Thánh Tôn", 10.7769, 106.7030, 1.85, "đi bộ ra chợ Bến Thành, phố đi bộ Nguyễn Huệ"),
            new("q1-tandinh", Hcm, "Quận 1", "Phường Tân Định", "Trần Quang Khải", 10.7905, 106.6890, 1.6, "gần chợ Tân Định, nhiều quán ăn"),
            new("q3-nkkn", Hcm, "Quận 3", "Phường Võ Thị Sáu", "Nam Kỳ Khởi Nghĩa", 10.7840, 106.6905, 1.6, "gần Hồ Con Rùa, khu văn phòng sầm uất"),
            new("q3-kydong", Hcm, "Quận 3", "Phường 9", "Kỳ Đồng", 10.7838, 106.6800, 1.45, "yên tĩnh, gần nhà thờ Kỳ Đồng"),
            new("q4-hoangdieu", Hcm, "Quận 4", "Phường 13", "Hoàng Diệu", 10.7600, 106.7020, 1.2, "qua cầu là tới Quận 1, phố ẩm thực Vĩnh Khánh"),
            new("q5-thd", Hcm, "Quận 5", "Phường 11", "Trần Hưng Đạo", 10.7530, 106.6690, 1.25, "khu Chợ Lớn buôn bán sầm uất"),
            new("q7-pmh", Hcm, "Quận 7", "Phường Tân Phong", "Nguyễn Văn Linh", 10.7290, 106.7090, 1.45, "khu Phú Mỹ Hưng, trường quốc tế, công viên"),
            new("q7-nttthap", Hcm, "Quận 7", "Phường Tân Hưng", "Nguyễn Thị Thập", 10.7400, 106.7030, 1.25, "gần Lotte Mart, nhiều tiện ích"),
            new("q10-3thang2", Hcm, "Quận 10", "Phường 12", "Ba Tháng Hai", 10.7720, 106.6670, 1.3, "gần Đại học Bách Khoa, chợ Hòa Hưng"),
            new("bt-xvnt", Hcm, "Quận Bình Thạnh", "Phường 25", "Xô Viết Nghệ Tĩnh", 10.8040, 106.7111, 1.15, "gần chợ Bà Chiểu, đi Quận 1 khoảng 10 phút"),
            new("bt-dbp", Hcm, "Quận Bình Thạnh", "Phường 22", "Điện Biên Phủ", 10.7985, 106.7180, 1.2, "gần Landmark 81, công viên ven sông"),
            new("pn-pxl", Hcm, "Quận Phú Nhuận", "Phường 2", "Phan Xích Long", 10.7990, 106.6870, 1.25, "phố ẩm thực Phan Xích Long"),
            new("gv-quangtrung", Hcm, "Quận Gò Vấp", "Phường 10", "Quang Trung", 10.8370, 106.6650, 0.95, "gần chợ Hạnh Thông Tây, Đại học Công nghiệp"),
            new("tb-hvt", Hcm, "Quận Tân Bình", "Phường 2", "Hoàng Văn Thụ", 10.7990, 106.6650, 1.1, "gần sân bay Tân Sơn Nhất, công viên Hoàng Văn Thụ"),
            new("td-thaodien", Hcm, "Thành phố Thủ Đức", "Phường Thảo Điền", "Xuân Thủy", 10.8030, 106.7350, 1.65, "khu Thảo Điền yên tĩnh, nhiều cây xanh, trường quốc tế"),
            new("td-linhtrung", Hcm, "Thành phố Thủ Đức", "Phường Linh Trung", "Hoàng Diệu 2", 10.8620, 106.7700, 0.75, "gần Làng Đại học Thủ Đức, ga metro Suối Tiên"),
            new("td-anphu", Hcm, "Thành phố Thủ Đức", "Phường An Phú", "Song Hành", 10.8020, 106.7500, 1.4, "sát ga metro An Phú, vào Quận 1 nhanh"),
            new("btan-tenlua", Hcm, "Quận Bình Tân", "Phường Bình Trị Đông B", "Tên Lửa", 10.7530, 106.6130, 0.8, "gần Aeon Mall Bình Tân"),
            new("bchanh-tankien", Hcm, "Huyện Bình Chánh", "Xã Tân Kiên", "Quốc lộ 1A", 10.7110, 106.5880, 0.6, "sát Quốc lộ 1A, gần khu công nghiệp"),
            new("q12-tth", Hcm, "Quận 12", "Phường Tân Thới Hiệp", "Nguyễn Ảnh Thủ", 10.8620, 106.6450, 0.75, "khu dân cư mới, nhiều trường học"),

            new("hn-caugiay", Hn, "Quận Cầu Giấy", "Phường Dịch Vọng Hậu", "Trần Thái Tông", 21.0310, 105.7880, 1.3, "gần Đại học Quốc gia Hà Nội, công viên Cầu Giấy"),
            new("hn-dongda", Hn, "Quận Đống Đa", "Phường Láng Hạ", "Láng Hạ", 21.0150, 105.8140, 1.35, "khu văn phòng, gần hồ Thành Công"),
            new("hn-hoankiem", Hn, "Quận Hoàn Kiếm", "Phường Hàng Bạc", "Hàng Bạc", 21.0340, 105.8530, 2.0, "phố cổ, đi bộ ra hồ Hoàn Kiếm"),
            new("hn-mydinh", Hn, "Quận Nam Từ Liêm", "Phường Mỹ Đình 1", "Lê Đức Thọ", 21.0280, 105.7710, 1.15, "gần sân vận động Mỹ Đình, bến xe Mỹ Đình"),
            new("hn-bachkhoa", Hn, "Quận Hai Bà Trưng", "Phường Bách Khoa", "Tạ Quang Bửu", 21.0040, 105.8470, 1.2, "gần Đại học Bách Khoa Hà Nội"),

            new("dn-haichau", Dn, "Quận Hải Châu", "Phường Thạch Thang", "Bạch Đằng", 16.0740, 108.2240, 1.0, "ven sông Hàn, gần cầu Rồng"),
            new("dn-sontra", Dn, "Quận Sơn Trà", "Phường Phước Mỹ", "Hồ Nghinh", 16.0640, 108.2440, 1.05, "cách biển Mỹ Khê vài trăm mét"),
            new("dn-myan", Dn, "Quận Ngũ Hành Sơn", "Phường Mỹ An", "Châu Thị Vĩnh Tế", 16.0490, 108.2430, 0.95, "gần biển, khu phố du lịch An Thượng"),

            new("bd-phuhoa", Bd, "Thành phố Thủ Dầu Một", "Phường Phú Hòa", "Trần Văn Ơn", 10.9800, 106.6750, 0.7, "gần Đại học Thủ Dầu Một, chợ Phú Hòa"),
            new("bd-hiepthanh", Bd, "Thành phố Thủ Dầu Một", "Phường Hiệp Thành", "Lê Hồng Phong", 10.9930, 106.6560, 0.7, "trung tâm Thủ Dầu Một, gần Becamex Tower"),
            new("bd-dian", Bd, "Thành phố Dĩ An", "Phường Dĩ An", "Nguyễn An Ninh", 10.9060, 106.7690, 0.65, "gần khu công nghiệp Sóng Thần, ga Dĩ An"),
            new("bd-thuanan", Bd, "Thành phố Thuận An", "Phường Bình Hòa", "Đại lộ Bình Dương", 10.9200, 106.7150, 0.65, "mặt tiền Đại lộ Bình Dương, gần KCN Việt Hương"),
        };

        // ==================== Loại hình ====================

        public enum Owner { Ngoc, Hung, Bao, Ha, Kho }

        /// <param name="Places">Địa điểm hợp với loại hình này — lấy lần lượt, vòng lại khi hết.</param>
        /// <param name="Images">Khoá nhóm ảnh trong <see cref="ImagePools"/>.</param>
        public sealed record Spec(
            AssetDomainType Type, ListingType Mode, int Count, string[] Places, string Images,
            (int Min, int Max) Area, string[] Titles, string[] Descriptions);

        public static readonly Spec[] Specs =
        {
            new(AssetDomainType.Room, ListingType.Rent, 30,
                new[] { "bt-xvnt", "gv-quangtrung", "tb-hvt", "btan-tenlua", "td-linhtrung", "q10-3thang2", "q12-tth", "bt-dbp", "bd-phuhoa", "bd-hiepthanh", "hn-caugiay", "hn-bachkhoa", "pn-pxl", "dn-haichau" },
                "room", (16, 35),
                new[] { "Phòng trọ {area}m² {hl}, {d}", "Cho thuê phòng {area}m² có gác lửng, {d}", "Phòng mới xây {area}m², {near0}", "Phòng trọ sạch đẹp {area}m², giờ giấc tự do, {d}" },
                new[]
                {
                    "Phòng {area}m² trong hẻm {street}, {d}. {hlSentence} Khu vực {near}. Phòng có cửa sổ thoáng, toilet riêng, chỗ để xe máy miễn phí.",
                    "Cho thuê phòng {area}m² mới sơn sửa, {hlSentence} Vị trí: đường {street}, {near}. Phù hợp sinh viên và người đi làm, chủ nhà dễ tính.",
                    "Phòng trọ {area}m² {hlSentence} Ra đầu hẻm là tiệm tạp hoá, quán cơm. {near}. Điện nước theo giá nhà nước, có camera an ninh.",
                }),
            new(AssetDomainType.Apartment, ListingType.Rent, 12,
                new[] { "q7-pmh", "td-thaodien", "td-anphu", "q4-hoangdieu", "hn-mydinh", "dn-sontra", "q1-tandinh", "bt-dbp" },
                "apartment", (45, 110),
                new[] { "Cho thuê căn hộ {bed}PN {area}m² {hl}, {d}", "Căn hộ {bed} phòng ngủ full nội thất, {d}", "Căn hộ {area}m² có ban công, view thoáng — {d}" },
                new[]
                {
                    "Căn hộ {area}m², {bed} phòng ngủ, {bath} WC tại {street}, {d}. {hlSentence} Toà nhà có hồ bơi, phòng gym, bảo vệ 24/7. Khu vực {near}.",
                    "Cho thuê căn hộ {bed}PN đã có nội thất, dọn vào ở ngay. {hlSentence} Gần {near}. Hợp đồng tối thiểu 6 tháng, cọc 2 tháng.",
                }),
            new(AssetDomainType.Apartment, ListingType.Sale, 12,
                new[] { "q7-pmh", "td-anphu", "td-thaodien", "q4-hoangdieu", "hn-mydinh", "hn-caugiay", "dn-sontra", "bt-dbp" },
                "apartment", (50, 120),
                new[] { "Bán căn hộ {bed}PN {area}m², {legal}, {d}", "Căn hộ {area}m² tầng cao, view đẹp, {d}", "Bán gấp căn hộ {bed} phòng ngủ {street}, {d}" },
                new[]
                {
                    "Căn hộ {area}m², {bed} phòng ngủ, {bath} WC, pháp lý {legalLower}. {hlSentence} Dự án có hồ bơi, công viên nội khu. Vị trí {street}, {d}: {near}.",
                    "Chính chủ bán căn hộ {bed}PN, nội thất {furnLower}. {hlSentence} Gần {near}. Thanh toán linh hoạt, hỗ trợ vay ngân hàng.",
                }),
            new(AssetDomainType.PrivateHouse, ListingType.Sale, 18,
                new[] { "td-linhtrung", "gv-quangtrung", "tb-hvt", "td-anphu", "pn-pxl", "q3-kydong", "td-linhtrung", "bt-xvnt", "td-thaodien", "q12-tth", "btan-tenlua", "q10-3thang2", "hn-dongda", "hn-caugiay", "dn-haichau", "bd-hiepthanh", "td-anphu", "hn-dongda" },
                "house", (40, 120),
                new[] { "Bán nhà {floors} tầng hẻm xe hơi {street}, {area}m², {d}", "Nhà phố {area}m² {bed}PN, {legal}, {d}", "Bán nhà {street} {area}m² — {hl}" },
                new[]
                {
                    "Nhà {floors} tầng, diện tích đất {area}m², mặt tiền {front}m, {bed} phòng ngủ, {bath} WC. Hướng {dir}, {legalLower}. {hlSentence} Khu dân cư hiện hữu, {near}.",
                    "Bán nhà hẻm xe hơi đường {street}, {d}. Kết cấu {floors} tầng chắc chắn, {bed} phòng ngủ. {hlSentence} Pháp lý {legalLower}, công chứng ngay. Gần {near}.",
                }),
            new(AssetDomainType.PrivateHouse, ListingType.Rent, 6,
                new[] { "pn-pxl", "q3-kydong", "tb-hvt", "bt-dbp", "hn-dongda", "dn-haichau" },
                "house", (50, 100),
                new[] { "Cho thuê nhà nguyên căn {floors} tầng {street}, {d}", "Nhà nguyên căn {bed}PN cho gia đình, {d}" },
                new[]
                {
                    "Cho thuê nhà nguyên căn {floors} tầng, {bed} phòng ngủ, {bath} WC, sân để xe. {hlSentence} Phù hợp gia đình hoặc làm văn phòng nhỏ. Khu vực {near}.",
                }),
            new(AssetDomainType.Land, ListingType.Sale, 10,
                new[] { "td-linhtrung", "q12-tth", "bchanh-tankien", "bd-dian", "bd-hiepthanh", "dn-myan", "bd-thuanan" },
                "land", (60, 300),
                new[] { "Bán đất nền {area}m² mặt tiền {front}m, {legal}, {d}", "Đất thổ cư {area}m² hẻm xe hơi, {d}", "Lô đất {area}m² xây dựng tự do — {d}" },
                new[]
                {
                    "Lô đất {area}m² ({front}m ngang), {legalLower}, thổ cư toàn bộ. Hướng {dir}. {hlSentence} Khu vực {near}, dân cư đông, thích hợp xây ở hoặc đầu tư.",
                    "Bán đất nền đường {street}, {d}. Diện tích {area}m², mặt tiền {front}m, đường trước đất rộng, xe hơi vào tận nơi. Pháp lý {legalLower}. Gần {near}.",
                }),
            new(AssetDomainType.Villa, ListingType.Sale, 4,
                new[] { "td-thaodien", "q7-pmh", "dn-myan", "td-anphu" },
                "villa", (200, 420),
                new[] { "Bán biệt thự sân vườn {area}m², {d}", "Biệt thự {floors} tầng có hồ bơi, {d}" },
                new[]
                {
                    "Biệt thự {area}m² đất, {floors} tầng, {bed} phòng ngủ, sân vườn rộng và hồ bơi riêng. {hlSentence} Khu compound an ninh, {near}. Pháp lý {legalLower}.",
                }),
            new(AssetDomainType.Villa, ListingType.Rent, 2,
                new[] { "td-thaodien", "q7-pmh" },
                "villa", (220, 380),
                new[] { "Cho thuê biệt thự {bed}PN sân vườn, {d}" },
                new[]
                {
                    "Biệt thự {floors} tầng, {bed} phòng ngủ, sân vườn và hồ bơi, nội thất cao cấp. {hlSentence} Thích hợp gia đình chuyên gia nước ngoài. Khu vực {near}.",
                }),
            new(AssetDomainType.Shophouse, ListingType.Sale, 3,
                new[] { "q7-pmh", "td-anphu", "hn-mydinh" },
                "shop", (90, 160),
                new[] { "Bán shophouse mặt tiền {street} {area}m², {d}" },
                new[]
                {
                    "Shophouse {floors} tầng, {area}m² sàn trệt, mặt tiền {front}m đường {street}. Tầng trệt kinh doanh, tầng trên ở hoặc làm văn phòng. {hlSentence} Khu vực {near}.",
                }),
            new(AssetDomainType.Shophouse, ListingType.Rent, 3,
                new[] { "q7-pmh", "hn-mydinh", "dn-haichau" },
                "shop", (90, 150),
                new[] { "Cho thuê shophouse {area}m² mặt tiền {front}m, {d}" },
                new[]
                {
                    "Shophouse {floors} tầng mặt tiền {street}, phù hợp showroom, nhà hàng, văn phòng giao dịch. {hlSentence} Lượng khách qua lại đông, {near}.",
                }),
            new(AssetDomainType.Office, ListingType.Rent, 6,
                new[] { "q3-nkkn", "tb-hvt", "q1-tandinh", "hn-dongda", "dn-haichau", "bd-hiepthanh" },
                "office", (60, 250),
                new[] { "Văn phòng {area}m² {street}, {d}", "Cho thuê sàn văn phòng {area}m² hạng B, {d}" },
                new[]
                {
                    "Sàn văn phòng {area}m², trần cao, nhiều ánh sáng tự nhiên. Toà nhà có thang máy, máy phát điện, bãi đậu xe. {hlSentence} Vị trí {street}, {near}.",
                }),
            new(AssetDomainType.CommercialSpace, ListingType.Rent, 8,
                new[] { "q1-letthanhton", "q3-nkkn", "q10-3thang2", "q5-thd", "hn-hoankiem", "dn-haichau", "pn-pxl", "bd-thuanan" },
                "shop", (40, 200),
                new[] { "Mặt bằng kinh doanh mặt tiền {street} {front}m ngang", "Cho thuê mặt bằng {area}m² {hl}, {d}" },
                new[]
                {
                    "Mặt bằng {area}m², ngang {front}m, mặt tiền đường {street}, {d}. {hlSentence} Phù hợp quán cà phê, cửa hàng thời trang, chuỗi bán lẻ. Khu vực {near}.",
                }),
            new(AssetDomainType.Warehouse, ListingType.Rent, 5,
                new[] { "bchanh-tankien", "bd-dian", "bd-thuanan", "btan-tenlua", "td-linhtrung" },
                "warehouse", (300, 2000),
                new[] { "Cho thuê kho xưởng {area}m², xe container vào được, {d}", "Kho {area}m² có PCCC, {d}" },
                new[]
                {
                    "Kho xưởng {area}m², trần cao 9m, nền chịu tải tốt, hệ thống PCCC đạt chuẩn, xe container ra vào thoải mái. {hlSentence} Vị trí {street}, {near}.",
                }),
            new(AssetDomainType.Warehouse, ListingType.Sale, 2,
                new[] { "bd-dian", "bchanh-tankien" },
                "warehouse", (800, 3000),
                new[] { "Bán nhà xưởng {area}m² đang hoạt động, {d}" },
                new[]
                {
                    "Nhà xưởng {area}m² có văn phòng điều hành, điện 3 pha, giấy phép môi trường đầy đủ. Pháp lý {legalLower}. {hlSentence} Gần {near}.",
                }),
        };

        /// <summary>Điểm nhấn ngẫu nhiên — vừa làm tiêu đề đa dạng, vừa là thứ để trợ lý tìm
        /// nhà xếp hạng theo mong muốn mềm ("yên tĩnh", "ban công"...).</summary>
        public static readonly (string Short, string Sentence)[] Highlights =
        {
            ("yên tĩnh", "Hẻm cụt yên tĩnh, ít xe qua lại, rất hợp làm việc tại nhà."),
            ("có ban công", "Có ban công rộng đón nắng sáng, phơi đồ thoải mái."),
            ("thoáng mát", "Nhiều cửa sổ nên thoáng mát, sáng sủa cả ngày."),
            ("gần chợ", "Đi bộ vài phút là tới chợ và siêu thị."),
            ("mới xây", "Nhà mới xây, mọi thứ còn mới tinh."),
            ("an ninh tốt", "Khu dân cư an ninh, có bảo vệ và camera."),
            ("view sông", "Nhìn ra sông, buổi tối có gió mát."),
            ("hẻm xe hơi", "Hẻm xe hơi tránh nhau được, đậu xe trước nhà."),
            ("gần trường", "Gần trường học các cấp, tiện đưa đón con."),
            ("cho nuôi thú cưng", "Chủ nhà cho nuôi thú cưng nhỏ."),
        };

        // ==================== Toà nhà có mô hình 3D ====================

        /// <param name="Units">Theo tầng: danh sách (tên căn, diện tích). Rỗng = tầng không chia căn.</param>
        /// <param name="SaleShare">Tỉ lệ căn trống đem BÁN (phần còn lại cho thuê).</param>
        public sealed record Building(
            string Key, string Name, string Place, Owner Owner, AssetDomainType Type, int Floors,
            double FloorHeight, double Width, double Depth, double RotateDeg,
            Func<int, (string Name, double Area)[]> Units, double VacantRate, double SaleShare,
            string Images, string Description);

        public static readonly Building[] Buildings =
        {
            new("b-xvnt", "Toà căn hộ dịch vụ Xô Viết Nghệ Tĩnh", "bt-xvnt", Owner.Ngoc, AssetDomainType.Apartment,
                8, 3.3, 26, 16, 18,
                f => f == 1
                    ? new[] { ("Ki-ốt 1", 48.0), ("Ki-ốt 2", 48.0) }
                    : Enumerable.Range(1, 4).Select(k => ($"P.{f}0{k}", k is 1 or 4 ? 38.0 : 30.0)).ToArray(),
                0.33, 0, "apartment",
                "Toà căn hộ dịch vụ 8 tầng, có thang máy, bảo vệ 24/7, giặt sấy chung ở tầng thượng. Gần chợ Bà Chiểu, đi Quận 1 khoảng 10 phút."),
            new("b-ltt", "Toà văn phòng Lê Thánh Tôn", "q1-letthanhton", Owner.Kho, AssetDomainType.Office,
                12, 3.8, 30, 20, -12,
                f => f == 1 ? new[] { ("Sảnh lễ tân", 200.0) }
                    : new[] { ($"Sàn {f}A", 140.0), ($"Sàn {f}B", 110.0) },
                0.3, 0, "office",
                "Toà văn phòng hạng B 12 tầng tại trung tâm Quận 1. Hai thang máy, máy phát điện dự phòng 100%, hầm xe, lễ tân tầng trệt."),
            new("b-caugiay", "Chung cư mini Trần Thái Tông", "hn-caugiay", Owner.Bao, AssetDomainType.Room,
                7, 3.2, 18, 12, 8,
                f => f == 1 ? Array.Empty<(string, double)>()
                    : Enumerable.Range(1, 5).Select(k => ($"P.{f}0{k}", k == 5 ? 35.0 : 26.0)).ToArray(),
                0.3, 0, "room",
                "Chung cư mini 7 tầng, tầng 1 để xe, thang máy, khoá vân tay. Gần Đại học Quốc gia Hà Nội và công viên Cầu Giấy."),
            new("b-tdmu", "Nhà trọ cao tầng Trần Văn Ơn", "bd-phuhoa", Owner.Ha, AssetDomainType.Room,
                5, 3.1, 22, 11, 0,
                f => Enumerable.Range(1, 6).Select(k => ($"P.{f}0{k}", 20.0)).ToArray(),
                0.4, 0, "room",
                "Nhà trọ 5 tầng dành cho sinh viên, cách Đại học Thủ Dầu Một 5 phút đi bộ. Có wifi chung, máy giặt, camera, giờ giấc tự do."),
            new("b-myan", "Toà căn hộ biển Mỹ An", "dn-myan", Owner.Ha, AssetDomainType.Apartment,
                10, 3.2, 24, 18, 25,
                f => f == 1 ? new[] { ("Cửa hàng 1", 80.0), ("Cửa hàng 2", 80.0) }
                    : Enumerable.Range(1, 4).Select(k => ($"Căn {f}.0{k}", k is 1 or 4 ? 72.0 : 56.0)).ToArray(),
                0.4, 0.5, "apartment",
                "Toà căn hộ 10 tầng cách biển Mỹ Khê 300 m, hồ bơi tầng thượng, phù hợp ở hoặc cho thuê du lịch."),
        };

        // ==================== Ảnh ====================

        /// <summary>Ảnh minh hoạ theo nhóm loại hình (Unsplash, đã kiểm tra truy cập được).</summary>
        public static readonly Dictionary<string, string[]> ImagePools = new()
        {
            ["room"] = Ids("photo-1505691938895-1758d7feb511", "photo-1522771739844-6a9f6d5f14af", "photo-1631049307264-da0ec9d70304",
                           "photo-1595526114035-0d45ed16cfbf", "photo-1513694203232-719a280e022f", "photo-1586023492125-27b2c045efd7",
                           "photo-1522708323590-d24dbb6b0267", "photo-1502672260266-1c1ef2d93688"),
            ["apartment"] = Ids("photo-1545324418-cc1a3fa10c00", "photo-1460317442991-0ec209397118", "photo-1502005229762-cf1b2da7c5d6",
                                "photo-1560448204-e02f11c3d0e2", "photo-1484154218962-a197022b5858", "photo-1556909114-f6e7ad7d3136",
                                "photo-1554995207-c18c203602cb", "photo-1493809842364-78817add7ffb", "photo-1618221195710-dd6b41faaea6"),
            ["house"] = Ids("photo-1512917774080-9991f1c4c750", "photo-1570129477492-45c003edd2be", "photo-1564013799919-ab600027ffc6",
                            "photo-1580587771525-78b9dba3b914", "photo-1600047509807-ba8f99d2cdde", "photo-1416331108676-a22ccb276e35",
                            "photo-1449844908441-8829872d2607", "photo-1518780664697-55e3ad937233", "photo-1484101403633-562f891dc89a",
                            "photo-1567496898669-ee935f5f647a"),
            ["villa"] = Ids("photo-1600596542815-ffad4c1539a9", "photo-1613490493576-7fde63acd811", "photo-1600585154340-be6161a56a0c",
                            "photo-1600607687939-ce8a6c25118c", "photo-1600566753190-17f0baa2a6c3", "photo-1567767292278-a4f21aa2d36e"),
            ["land"] = Ids("photo-1500382017468-9049fed747ef", "photo-1628624747186-a941c476b7ef", "photo-1501183638710-841dd1904471",
                           "photo-1430285561322-7808604715df", "photo-1523217582562-09d0def993a6"),
            ["office"] = Ids("photo-1497366216548-37526070297c", "photo-1497366811353-6870744d04b2", "photo-1524758631624-e2822e304c36",
                             "photo-1556761175-b413da4baf72", "photo-1497215728101-856f4ea42174", "photo-1504307651254-35680f356dfd"),
            ["shop"] = Ids("photo-1441986300917-64674bd600d8", "photo-1604719312566-8912e9227c6a", "photo-1599809275671-b5942cabc7a2",
                           "photo-1472851294608-062f824d29cc", "photo-1567401893414-76b7b1e5a7a5", "photo-1595846519845-68e298c2edd8"),
            ["warehouse"] = Ids("photo-1586528116311-ad8dd3c8310d", "photo-1553413077-190dd305871c", "photo-1494526585095-c41746248156",
                                "photo-1536376072261-38c75010e6c9", "photo-1590381105924-c72589b9ef3f"),
        };

        private static string[] Ids(params string[] ids)
            => ids.Select(id => $"https://images.unsplash.com/{id}?w=800").ToArray();

        // ==================== Nhu cầu của người tìm nhà ====================

        /// <summary>Bộ lọc đã lưu của người tìm nhà. <paramref name="Discoverable"/> = cho chủ tin
        /// thấy nhu cầu (ẩn danh) để mời xem nhà — dữ liệu cho tính năng ghép đôi hai chiều.</summary>
        public sealed record Demand(
            string Person, string Name, ListingType Type, string City, string? District,
            decimal? PriceMin, decimal? PriceMax, int? BedroomsMin, AssetDomainType[]? Types,
            bool Has3D, bool Discoverable, string? Note, string[]? Legal = null);

        public static readonly Demand[] Demands =
        {
            new("khoa", "Phòng trọ Bình Thạnh dưới 5 triệu", ListingType.Rent, Hcm, "Quận Bình Thạnh",
                null, 5_000_000, null, new[] { AssetDomainType.Room }, false, true,
                "Đi làm ở Quận 1, cần phòng yên tĩnh, có chỗ để xe máy. Dọn vào đầu tháng sau."),
            new("khoa", "Căn hộ dịch vụ xem được 3D", ListingType.Rent, Hcm, null,
                null, 8_000_000, null, null, true, false, null),
            new("mai", "Nhà 3 phòng ngủ ở Thủ Đức dưới 11 tỷ", ListingType.Sale, Hcm, "Thành phố Thủ Đức",
                3_000_000_000, 11_000_000_000, 3, new[] { AssetDomainType.PrivateHouse }, false, true,
                "Gia đình 4 người, cần nhà có sổ, gần trường tiểu học, hẻm xe hơi càng tốt.",
                new[] { "Sổ hồng riêng", "Sổ hồng chung", "Sổ đỏ" }),
            new("huy", "Phòng gần ĐH Thủ Dầu Một dưới 3 triệu", ListingType.Rent, Bd, "Thành phố Thủ Dầu Một",
                null, 3_000_000, null, new[] { AssetDomainType.Room }, false, true,
                "Sinh viên năm 3, ở một mình, cần wifi ổn định để học online."),
        };
    }
}
