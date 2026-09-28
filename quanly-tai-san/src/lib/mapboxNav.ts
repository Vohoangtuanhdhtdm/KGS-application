/**
 * Gọi hai API đường đi của Mapbox: Isochrone ("đi tới được trong X phút") và Directions
 * (đường đi + thời gian giữa hai điểm).
 *
 * Điều kiện dùng của cả hai: kết quả PHẢI hiển thị trên bản đồ Mapbox dựng bằng thư viện của
 * Mapbox. Vì thế mọi nơi gọi các hàm này chỉ bật tính năng khi bản đồ đang chạy GL JS — bản
 * Leaflet dự phòng không được dùng chúng. Kết quả cũng không được lưu xuống máy chủ.
 *
 * Hạn mức miễn phí mỗi API 100.000 lượt/tháng. Mỗi lượt ở đây gắn với một thao tác rõ ràng
 * của người dùng (chọn số phút, mở một tin đã đặt chỗ hay đến), và được nhớ trong phiên nên
 * mở lại cùng một tin không tốn thêm lượt.
 */
import { MAPBOX_TOKEN } from "./mapEngine";

export type TravelProfile = "walking" | "cycling" | "driving-traffic";

export const TRAVEL_PROFILES: { value: TravelProfile; label: string; short: string }[] = [
  { value: "walking", label: "Đi bộ", short: "đi bộ" },
  { value: "cycling", label: "Xe đạp", short: "xe đạp" },
  // Mapbox không có chế độ xe máy. Ô tô có tính kẹt xe là ước lượng gần nhất cho giờ đi
  // làm ở thành phố — ghi rõ trên giao diện để người dùng không hiểu nhầm là số chính xác.
  { value: "driving-traffic", label: "Xe máy / ô tô", short: "xe máy/ô tô" },
];

export const TRAVEL_MINUTES = [10, 15, 20, 30, 45] as const;

export const profileLabel = (p: TravelProfile) =>
  TRAVEL_PROFILES.find((x) => x.value === p)?.short ?? p;

export type LngLat = [number, number];

// ---------------- Isochrone ----------------

/** URL tìm kiếm đi qua GET, và Kestrel giới hạn dòng yêu cầu 8 KB: ~150 điểm × ~20 ký tự
 *  là ~3 KB, còn dư cho các bộ lọc khác. Máy chủ chấp nhận tối đa 300. */
const MAX_RING_POINTS = 150;

/** Douglas–Peucker trên toạ độ độ (đủ tốt ở phạm vi vài chục km). */
function simplify(points: LngLat[], tolerance: number): LngLat[] {
  if (points.length <= 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx > 0 && maxD > tolerance * tolerance) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function capPoints(ring: LngLat[]): LngLat[] {
  let tol = 0.0001; // ~11 m
  let out = ring;
  while (out.length > MAX_RING_POINTS && tol < 0.05) {
    out = simplify(ring, tol);
    tol *= 2;
  }
  return out;
}

export interface TravelArea {
  /** Vòng ngoài, đã làm gọn, khép kín. */
  ring: LngLat[];
  /** Khoảng cách xa nhất từ tâm tới vòng — bán kính của vòng tròn bao ngoài. */
  boundingRadiusMeters: number;
}

export async function fetchIsochrone(
  center: { lat: number; lng: number },
  profile: TravelProfile,
  minutes: number,
  signal?: AbortSignal,
): Promise<TravelArea> {
  const url = new URL(
    `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${center.lng},${center.lat}`,
  );
  url.searchParams.set("contours_minutes", String(minutes));
  url.searchParams.set("polygons", "true");
  // Bỏ những "đảo" nhỏ tách rời (ví dụ một đoạn cao tốc đi tới được nhưng không ra vào được).
  url.searchParams.set("denoise", "1");
  // Làm gọn ngay phía Mapbox (mét), đỡ phải tải về hàng nghìn điểm rồi mới cắt.
  url.searchParams.set("generalize", profile === "walking" ? "15" : "40");
  url.searchParams.set("access_token", MAPBOX_TOKEN);

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Isochrone ${res.status}`);
  const data = (await res.json()) as {
    features?: { geometry: { type: string; coordinates: LngLat[][] | LngLat[][][] } }[];
  };
  const g = data.features?.[0]?.geometry;
  if (!g) throw new Error("Isochrone rỗng");
  // Polygon → vòng ngoài; MultiPolygon (hiếm, denoise đã lọc) → mảnh lớn nhất.
  const rings: LngLat[][] =
    g.type === "MultiPolygon"
      ? (g.coordinates as LngLat[][][]).map((poly) => poly[0])
      : [(g.coordinates as LngLat[][])[0]];
  const outer = rings.reduce((a, b) => (b.length > a.length ? b : a));
  const ring = capPoints(outer.map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)] as LngLat));

  const R = 6_371_008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let maxD = 0;
  for (const [lng, lat] of ring) {
    const dLat = toRad(lat - center.lat);
    const dLng = toRad(lng - center.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(center.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
    maxD = Math.max(maxD, 2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
  }
  // Cộng thêm chút lề: vòng tròn chỉ là bộ lọc thô, không được hẹp hơn đa giác.
  return { ring, boundingRadiusMeters: Math.ceil(maxD + 50) };
}

/** Dạng gửi lên API tìm kiếm: "lng,lat;lng,lat;..." — bỏ điểm cuối trùng điểm đầu. */
export function encodeRing(ring: LngLat[]): string {
  const pts =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring;
  return pts.map(([x, y]) => `${x},${y}`).join(";");
}

// ---------------- Directions ----------------

export interface RouteResult {
  durationSeconds: number;
  distanceMeters: number;
  line: GeoJSON.LineString;
}

export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  profile: TravelProfile,
  signal?: AbortSignal,
): Promise<RouteResult | null> {
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}`,
  );
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "false");
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Directions ${res.status}`);
  const data = (await res.json()) as {
    code: string;
    routes?: { duration: number; distance: number; geometry: GeoJSON.LineString }[];
  };
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r) return null; // không có đường (ví dụ bên kia biển)
  return { durationSeconds: r.duration, distanceMeters: r.distance, line: r.geometry };
}

export function formatDuration(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} giờ ${rest} phút` : `${h} giờ`;
}

export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0).replace(".", ",")} km`;
}
