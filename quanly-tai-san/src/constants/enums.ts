// Bảng mã enum dùng chung — backend trả số, UI hiển thị chữ.

export const ASSET_TYPE = {
  1: "Nhà riêng",
  2: "Căn hộ",
  3: "Đất",
  4: "Biệt thự",
  5: "Nhà mặt phố",
  6: "Văn phòng",
  99: "Khác",
} as const;
export type AssetTypeCode = keyof typeof ASSET_TYPE;

export const OWNERSHIP_TYPE = { 1: "Sở hữu", 2: "Đi thuê" } as const;
export type OwnershipTypeCode = keyof typeof OWNERSHIP_TYPE;

export const ASSET_STATUS = {
  1: "Đang sử dụng",
  2: "Đang cho thuê",
  3: "Đang rao bán",
  4: "Trống",
  5: "Đã bán",
  6: "Hết hạn thuê",
} as const;
export type AssetStatusCode = keyof typeof ASSET_STATUS;

// Class Tailwind cho badge trạng thái tài sản
export const ASSET_STATUS_CLASS: Record<AssetStatusCode, string> = {
  1: "bg-info/15 text-info border-info/30",
  2: "bg-success/15 text-success border-success/30",
  3: "bg-warning/20 text-warning-foreground border-warning/40",
  4: "bg-muted text-muted-foreground border-border",
  5: "bg-secondary text-secondary-foreground border-border",
  6: "bg-destructive/15 text-destructive border-destructive/30",
};

export const UNIT_STATUS = { 1: "Trống", 2: "Đang cho thuê", 3: "Đang sửa chữa" } as const;
export type UnitStatusCode = keyof typeof UNIT_STATUS;

export const UNIT_STATUS_CLASS: Record<UnitStatusCode, string> = {
  1: "bg-muted text-muted-foreground border-border",
  2: "bg-success/15 text-success border-success/30",
  3: "bg-warning/20 text-warning-foreground border-warning/40",
};

export const CONTRACT_DIRECTION = { 1: "Cho thuê", 2: "Đi thuê" } as const;
export type ContractDirectionCode = keyof typeof CONTRACT_DIRECTION;

export const CONTRACT_STATUS = {
  1: "Nháp",
  2: "Đang hiệu lực",
  3: "Hết hạn",
  4: "Đã chấm dứt",
  5: "Đã gia hạn",
} as const;
export type ContractStatusCode = keyof typeof CONTRACT_STATUS;

export const CONTRACT_STATUS_CLASS: Record<ContractStatusCode, string> = {
  1: "bg-muted text-muted-foreground border-border",
  2: "bg-success/15 text-success border-success/30",
  3: "bg-warning/20 text-warning-foreground border-warning/40",
  4: "bg-destructive/15 text-destructive border-destructive/30",
  5: "bg-info/15 text-info border-info/30",
};

export const PAYMENT_CYCLE = {
  1: "Hàng tháng",
  2: "Hàng quý",
  3: "Nửa năm",
  4: "Hàng năm",
} as const;
export type PaymentCycleCode = keyof typeof PAYMENT_CYCLE;

export const TAX_RESPONSIBILITY = { 1: "Chủ nhà", 2: "Người thuê" } as const;
export type TaxResponsibilityCode = keyof typeof TAX_RESPONSIBILITY;

export const CONTACT_TYPE = {
  1: "Người thuê",
  2: "Chủ nhà",
  3: "Môi giới",
  4: "Nhà thầu",
  99: "Khác",
} as const;
export type ContactTypeCode = keyof typeof CONTACT_TYPE;

export const CONTACT_TYPE_CLASS: Record<ContactTypeCode, string> = {
  1: "bg-info/15 text-info border-info/30",
  2: "bg-success/15 text-success border-success/30",
  3: "bg-warning/20 text-warning-foreground border-warning/40",
  4: "bg-secondary text-secondary-foreground border-border",
  99: "bg-muted text-muted-foreground border-border",
};

export const CASH_FLOW_DIRECTION = { 1: "Thu", 2: "Chi" } as const;
export type CashFlowDirectionCode = keyof typeof CASH_FLOW_DIRECTION;

export const CASH_FLOW_CATEGORY = {
  1: "Tiền thuê thu vào",
  2: "Tiền cọc nhận",
  3: "Tiền bán",
  10: "Tiền thuê trả chủ nhà",
  11: "Tiền cọc trả",
  12: "Chi phí sửa chữa",
  13: "Hoá đơn điện",
  14: "Hoá đơn nước",
  15: "Hoá đơn internet",
  16: "Phí quản lý",
  20: "Thuế trước bạ",
  21: "Thuế phi nông nghiệp",
  22: "Thuế môn bài",
  23: "Thuế TNCN",
  24: "Thuế GTGT",
  29: "Thuế khác",
  99: "Khác",
} as const;
export type CashFlowCategoryCode = keyof typeof CASH_FLOW_CATEGORY;

// Lọc dropdown Loại theo Chiều đã chọn — "Khác" (99) chỉ hợp lệ với chiều Chi
export const INCOME_CATEGORIES: CashFlowCategoryCode[] = [1, 2, 3];
export const EXPENSE_CATEGORIES: CashFlowCategoryCode[] = [
  10, 11, 12, 13, 14, 15, 16, 20, 21, 22, 23, 24, 29, 99,
];

// ---- Nhóm D: Vận hành ----

export const REMINDER_TYPE = {
  1: "Thu tiền thuê",
  2: "Đóng tiền thuê",
  3: "Bảo dưỡng",
  4: "Hết hạn hợp đồng",
  5: "Đóng thuế",
  6: "Thanh toán hoá đơn",
} as const;
export type ReminderTypeCode = keyof typeof REMINDER_TYPE;

export const REMINDER_TYPE_CLASS: Record<ReminderTypeCode, string> = {
  1: "bg-success/15 text-success border-success/30",
  2: "bg-destructive/15 text-destructive border-destructive/30",
  3: "bg-info/15 text-info border-info/30",
  4: "bg-warning/20 text-warning-foreground border-warning/40",
  5: "bg-primary/10 text-primary border-primary/30",
  6: "bg-secondary text-secondary-foreground border-border",
};

export const RECURRENCE_CYCLE = {
  0: "Không lặp",
  1: "Hàng tháng",
  2: "Hàng quý",
  3: "Nửa năm",
  4: "Hàng năm",
} as const;
export type RecurrenceCycleCode = keyof typeof RECURRENCE_CYCLE;

export const EQUIPMENT_CONDITION = {
  1: "Mới",
  2: "Tốt",
  3: "Khá",
  4: "Cần sửa",
  5: "Hỏng",
} as const;
export type EquipmentConditionCode = keyof typeof EQUIPMENT_CONDITION;

export const EQUIPMENT_CONDITION_CLASS: Record<EquipmentConditionCode, string> = {
  1: "bg-success/15 text-success border-success/30",
  2: "bg-success/15 text-success border-success/30",
  3: "bg-warning/20 text-warning-foreground border-warning/40",
  4: "bg-warning/20 text-warning-foreground border-warning/40",
  5: "bg-destructive/15 text-destructive border-destructive/30",
};

export const EQUIPMENT_SOURCE = {
  1: "Chủ nhà cung cấp",
  2: "Nhận từ chủ nhà",
  3: "Tự trang bị",
} as const;
export type EquipmentSourceCode = keyof typeof EQUIPMENT_SOURCE;

export const OCCUPANT_TYPE = {
  1: "Bản thân",
  2: "Con cái/người thân",
  3: "Người quen",
  4: "Người thuê",
} as const;
export type OccupantTypeCode = keyof typeof OCCUPANT_TYPE;

export const OCCUPANT_TYPE_CLASS: Record<OccupantTypeCode, string> = {
  1: "bg-primary/10 text-primary border-primary/30",
  2: "bg-info/15 text-info border-info/30",
  3: "bg-secondary text-secondary-foreground border-border",
  4: "bg-success/15 text-success border-success/30",
};

export const SALE_LISTING_STATUS = {
  1: "Đang rao",
  2: "Tạm dừng",
  3: "Đã bán",
  4: "Đã huỷ",
} as const;
export type SaleListingStatusCode = keyof typeof SALE_LISTING_STATUS;

export const SALE_LISTING_STATUS_CLASS: Record<SaleListingStatusCode, string> = {
  1: "bg-success/15 text-success border-success/30",
  2: "bg-warning/20 text-warning-foreground border-warning/40",
  3: "bg-info/15 text-info border-info/30",
  4: "bg-muted text-muted-foreground border-border",
};

export const DOCUMENT_TYPE = {
  1: "Sổ đỏ/sổ hồng",
  2: "HĐ mua bán",
  3: "HĐ thuê",
  4: "Phụ lục HĐ",
  5: "HĐ uỷ quyền",
  6: "HĐ điện",
  7: "HĐ nước",
  8: "Hồ sơ thuế",
  9: "Hoá đơn",
  99: "Khác",
} as const;
export type DocumentTypeCode = keyof typeof DOCUMENT_TYPE;

// ---- Marketplace: tin đăng công khai ----

export const LISTING_TYPE = { 1: "Bán", 2: "Cho thuê" } as const;
export type ListingTypeCode = keyof typeof LISTING_TYPE;

export const PROPERTY_STATUS = {
  1: "Chờ duyệt",
  2: "Đã duyệt",
  3: "Bị từ chối",
  4: "Đã bán",
} as const;
export type PropertyStatusCode = keyof typeof PROPERTY_STATUS;

export const PROPERTY_STATUS_CLASS: Record<PropertyStatusCode, string> = {
  1: "bg-muted text-muted-foreground border-border",
  2: "bg-success/15 text-success border-success/30",
  3: "bg-destructive/15 text-destructive border-destructive/30",
  4: "bg-secondary text-secondary-foreground border-border",
};

// ---- Thông tin mô tả chi tiết của tài sản (dùng lại khi đăng tin công khai) ----

export const HOUSE_DIRECTIONS = [
  "Đông",
  "Tây",
  "Nam",
  "Bắc",
  "Đông Bắc",
  "Đông Nam",
  "Tây Bắc",
  "Tây Nam",
] as const;

// "Khác" → hiện thêm ô nhập tay
export const LEGAL_STATUS_OPTIONS = [
  "Sổ hồng riêng",
  "Sổ hồng chung",
  "Đang chờ sổ",
  "Hợp đồng mua bán",
  "Khác",
] as const;

export const FURNITURE_STATE_OPTIONS = ["Đầy đủ", "Cơ bản", "Không nội thất", "Khác"] as const;

export const OTHER_OPTION = "Khác";

// Helper: chuyển object enum thành mảng { value, label } cho <Select>
export function enumOptions<T extends Record<number, string>>(
  e: T,
): { value: number; label: string }[] {
  return Object.entries(e).map(([k, v]) => ({ value: Number(k), label: v }));
}
