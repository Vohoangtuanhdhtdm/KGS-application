// Phần dùng chung của bản đồ danh mục tài sản, cho cả bản Leaflet (AssetMap) lẫn bản
// Mapbox GL (GlAssetMap): cách mã hoá vòng giá trị/trạng thái, màu cụm, và lớp spotlight +
// thẻ xem nhanh (AssetSelectionOverlay.tsx). Hai bản chỉ khác ở chỗ lấy toạ độ màn hình của marker từ đâu.
import type { AssetMapItem } from "@/lib/api/assets";
import type { AssetStatusCode } from "@/constants/enums";

export const FALLBACK_CENTER: [number, number] = [10.7769, 106.7009];

// Dùng token ngữ nghĩa sẵn có, không đặt bảng màu riêng cho bản đồ.
export const STATUS_COLOR: Record<AssetStatusCode, string> = {
  1: "var(--color-info)", // Đang sử dụng
  2: "var(--color-success)", // Đang cho thuê
  3: "var(--color-warning)", // Đang rao bán
  4: "var(--color-muted-foreground)", // Trống
  5: "var(--color-muted-foreground)", // Đã bán
  6: "var(--color-destructive)", // Hết hạn thuê
};

// Bán kính vòng ngoài: nhỏ nhất → lớn nhất trong CHÍNH danh mục đang xem
export const RING_MIN = 18;
export const RING_MAX = 48;
/** Tài sản chưa nhập giá trị: vòng nhỏ nhất, và không tham gia tính min–max. */
export const RING_NO_VALUE = 18;
/** Mọi tài sản cùng giá trị → không có thang so sánh, dùng cỡ trung bình cố định. */
export const RING_UNIFORM = 24;

export type LocatedAsset = AssetMapItem & { latitude: number; longitude: number };

export function hasLocation(a: AssetMapItem): a is LocatedAsset {
  return a.latitude != null && a.longitude != null;
}

/**
 * Chuẩn hoá bán kính theo min–max của chính danh mục người dùng đang xem, không theo giá
 * trị tuyệt đối: người chỉ có tài sản nhỏ vẫn phải thấy được cái nào lớn nhất của họ.
 */
export function makeRingRadius(items: LocatedAsset[]): (value: number | null) => number {
  const values = items.map((a) => a.currentValue).filter((v): v is number => v != null);
  if (values.length === 0) return () => RING_NO_VALUE;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (value) => {
    if (value == null) return RING_NO_VALUE;
    if (max === min) return RING_UNIFORM;
    return RING_MIN + ((value - min) / (max - min)) * (RING_MAX - RING_MIN);
  };
}

export function ringInnerHtml(
  status: AssetStatusCode,
  radius: number,
  alive: boolean,
  active: boolean,
) {
  const color = STATUS_COLOR[status] ?? STATUS_COLOR[4];
  const size = radius * 2;
  const cls = ["asset-ring", alive && "asset-ring--alive", active && "asset-ring--active"]
    .filter(Boolean)
    .join(" ");
  return `<div class="${cls}" style="width:${size}px;height:${size}px;border-color:${color};background:color-mix(in oklab, ${color} 14%, transparent)"><i class="asset-ring__dot" style="background:${color}"></i></div>`;
}

/** Gom bán kính về bội số 2px: giữ số kiểu marker nhỏ mà mắt thường không phân biệt được. */
export function snapRadius(radius: number): number {
  return Math.max(RING_MIN, Math.round(radius / 2) * 2);
}

/** Nội dung một cụm: tô theo trạng thái chiếm đa số — giữ được thông tin trạng thái khi zoom xa. */
export function clusterHtml(
  count: number,
  tally: Map<number, number>,
): { html: string; size: number } {
  let top = 4;
  let topCount = -1;
  for (const [code, n] of tally) {
    if (n > topCount) {
      top = code;
      topCount = n;
    }
  }
  const color = STATUS_COLOR[top as AssetStatusCode] ?? STATUS_COLOR[4];
  const size = count >= 50 ? 64 : count >= 10 ? 52 : 40;
  const font = count >= 50 ? 18 : count >= 10 ? 16 : 14;
  return {
    html: `<div class="asset-cluster" style="width:${size}px;height:${size}px;font-size:${font}px;background:${color};box-shadow:0 0 0 8px color-mix(in oklab, ${color} 15%, transparent)">${count}</div>`,
    size,
  };
}

export const MAX_CLUSTER_RADIUS = 56;
