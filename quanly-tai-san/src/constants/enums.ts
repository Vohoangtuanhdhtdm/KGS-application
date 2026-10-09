// Bảng mã enum dùng chung — backend trả số, UI hiển thị chữ.

export const ASSET_TYPE = {
  1: "Nhà riêng",
  2: "Căn hộ",
  3: "Đất",
  4: "Biệt thự",
  5: "Nhà mặt phố",
  6: "Văn phòng",
  7: "Phòng trọ",
  8: "Mặt bằng kinh doanh",
  9: "Kho, nhà xưởng",
  99: "Khác",
} as const;
export type AssetTypeCode = keyof typeof ASSET_TYPE;

/**
 * Loại hình nào có ý nghĩa với trường nào — để biểu mẫu và bộ lọc chỉ hỏi những gì đáng hỏi.
 * Đất không có phòng ngủ; phòng trọ không có mặt tiền hay sổ hồng riêng; kho xưởng không có
 * nội thất. Hỏi thừa làm biểu mẫu dài vô ích, lọc thừa thì loại oan những tin bỏ trống trường
 * vốn không áp dụng cho chúng.
 */
export const TYPE_FIELDS: Record<
  AssetTypeCode,
  {
    rooms: boolean;
    floors: boolean;
    frontage: boolean;
    direction: boolean;
    legal: boolean;
    furniture: boolean;
  }
> = {
  1: { rooms: true, floors: true, frontage: true, direction: true, legal: true, furniture: true },
  2: { rooms: true, floors: false, frontage: false, direction: true, legal: true, furniture: true },
  3: {
    rooms: false,
    floors: false,
    frontage: true,
    direction: true,
    legal: true,
    furniture: false,
  },
  4: { rooms: true, floors: true, frontage: true, direction: true, legal: true, furniture: true },
  5: { rooms: true, floors: true, frontage: true, direction: true, legal: true, furniture: true },
  6: { rooms: false, floors: true, frontage: false, direction: true, legal: true, furniture: true },
  7: {
    rooms: false,
    floors: false,
    frontage: false,
    direction: false,
    legal: false,
    furniture: true,
  },
  8: { rooms: false, floors: true, frontage: true, direction: true, legal: true, furniture: false },
  9: {
    rooms: false,
    floors: false,
    frontage: true,
    direction: false,
    legal: true,
    furniture: false,
  },
  99: { rooms: true, floors: true, frontage: true, direction: true, legal: true, furniture: true },
};

export const UNIT_STATUS = { 1: "Trống", 2: "Đang cho thuê", 3: "Đang sửa chữa" } as const;
export type UnitStatusCode = keyof typeof UNIT_STATUS;

export const PAYMENT_CYCLE = {
  1: "Hàng tháng",
  2: "Hàng quý",
  3: "Nửa năm",
  4: "Hàng năm",
} as const;
export type PaymentCycleCode = keyof typeof PAYMENT_CYCLE;

// ---- Marketplace: tin đăng công khai ----

export const LISTING_TYPE = { 1: "Bán", 2: "Cho thuê" } as const;
export type ListingTypeCode = keyof typeof LISTING_TYPE;

export const LISTING_STATUS = {
  1: "Chờ duyệt",
  2: "Đang hiển thị",
  3: "Bị từ chối",
  4: "Đã đóng",
  5: "Bản nháp",
  6: "Cần chỉnh sửa",
} as const;

/**
 * Lý do kiểm duyệt viên trả tin về, khớp enum ModerationReason ở backend.
 *
 * Dạng có cấu trúc thay cho chuỗi tự do: thống kê được người đăng hay sai ở đâu nhất (để
 * còn sửa chính biểu mẫu đăng tin), và chủ tin nhận về cùng một cách diễn đạt dù ai duyệt.
 */
export const MODERATION_REASON = {
  1: "Ảnh thiếu hoặc không đúng",
  2: "Mô tả quá sơ sài",
  3: "Giá hoặc chi phí chưa hợp lý",
  4: "Địa chỉ thiếu hoặc sai khu vực",
  5: "Thiếu điều kiện thuê",
  6: "Trùng tin đã có",
  7: "Nội dung vi phạm",
  99: "Lý do khác",
} as const;
export type ModerationReasonCode = keyof typeof MODERATION_REASON;

/** Hành động trong lịch sử kiểm duyệt, khớp enum ModerationAction ở backend. */
export const MODERATION_ACTION = {
  1: "Chủ tin gửi duyệt",
  2: "Đã duyệt",
  3: "Yêu cầu chỉnh sửa",
  4: "Bị từ chối",
  5: "Bị gỡ do báo vi phạm",
  6: "Đóng do báo đã cho thuê/bán",
} as const;
export type ModerationActionCode = keyof typeof MODERATION_ACTION;

/** Cách xử lý tin khi xác nhận báo vi phạm — khớp enum ReportAction ở backend. */
export const REPORT_ACTION = {
  1: {
    label: "Gỡ tin",
    hint: 'Tin chuyển về "Bị từ chối", biến khỏi trang tìm kiếm. Hợp với lừa đảo, tin rác.',
  },
  2: {
    label: "Yêu cầu chủ tin sửa",
    hint: 'Tin tạm ẩn ở trạng thái "Cần chỉnh sửa" cho tới khi chủ tin sửa và gửi duyệt lại.',
  },
  3: {
    label: "Đóng tin (đã cho thuê/bán)",
    hint: 'Tin chuyển về "Đã đóng". Chủ tin mở lại được khi bất động sản trống lại.',
  },
} as const;
export type ReportActionCode = keyof typeof REPORT_ACTION;
export type ListingStatusCode = keyof typeof LISTING_STATUS;

export const LISTING_STATUS_CLASS: Record<ListingStatusCode, string> = {
  1: "bg-muted text-muted-foreground border-border",
  2: "bg-success/15 text-success border-success/30",
  3: "bg-destructive/15 text-destructive border-destructive/30",
  4: "bg-secondary text-secondary-foreground border-border",
  // text-warning, không phải warning-foreground: foreground đó dành cho nền warning ĐẶC
  // (gần trắng ở theme sáng), đặt lên nền warning/20 nhạt thì gần như không đọc được.
  5: "bg-warning/20 text-warning border-warning/40",
  // Cần chỉnh sửa dùng tông hổ phách như "cần chú ý" — KHÔNG dùng tông đỏ của Bị từ chối.
  // Đó là điểm khác biệt của cả tính năng: một lời nhắc việc, không phải một phán quyết.
  6: "bg-warning/20 text-warning border-warning/40",
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
  "Sổ đỏ",
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

// ---- Điều kiện thuê & tiện nghi (tin đăng) ----

export const WATER_PRICING = {
  1: "Theo khối (m³)",
  2: "Theo đầu người",
} as const;
export type WaterPricingCode = keyof typeof WATER_PRICING;

/**
 * Danh mục tiện nghi. Khoá phải trùng KHÍT với AmenityKeys phía backend — backend loại
 * im lặng mọi khoá lạ, nên gõ sai ở đây sẽ khiến tiện nghi biến mất mà không báo lỗi.
 */
export const AMENITIES = {
  air_conditioner: "Máy lạnh",
  water_heater: "Nóng lạnh",
  private_bathroom: "WC riêng",
  private_kitchen: "Bếp riêng",
  loft: "Gác lửng",
  balcony: "Ban công",
  window: "Cửa sổ thoáng",
  wifi: "Wifi",
  parking: "Chỗ để xe",
  elevator: "Thang máy",
  security: "Bảo vệ / camera",
  furnished: "Nội thất đầy đủ",
  washing_machine: "Máy giặt",
  fridge: "Tủ lạnh",
} as const;
export type AmenityKey = keyof typeof AMENITIES;

export const AMENITY_LIST = Object.entries(AMENITIES) as [AmenityKey, string][];
