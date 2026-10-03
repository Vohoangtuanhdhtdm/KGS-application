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
  /** Tên căn/phòng khi tin đăng riêng một căn — phân biệt các tin trong viên giá gộp. */
  unitName?: string | null;
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

/**
 * Các tin chung một toạ độ — thường là các căn/phòng của CÙNG một toà nhà (tin đăng theo
 * căn dùng vị trí của tài sản). Vẽ riêng từng viên thì chúng chồng khít lên nhau: chỉ thấy
 * viên trên cùng, không bấm được viên dưới, và che luôn khối toà nhà 3D. Gộp thành một viên
 * "11 tin · từ 5,4 triệu", bấm vào thì liệt kê đủ.
 */
export interface PillGroup {
  key: string;
  lat: number;
  lng: number;
  /** Rẻ nhất trước — viên giá ghi "từ" giá của tin đầu tiên. */
  points: PropertyMapPoint[];
}

export function groupPoints(points: PropertyMapPoint[]): PillGroup[] {
  const map = new Map<string, PillGroup>();
  for (const p of points) {
    if (!isValidLatLng(p.lat, p.lng)) continue;
    // 6 chữ số thập phân ≈ 0,1 m: chỉ gộp những tin thật sự chung một điểm, không gộp hai
    // căn nhà sát vách.
    const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    const g = map.get(key);
    if (g) g.points.push(p);
    else map.set(key, { key, lat: p.lat, lng: p.lng, points: [p] });
  }
  for (const g of map.values()) g.points.sort((a, b) => a.price - b.price);
  return [...map.values()];
}

export function groupLabel(g: PillGroup): string {
  return g.points.length === 1
    ? pillLabel(g.points[0])
    : `${g.points.length} tin · từ ${pillLabel(g.points[0])}`;
}

export function groupHovered(g: PillGroup, hoveredId: string | null): boolean {
  return hoveredId != null && g.points.some((p) => p.id === hoveredId);
}
