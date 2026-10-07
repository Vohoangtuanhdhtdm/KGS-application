/**
 * Phần dùng chung giữa bản đồ tìm kiếm GL (GlPropertyMap) và bản Leaflet dự phòng
 * (PropertyMap). Tách riêng để bản GL không phải import từ tệp Leaflet — làm vậy sẽ kéo cả
 * thư viện Leaflet vào gói tải của bản GL.
 */
import { LISTING_TYPE, type ListingTypeCode, type PaymentCycleCode } from "@/constants/enums";
import { formatCurrency } from "@/lib/format";

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
  // Thông số cho thẻ xem nhanh — thiếu thì thẻ chỉ bỏ dòng đó.
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  district?: string | null;
  city?: string | null;
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

/** "5,4tr" / "8,5 tỷ" — viên giá chật chỗ, "triệu" viết tắt; "tỷ" đã ngắn nên giữ nguyên. */
export function pillLabel(point: PropertyMapPoint): string {
  return formatCurrency(point.price, { compact: true }).replace(" triệu", "tr");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * HTML của viên giá, dùng chung cho cả hai động cơ. Hình dáng nằm ở lớp .kgs-pill
 * (styles.css), ở đây chỉ chọn biến thể:
 *   • --sale / --rent: màu viền + màu khi sáng lên theo loại tin
 *   • is-hover: đang rê chuột (ở bản đồ hoặc ở thẻ trong danh sách)
 *   • is-active: viên giá đang mở thẻ xem nhanh
 * Viên gộp có thêm huy hiệu số tin ở đầu và chữ "từ" trước giá rẻ nhất.
 */
export function pillHtml(
  g: PillGroup,
  state: { hovered?: boolean; active?: boolean } = {},
): string {
  const p = g.points[0];
  const cls = [
    "kgs-pill",
    p.type === 2 ? "kgs-pill--rent" : "kgs-pill--sale",
    state.hovered ? "is-hover" : "",
    state.active ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const price = escapeHtml(pillLabel(p));
  const inner =
    g.points.length === 1
      ? `<span class="kgs-pill__price">${price}</span>`
      : `<span class="kgs-pill__count">${g.points.length}</span><span class="kgs-pill__price"><span class="kgs-pill__from">từ</span>${price}</span>`;
  return `<div class="${cls}" title="${escapeHtml(LISTING_TYPE[p.type] ?? "")}">${inner}</div>`;
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

/** Nhãn đọc thành lời (aria-label) — viết đủ "triệu", không viết tắt như trên viên giá. */
export function groupLabel(g: PillGroup): string {
  const price = formatCurrency(g.points[0].price, { compact: true });
  return g.points.length === 1 ? price : `${g.points.length} tin · từ ${price}`;
}

export function groupHovered(g: PillGroup, hoveredId: string | null): boolean {
  return hoveredId != null && g.points.some((p) => p.id === hoveredId);
}
