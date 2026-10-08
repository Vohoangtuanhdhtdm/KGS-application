// Lớp "giá/m²" của bản đồ tìm nhà: dựng GeoJSON từ lưới giá của máy chủ (PriceGrid) và các
// quy ước hiển thị dùng chung giữa bản đồ và chú giải.
import type { PriceGridResult } from "@/lib/api/listings";

/** Năm mức từ rẻ (xanh) tới đắt (đỏ). Thang tuần tự hai đầu, đọc được cả khi mù màu đỏ-lục
 *  nhờ độ sáng đổi dần, không chỉ sắc độ. */
export const PRICE_COLORS = ["#2563eb", "#38bdf8", "#fde047", "#fb923c", "#dc2626"] as const;
/** Ô quá ít tin có diện tích — hiện số tin, không tô màu giá. */
export const PRICE_UNRELIABLE = "#94a3b8";

export const PRICE_FILL = "kgs-price-fill";
export const PRICE_LINE = "kgs-price-line";
export const PRICE_LABEL = "kgs-price-label";
export const PRICE_CELLS = "kgs-price-cells";
export const PRICE_POINTS = "kgs-price-points";

/** Mức màu 0..4 theo bốn mốc; null khi chưa đủ tin để chia mức. */
export function priceLevel(v: number, breaks: number[]): number | null {
  if (breaks.length !== 4) return null;
  return breaks.filter((b) => v >= b).length;
}

/**
 * Giá/m² dạng ngắn cho nhãn trên bản đồ: "45 tr", "8,5 tr", "180k". Bán thì đơn vị là đồng/m²,
 * thuê là đồng/m²/tháng — đơn vị ghi ở chú giải, nhãn chỉ giữ con số cho gọn.
 */
export function shortPerM2(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(".", ",")} tỷ`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(".", ",")} tr`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
  return `${Math.round(v)}đ`;
}

export function priceGeoJson(grid: PriceGridResult): {
  cells: GeoJSON.FeatureCollection;
  points: GeoJSON.FeatureCollection;
} {
  const cells: GeoJSON.Feature[] = [];
  const points: GeoJSON.Feature[] = [];
  for (const c of grid.cells) {
    const reliable = c.medianPricePerM2 != null && c.pricedCount >= grid.minReliableCount;
    const level = reliable ? priceLevel(c.medianPricePerM2!, grid.breaks) : null;
    const color = level == null ? PRICE_UNRELIABLE : PRICE_COLORS[level];
    const props = {
      key: c.key,
      color,
      reliable,
      count: c.count,
      west: c.west,
      south: c.south,
      east: c.east,
      north: c.north,
      label: reliable ? `${shortPerM2(c.medianPricePerM2!)}\n${c.count} tin` : `${c.count} tin`,
    };
    cells.push({
      type: "Feature",
      properties: props,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [c.west, c.south],
            [c.east, c.south],
            [c.east, c.north],
            [c.west, c.north],
            [c.west, c.south],
          ],
        ],
      },
    });
    points.push({
      type: "Feature",
      properties: props,
      geometry: { type: "Point", coordinates: [c.lng, c.lat] },
    });
  }
  return {
    cells: { type: "FeatureCollection", features: cells },
    points: { type: "FeatureCollection", features: points },
  };
}
