namespace kgs_api.Domain
{
    public class Enums
    {
        // Vòng đời kiểm duyệt của một tin đăng công khai.
        // Closed thay cho Sold cũ (giữ nguyên giá trị 4): tin cho thuê thì "đã có khách",
        // tin bán thì "đã bán" — cùng một trạng thái kết thúc.
        // Draft = 5 chu khong phai 0: dat o cuoi de khong dung cham gia tri da nam trong
        // du lieu. Ban nhap KHONG nam trong partial unique index UX_Listings_OneLivePerSlot
        // (loc Status IN 1,2) nen mot cho co the co nhieu ban nhap cung luc.
        /// <summary>Vòng đời tin đăng.
        ///
        /// ChangesRequested là trạng thái thêm sau: trước đây kiểm duyệt viên chỉ có Duyệt
        /// hoặc Từ chối, nên mọi thiếu sót nhỏ — thiếu ảnh, mô tả sơ sài, gõ nhầm giá — đều
        /// phải xử bằng một hành động mang tính chung thẩm. Chủ tin nhận "bị từ chối" cho
        /// một việc chỉ cần sửa mười giây, và cảm giác đó đủ để họ bỏ đi.
        ///
        /// Khác biệt ngữ nghĩa: Rejected = tin KHÔNG NÊN tồn tại ở dạng này (sai sự thật,
        /// vi phạm). ChangesRequested = tin về cơ bản hợp lệ, còn thiếu chi tiết.
        ///
        /// Cả hai đều quay lại Pending khi chủ tin gửi lại.</summary>
        public enum ListingStatus
        {
            Pending = 1,
            Approved = 2,
            Rejected = 3,
            Closed = 4,
            Draft = 5,
            ChangesRequested = 6,
        }

        /// <summary>Lý do kiểm duyệt viên trả tin về, dạng có cấu trúc.
        ///
        /// Trước đây lý do là một chuỗi tự do. Ba hệ quả: không thống kê được (không biết
        /// người đăng hay sai ở đâu nhất để mà sửa biểu mẫu), không nhất quán giữa các
        /// kiểm duyệt viên, và chủ tin nhận về những câu viết vội mỗi lần một kiểu.
        ///
        /// Dự án đã có tiền lệ đúng ở ListingReportReason — đây là bản tương ứng cho phía
        /// kiểm duyệt. Vẫn giữ ô ghi chú tự do đi kèm, vì danh sách cố định không bao giờ
        /// phủ hết mọi trường hợp.</summary>
        public enum ModerationReason
        {
            /// <summary>Không có ảnh, hoặc ảnh không phải của bất động sản đang rao.</summary>
            MissingOrBadPhotos = 1,
            /// <summary>Mô tả quá sơ sài, không nêu được không gian và khu vực.</summary>
            ThinDescription = 2,
            /// <summary>Giá lệch xa mặt bằng, hoặc thiếu các khoản chi phí bắt buộc khai.</summary>
            PriceOrCostIssue = 3,
            /// <summary>Địa chỉ thiếu hoặc không khớp khu vực đã chọn.</summary>
            AddressIssue = 4,
            /// <summary>Thiếu điều kiện thuê: cọc, điện nước, nội quy.</summary>
            MissingTerms = 5,
            /// <summary>Trùng với tin đang có của chính người đăng.</summary>
            Duplicate = 6,
            /// <summary>Nội dung sai sự thật, có dấu hiệu lừa đảo, hoặc vi phạm quy định.</summary>
            ProhibitedContent = 7,
            /// <summary>Lý do khác — bắt buộc kèm ghi chú.</summary>
            Other = 99,
        }

        /// <summary>Hành động của kiểm duyệt viên, ghi vào lịch sử.</summary>
        public enum ModerationAction
        {
            Submitted = 1,
            Approved = 2,
            ChangesRequested = 3,
            Rejected = 4,
        }

        public enum AssetDomainType { PrivateHouse = 1, Apartment = 2, Land = 3, Villa = 4, Shophouse = 5, Office = 6, Other = 99 }

        public enum AssetOwnershipType { Owned = 1, Leasehold = 2 }        // Sở hữu / Đi thuê

        public enum AssetStatus { InUse = 1, RentedOut = 2, ForSale = 3, Vacant = 4, Sold = 5, LeaseEnded = 6 }


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

        public enum RecurrenceCycle { None = 0, Monthly = 1, Quarterly = 2, SemiAnnually = 3, Annually = 4}

        public enum ContactType { Tenant = 1, Landlord = 2, Broker = 3, Vendor = 4, Other = 99 }

        // Vòng đời một yêu cầu xem nhà gửi từ marketplace.
        // Converted = đã sinh ContactParty, sẵn sàng ký hợp đồng — đây là trạng thái
        // duy nhất chứng minh hệ thống kết nối thành công chủ nhà với người thuê.
        public enum InquiryStatus { New = 1, Contacted = 2, Viewed = 3, Converted = 4, Closed = 5 }


        // Domain/Enums.cs — MỞ FILE ĐÃ CÓ, thêm dòng này vào bên trong class Enums hiện tại,
        // cạnh các enum khác (AssetType, ContractStatus...)
        public enum ListingType { Sale = 1, Rent = 2 }

        // Hai cách tính tiền nước phổ biến ở nhà trọ Việt Nam. Người thuê so sánh rất khác
        // nhau giữa hai cách nên không gộp thành một con số được.
        public enum WaterPricingMode { PerCubicMeter = 1, PerPerson = 2 }

        // Cach sap xep ket qua tim kiem cong khai. Nearest chi co nghia khi truy van kem
        // toa do — khong co toa do thi service tu lui ve Newest thay vi tra thu tu ngau nhien.
        public enum ListingSort { Newest = 1, PriceAsc = 2, PriceDesc = 3, AreaDesc = 4, Nearest = 5 }

        /// <summary>Lý do báo vi phạm một tin đăng.
        ///
        /// Danh sách cố ý ngắn và cụ thể. Ô "mô tả thêm" tự do thì ai cũng viết một câu
        /// khác nhau, và người kiểm duyệt phải đọc từng cái mới biết nên xử lý ra sao;
        /// phân loại sẵn cho phép xếp hàng đợi theo mức nghiêm trọng.</summary>
        public enum ListingReportReason
        {
            /// <summary>Đăng trùng, đăng lại liên tục, nội dung rác.</summary>
            Spam = 1,
            /// <summary>Sai giá, sai diện tích, sai địa chỉ so với thực tế.</summary>
            WrongInfo = 2,
            /// <summary>Đã cho thuê/bán rồi mà tin vẫn hiển thị.</summary>
            AlreadyTaken = 3,
            /// <summary>Có dấu hiệu lừa đảo — đòi cọc trước khi xem nhà, ảnh lấy từ nơi khác.</summary>
            Scam = 4,
            /// <summary>Nội dung không phù hợp.</summary>
            Inappropriate = 5,
            Other = 6
        }

        public enum ListingReportStatus
        {
            Pending = 1,
            /// <summary>Đã xác nhận có vi phạm và đã xử lý tin đăng.</summary>
            Resolved = 2,
            /// <summary>Đã xem và kết luận tin không vi phạm.</summary>
            Dismissed = 3
        }
    }
}
