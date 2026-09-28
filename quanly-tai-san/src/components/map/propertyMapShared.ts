/**
 * Phần dùng chung giữa bản đồ tìm kiếm GL (GlPropertyMap) và bản Leaflet dự phòng
 * (PropertyMap). Tách riêng để bản GL không phải import từ tệp Leaflet — làm vậy sẽ kéo cả
 * thư viện Leaflet vào gói tải của bản GL.
 */
import type { ListingTypeCode, PaymentCycleCode } from "@/constants/enums";
import { formatCurrency } from "@/lib/format";

// Bán = navy (màu primary chủ đạo của app), Cho thuê = xanh (màu success) —
// dùng đúng token ngữ nghĩa hệ thống, không tạo bảng màu riêng cho Marketplace.
export const TYPE_BORDER: Record<ListingTypeCode, string> = {
  1: "var(--color-primary)",
  2: "var(--color-success)",
};

// Lệch quá 500m so với searchCenter mới coi là "đã pan/zoom lệch" — hiện nút "Tìm trong khu vực này"
export const MOVE_THRESHOLD_METERS = 500;

export interface PropertyMapPoint {
  id: string;
  lat: number;
  lng: number;
  price: number;
  type: ListingTypeCode;
  // Cho popup xem nhanh (Phần A) — optional để component vẫn dùng được cho các điểm
  // không cần popup (VD nếu sau này tái dùng cho mục đích khác)
  slug?: string;
  title?: string;
  thumbnailUrl?: string | null;
  rentPaymentCycle?: PaymentCycleCode | null;
}

/** Toạ độ dùng được: có thật, hữu hạn, và nằm trong dải hợp lệ của Trái Đất. */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Style của viên giá, dùng chung cho cả hai động cơ.
 *
 * "white" và "#111827" là màu cứng CÓ CHỦ Ý, đừng đổi sang token. Viên thuốc giá nằm trên
 * ẢNH BẢN ĐỒ, mà ảnh bản đồ luôn sáng bất kể người dùng đang dùng giao diện sáng hay tối.
 * Đổi sang --color-card / --color-foreground thì ở giao diện tối nó thành viên thuốc tối chữ
 * sáng đặt trên nền bản đồ sáng — không đọc được. Viền thì ngược lại: nó mang ý nghĩa loại
 * tin nên vẫn lấy từ token (xem TYPE_BORDER).
 */
export function pillStyle(point: PropertyMapPoint, hovered: boolean): string {
  const border = TYPE_BORDER[point.type];
  const padding = hovered ? "5px 11px" : "4px 10px";
  const bg = hovered ? border : "white";
  const color = hovered ? "white" : "#111827";
  const shadow = hovered ? "0 4px 10px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.15)";
  const scale = hovered ? "scale(1.15)" : "scale(1)";
  return `display:inline-flex;align-items:center;padding:${padding};border-radius:999px;background:${bg};color:${color};border:2px solid ${border};font-size:12px;font-weight:600;white-space:nowrap;box-shadow:${shadow};transform:${scale};transition:transform 150ms, background 150ms, color 150ms;`;
}

export function pillLabel(point: PropertyMapPoint): string {
  return formatCurrency(point.price, { compact: true });
}
