namespace kgs_api.Domain
{
    public class Enums
    {
        public enum PropertyStatus { Pending = 1, Approved = 2, Rejected = 3, Sold = 4 }

        public enum AssetDomainType { PrivateHouse = 1, Apartment = 2, Land = 3, Villa = 4, Shophouse = 5, Office = 6, Other = 99 }

        public enum AssetOwnershipType { Owned = 1, Leasehold = 2 }        // Sở hữu / Đi thuê

        public enum AssetStatus { InUse = 1, RentedOut = 2, ForSale = 3, Vacant = 4, Sold = 5, LeaseEnded = 6 }

        public enum OccupantType { Self = 1, Family = 2, Acquaintance = 3, Tenant = 4 } // đang sử dụng: bản thân/con cái/người quen

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

        public enum EquipmentCondition { New = 1, Good = 2, Fair = 3, NeedRepair = 4, Broken = 5 }
        public enum EquipmentSource { OwnerProvided = 1, FromLandlord = 2, SelfEquipped = 3 } // của chủ / nhận từ chủ nhà / trang bị thêm

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

        public enum SaleListingStatus { Active = 1, Paused = 2, Sold = 3, Cancelled = 4 }

        // Domain/Enums.cs — MỞ FILE ĐÃ CÓ, thêm dòng này vào bên trong class Enums hiện tại,
        // cạnh các enum khác (AssetType, ContractStatus...)
        public enum ListingType { Sale = 1, Rent = 2 }
    }
}
