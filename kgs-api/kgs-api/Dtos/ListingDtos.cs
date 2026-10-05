using System.ComponentModel.DataAnnotations;
using static kgs_api.Domain.Enums;

namespace kgs_api.Dtos
{
    /// <summary>Tạo tin đăng từ một tài sản.
    ///
    /// Sau khi gộp Property vào Asset, request này KHÔNG còn nhận các trường mô tả vật lý
    /// (số tầng, phòng ngủ, hướng nhà, pháp lý, nội thất, mặt tiền). Chúng thuộc về tài sản,
    /// sửa ở màn hình tài sản — tin đăng luôn đọc giá trị mới nhất. Trước đây chúng được
    /// sao chép sang Property lúc đăng tin rồi đóng băng ở đó, nên sửa tài sản không làm
    /// tin đăng đổi theo.</summary>
    public sealed record CreateListingRequest(
        ListingType Type,
        /// <summary>null = đăng nguyên căn; có giá trị = đăng riêng một tầng/phòng.</summary>
        Guid? AssetUnitId,
        [Required, MaxLength(200)] string Title,
        [Required] string Description,
        [Range(0.01, (double)decimal.MaxValue)] decimal Price,
        PaymentCycle? RentPaymentCycle,
        List<Guid> SelectedAssetMediaIds,
        ListingTermsDto? Terms,
        List<string>? Amenities);

    /// <summary>Điều kiện thuê. Mọi trường nullable — null nghĩa là chủ tin CHƯA KHAI,
    /// khác hẳn với false (đã khai là không). Bộ lọc chỉ khớp khi khai tường minh.</summary>
    public sealed record ListingTermsDto(
        [Range(0, 12)] int? DepositMonths,
        decimal? ElectricityPrice,
        decimal? WaterPrice,
        WaterPricingMode? WaterPricing,
        decimal? ServiceFee,
        decimal? ParkingFee,
        decimal? InternetFee,
        [Range(1, 60)] int? MinLeaseMonths,
        DateTime? AvailableFrom,
        [Range(1, 20)] int? MaxOccupants,
        bool? PetsAllowed,
        bool? CurfewFree,
        bool? SharedWithOwner,
        bool? CookingAllowed);

    public sealed record UpdateListingRequest(
        [Required, MaxLength(200)] string Title,
        [Required] string Description,
        [Range(0.01, (double)decimal.MaxValue)] decimal Price,
        PaymentCycle? RentPaymentCycle,
        ListingTermsDto? Terms,
        List<string>? Amenities,

        // ---- Trường vật lý của tài sản ----
        // Chỉ được áp dụng khi tài sản CHỈ có đúng tin này. Nếu tài sản còn tin khác,
        // sửa ở đây sẽ đổi luôn nội dung của chúng — service bỏ qua và không báo lỗi,
        // vì biểu mẫu đã khoá phần này lại rồi (xem EditListingDto.CanEditPropertyFields).
        [MaxLength(100)] string? City = null,
        [MaxLength(100)] string? District = null,
        [MaxLength(100)] string? Ward = null,
        [MaxLength(500)] string? AddressDetail = null,
        AssetDomainType? PropertyType = null,
        [Range(0, double.MaxValue)] double? Area = null,
        [Range(0, 1000)] double? Frontage = null,
        [Range(0, 100)] int? Bedrooms = null,
        [Range(0, 100)] int? Bathrooms = null,
        [Range(0, 200)] int? Floors = null,
        [MaxLength(50)] string? HouseDirection = null,
        [MaxLength(100)] string? LegalStatus = null,
        [MaxLength(100)] string? FurnitureState = null,
        // Ghim vị trí do người đăng tự đặt trên bản đồ. Gửi đủ cả hai thì đặt/di chuyển ghim;
        // không gửi thì giữ nguyên. Cùng luật khoá với các trường vật lý ở trên.
        [Range(-90, 90)] double? Latitude = null,
        [Range(-180, 180)] double? Longitude = null);

    /// <summary>Đăng tin TRỰC TIẾP — không cần tạo tài sản trước.
    ///
    /// Đây là luồng chính của nền tảng môi giới. Luồng cũ qua
    /// <c>POST /api/assets/{id}/listings</c> vẫn giữ cho Giai đoạn 4, khi người dùng đã có
    /// sẵn danh mục tài sản và muốn đăng tin cho một phòng cụ thể.
    ///
    /// Asset được tạo NGẦM từ chính dữ liệu của tin. Người đăng không bao giờ nhìn thấy
    /// khái niệm "tài sản" — họ chỉ đang đăng một tin.</summary>
    public sealed record CreateListingDirectRequest(
        // ---- Nội dung tin ----
        ListingType Type,
        [Required, MaxLength(200)] string Title,
        [Required] string Description,
        [Range(0.01, (double)decimal.MaxValue)] decimal Price,
        PaymentCycle? RentPaymentCycle,

        // ---- Bất động sản: dùng để tạo Asset ngầm ----
        [Required, MaxLength(100)] string City,
        [Required, MaxLength(100)] string District,
        [Required, MaxLength(100)] string Ward,
        [MaxLength(500)] string? AddressDetail,
        [Range(-90, 90)] double? Latitude,
        [Range(-180, 180)] double? Longitude,
        AssetDomainType PropertyType,
        [Range(0, double.MaxValue)] double? Area,
        [Range(0, 1000)] double? Frontage,
        [Range(0, 100)] int? Bedrooms,
        [Range(0, 100)] int? Bathrooms,
        [Range(0, 200)] int? Floors,
        [MaxLength(50)] string? HouseDirection,
        [MaxLength(100)] string? LegalStatus,
        [MaxLength(100)] string? FurnitureState,

        // ---- Điều kiện thuê ----
        ListingTermsDto? Terms,
        List<string>? Amenities,

        // ---- Đăng cho MỘT CĂN trong toà nhà của mình (xem OwnerBuildingService) ----
        /// <summary>Toà nhà có sẵn — khi có, địa chỉ và đặc điểm toà nhà lấy từ đây, không tạo
        /// tài sản mới.</summary>
        Guid? AssetId = null,
        /// <summary>Căn trong toà nhà đó. Tin gắn vào căn thì hiện đúng chỗ trên mô hình 3D.</summary>
        Guid? AssetUnitId = null);

    public sealed record ListingImageDto(Guid Id, string Url, int SortOrder);

    /// <summary>Dữ liệu nạp lại vào biểu mẫu đăng tin. Dùng cho cả soạn tiếp bản nháp lẫn
    /// sửa tin đã đăng, nên gộp luôn cả trường của tin và trường vật lý của tài sản.</summary>
    public sealed record EditListingDto(
        Guid Id,
        ListingStatus Status,
        ListingType Type,
        string Title,
        string Description,
        decimal Price,
        PaymentCycle? RentPaymentCycle,

        string City, string District, string Ward, string AddressDetail,
        AssetDomainType PropertyType,
        double? Area, double? Frontage,
        int? Bedrooms, int? Bathrooms, int? Floors,
        string? HouseDirection, string? LegalStatus, string? FurnitureState,

        ListingTermsDto Terms,
        IReadOnlyList<string> Amenities,
        IReadOnlyList<ListingImageDto> Images,

        /// <summary>false khi tài sản còn tin đăng khác — sửa địa chỉ hay diện tích lúc đó
        /// sẽ đổi luôn cả các tin kia, nên biểu mẫu phải khoá phần đó lại.</summary>
        bool CanEditPropertyFields,
        string? ModerationNote,

        /// <summary>Ghim vị trí hiện tại của tài sản, null nếu chưa ghim.</summary>
        double? Latitude,
        double? Longitude,

        /// <summary>Tin của một căn trong toà nhà: tên toà nhà và tên căn để biểu mẫu hiện rõ
        /// "Căn P.502 · 127 Trần Thái Tông" và khoá phần địa chỉ.</summary>
        Guid AssetId = default,
        Guid? AssetUnitId = null,
        string? AssetName = null,
        string? UnitName = null);

    public sealed record PublicListingSearchQuery(
        ListingType? Type,
        string? City,
        string? District,
        decimal? PriceMin,
        decimal? PriceMax,
        int? BedroomsMin,
        string? Keyword,
        double? Latitude,
        double? Longitude,
        double? RadiusMeters,

        // ---- Bộ lọc điều kiện thuê ----
        // Đây chính là các hard filter mà AI Agent sinh ra ở Bước 1 rồi truyền thẳng vào đây.
        // Xây sẵn ở tầng search để agent không phải dựng đường truy vấn riêng.

        /// <summary>Trần TỔNG chi phí cố định hàng tháng = giá thuê + phí dịch vụ + gửi xe +
        /// internet. Điện nước tính theo mức dùng nên không cộng được vào đây.
        /// Người thuê so sánh tổng chi phí, không so giá thuê trần trụi.</summary>
        decimal? TotalCostMax,
        bool? PetsAllowed,
        bool? CurfewFree,
        bool? SharedWithOwner,
        /// <summary>Chỉ lấy tin dọn vào được trước ngày này.</summary>
        DateTime? AvailableBy,
        /// <summary>Tin phải có ĐỦ mọi tiện nghi trong danh sách (phép AND).</summary>
        List<string>? Amenities,

        /// <summary>Bo trong = Nearest khi co toa do, nguoc lai Newest.</summary>
        ListingSort? SortBy,

        int Page = 1,
        int PageSize = 20,

        /// <summary>Vùng "đi tới được trong X phút" (Mapbox Isochrone), dạng
        /// <c>lng,lat;lng,lat;...</c>. Gửi kèm Latitude/Longitude/RadiusMeters là vòng tròn
        /// bao ngoài vùng: vòng tròn đi qua GiST index để loại nhanh, đa giác lọc chính xác,
        /// và tâm vẫn dùng để sắp "gần nhất". Không bao giờ được lưu (xem TravelArea).</summary>
        [MaxLength(8000)] string? Within = null,

        // ---- Đặc điểm bất động sản — phủ MỌI loại hình, cả bán lẫn thuê ----
        // Trước đây bộ lọc chỉ có các điều kiện của thuê phòng (tổng chi phí, nội quy...);
        // người mua không lọc được loại hình, diện tích, pháp lý hay hướng — dù dữ liệu đã
        // nằm sẵn trong Asset. Thêm vào CUỐI và đều có mặc định null, nên bộ lọc đã lưu cũ
        // (jsonb) vẫn đọc được nguyên vẹn.

        /// <summary>Loại hình — khớp BẤT KỲ loại nào trong danh sách (phép OR).</summary>
        List<AssetDomainType>? PropertyTypes = null,
        /// <summary>Diện tích (m²) — của căn/phòng nếu tin đăng riêng một căn, ngược lại của cả tài sản.</summary>
        [Range(0, double.MaxValue)] double? AreaMin = null,
        [Range(0, double.MaxValue)] double? AreaMax = null,
        [Range(0, 100)] int? BathroomsMin = null,
        [Range(0, 200)] int? FloorsMin = null,
        /// <summary>Mặt tiền tối thiểu (m) — quan trọng với nhà phố, mặt bằng kinh doanh, đất.</summary>
        [Range(0, 1000)] double? FrontageMin = null,
        /// <summary>Hướng nhà — khớp bất kỳ hướng nào trong danh sách. Giá trị theo PropertyVocabulary.</summary>
        List<string>? Directions = null,
        /// <summary>Pháp lý — khớp bất kỳ. "Có sổ" = [Sổ hồng riêng, Sổ hồng chung, Sổ đỏ].</summary>
        List<string>? LegalStatuses = null,
        List<string>? FurnitureStates = null,

        /// <summary>Mong muốn MỀM, phân cách bằng dấu chấm phẩy ("yên tĩnh; ban công"). Chỉ
        /// ảnh hưởng thứ tự (ListingSort.Relevance), không bao giờ loại tin. Xem SoftPreferences.</summary>
        [MaxLength(400)] string? Prefer = null,

        /// <summary>Chỉ tin thuộc toà nhà đã có mô hình 3D công khai (xem BuildingModelService).</summary>
        bool? Has3D = null);

    public sealed record PublicListingSummaryDto(
        Guid Id, string Slug, string Title, ListingType Type, decimal Price,
        PaymentCycle? RentPaymentCycle, string City, string District,
        int? Bedrooms, int? Bathrooms, double? Area, string? ThumbnailUrl,
        double? Latitude, double? Longitude, double? DistanceMeters,
        /// <summary>Tên phòng khi tin đăng cho một phòng cụ thể, null khi đăng nguyên căn.</summary>
        string? UnitName,
        DateTime? PublishedAt,
        /// <summary>Tổng chi phí cố định hàng tháng — số người thuê thực sự so sánh.</summary>
        decimal TotalMonthlyCost,
        int? DepositMonths,
        bool? PetsAllowed,
        IReadOnlyList<string> Amenities)
    {
        /// <summary>Những mong muốn mềm (Prefer) mà tin này thật sự nhắc tới trong tiêu đề/mô
        /// tả — để giao diện giải thích "vì sao hợp". Null khi không tìm theo mong muốn.</summary>
        public IReadOnlyList<string>? MatchedPreferences { get; init; }

        /// <summary>Toà nhà của tin có mô hình 3D công khai — thẻ tin hiện nhãn "3D".</summary>
        public bool HasBuildingModel { get; init; }

        /// <summary>Tối đa 5 ảnh đầu — thẻ tin cho lướt xem ảnh ngay trong danh sách.</summary>
        public IReadOnlyList<string> ImageUrls { get; init; } = Array.Empty<string>();
        /// <summary>Tổng số ảnh của tin (để ghi "1/12" khi chỉ gửi 5 ảnh đầu).</summary>
        public int ImageCount { get; init; }
        public AssetDomainType AssetType { get; init; }
    }

    public sealed record PublicListingDetailDto(
        Guid Id, string Slug, string Title, string Description, ListingType Type,
        decimal Price, PaymentCycle? RentPaymentCycle,
        string City, string District, string Ward, string AddressDetail,
        double? Area, double? Frontage, int? Floors, int? Bedrooms, int? Bathrooms,
        string? HouseDirection, string? LegalStatus, string? FurnitureState,
        AssetDomainType AssetType, string AssetTypeLabel, string? UnitName,
        double? Latitude, double? Longitude,
        IReadOnlyList<string> ImageUrls, int ViewCount, DateTime? PublishedAt,
        ListingTermsDto Terms, IReadOnlyList<string> Amenities, decimal TotalMonthlyCost,

        // ---- Hồ sơ người đăng (nhiệm vụ 1.7) ----
        // Người tìm nhà quyết định có gọi hay không dựa trên việc họ tin ai đang ở đầu dây
        // bên kia. Một cái tên trần trụi không nói được gì; "tham gia 8 tháng trước, đang có
        // 5 tin" thì nói được — và nó cũng làm tài khoản mở hôm qua để đăng tin ma trở nên
        // dễ nhận ra.
        string OwnerName,
        // null = người đăng chưa có số điện thoại. Phải là null, KHÔNG phải một câu như
        // "Chưa cập nhật số điện thoại": giao diện dựng href="tel:{giá trị}" từ trường này,
        // nên một câu tiếng Việt ở đây sinh ra nút "Gọi" bấm vào không gọi được ai.
        string? OwnerPhone,
        string? OwnerAvatarUrl,
        DateTime OwnerJoinedAt,
        int OwnerActiveListingCount)
    {
        /// <summary>Để trang tin dẫn tới hồ sơ công khai của người đăng (/nguoi-dang/{id}).</summary>
        public string? OwnerId { get; init; }

        /// <summary>Phản hồi yêu cầu xem nhà của người đăng trong 180 ngày — tín hiệu tin cậy
        /// ngay trên thẻ liên hệ (xem thêm OwnerProfileDto).</summary>
        public int OwnerInquiriesReceived { get; init; }
        public int OwnerInquiriesAnswered { get; init; }
        public double? OwnerMedianResponseHours { get; init; }
    }

    /// <summary>Hồ sơ công khai của người đăng — để người tìm nhà quyết định có liên hệ hay không.
    ///
    /// Chỉ những gì hệ thống THẬT SỰ kiểm chứng được: email đã xác thực, có số điện thoại,
    /// tham gia bao lâu, đã đăng bao nhiêu tin, trả lời yêu cầu xem nhà thế nào. KHÔNG có dấu
    /// "đã xác minh danh tính" — hệ thống không kiểm tra giấy tờ, ghi như vậy là nói sai.
    /// Không lộ email.</summary>
    public sealed record OwnerProfileDto(
        string Id,
        string Name,
        string? AvatarUrl,
        string? Bio,
        DateTime JoinedAt,
        bool EmailVerified,
        bool HasPhone,
        int ActiveListingCount,
        /// <summary>Số tin từng được duyệt lên trang (đang hiển thị + đã đóng).</summary>
        int PublishedListingCount,
        /// <summary>Yêu cầu xem nhà nhận được trong 180 ngày gần đây.</summary>
        int InquiriesReceived,
        /// <summary>Số yêu cầu đã được phản hồi (không còn ở trạng thái "Mới").</summary>
        int InquiriesAnswered,
        /// <summary>Thời gian phản hồi trung vị (giờ); null khi chưa đủ dữ liệu.</summary>
        double? MedianResponseHours,
        IReadOnlyList<PublicListingSummaryDto> Listings);

    /// <summary>Một khu vực đang có tin đăng, dùng cho ô gợi ý tìm khu vực.
    ///
    /// <paramref name="Count"/> có mặt để xếp khu vực nhiều tin lên trước và để hiện ngay
    /// cho người dùng biết chọn vào đó thì có bao nhiêu tin — thứ mà một danh mục hành
    /// chính thuần tuý không nói được.</summary>
    /// <summary>Một dòng trong lịch sử kiểm duyệt của tin.
    ///
    /// KHÔNG có tên kiểm duyệt viên: chủ tin cần biết tin của mình đã qua những gì và phải
    /// sửa gì, không cần biết ai đã bấm nút. Xem chú thích ở ListingModerationEvent.</summary>
    public sealed record ModerationEventDto(
        ModerationAction Action,
        IReadOnlyList<ModerationReason> Reasons,
        string? Note,
        int Round,
        DateTime CreatedAt);

    public sealed record ListingAreaDto(string City, string District, int Count);

    /// <summary>Hai dải tin gợi ý dưới trang chi tiết, gộp trong một lần gọi.
    ///
    /// Tách thành hai endpoint thì trang chi tiết phải chờ hai vòng mạng cho phần nằm dưới
    /// màn hình đầu — không đáng, vì cả hai đều truy vấn từ chính tin đang xem.</summary>
    public sealed record RelatedListingsDto(
        /// <summary>Tin cùng khu vực, cùng loại, giá xấp xỉ.</summary>
        IReadOnlyList<PublicListingSummaryDto> Similar,
        /// <summary>Tin khác của cùng người đăng.</summary>
        IReadOnlyList<PublicListingSummaryDto> FromOwner);

    public sealed record CreateListingReportRequest(
        ListingReportReason Reason,
        [MaxLength(1000)] string? Detail);

    public sealed record ListingReportDto(
        Guid Id,
        Guid ListingId,
        string ListingTitle,
        string? ListingSlug,
        ListingStatus ListingStatus,
        ListingReportReason Reason,
        string? Detail,
        ListingReportStatus Status,
        string ReporterName,
        DateTime CreatedAt,
        DateTime? HandledAt,
        string? HandlerNote,
        /// <summary>Tổng số báo cáo đang chờ trên CÙNG tin đăng này. Ba người khác nhau
        /// cùng phản ánh một tin thì đó là tín hiệu mạnh hơn hẳn một người phản ánh ba
        /// lần — mà ràng buộc một-báo-cáo-mỗi-người đã loại trừ khả năng thứ hai.</summary>
        int PendingCountOnListing);

    public sealed record ResolveListingReportRequest(
        /// <summary>true = có vi phạm thật (Resolved); false = tin không sai (Dismissed).</summary>
        bool Confirmed,
        [MaxLength(500)] string? Note,
        /// <summary>Xử lý tin khi Confirmed. Bỏ trống = theo lý do báo (ReportOutcomes.DefaultAction).</summary>
        ReportAction? Action = null);

    /// <summary>Kết quả xử lý báo cáo — để giao diện nói rõ chuyện gì đã xảy ra với tin.</summary>
    public sealed record ResolveListingReportResultDto(
        int ReportsClosed,
        /// <summary>null = tin không đổi (bỏ qua báo cáo, hoặc tin đã không còn hiển thị).</summary>
        ReportAction? AppliedAction,
        ListingStatus ListingStatus);

    public sealed record OwnerListingDto(
        Guid Id, string? Slug, string Title, ListingType Type, ListingStatus Status,
        decimal Price, PaymentCycle? RentPaymentCycle, int ViewCount,
        DateTime CreatedAt, DateTime? PublishedAt,
        Guid AssetId, string AssetName, string? UnitName, string? ModerationNote,
        /// <summary>0–100. Tin càng đầy đủ dữ kiện càng được bộ lọc và AI Agent tìm thấy —
        /// hiển thị con số này là cách tạo động lực thật cho chủ tin, thay vì bắt ép nhập.</summary>
        int CompletenessPercent);
}
