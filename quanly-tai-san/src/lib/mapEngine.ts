/**
 * Chọn "động cơ" vẽ bản đồ: Mapbox GL JS (mặc định) hay Leaflet (dự phòng).
 *
 * Vì sao chuyển sang GL JS (xem thêm kế hoạch nâng cấp Mapbox, Đợt 1):
 *
 * 1. **Nhãn tiếng Việt thật.** Bản đồ vector cho đặt `language: "vi"`. Tile raster qua
 *    Leaflet thì không — đã thử tham số language=vi, ảnh trả về y hệt, nhãn vẫn lẫn tiếng
 *    Anh ("Saigon River", "Ho Chi Minh City").
 * 2. **Chi phí dễ đoán.** GL JS tính MỘT lượt cho mỗi lần mở bản đồ; kéo, phóng to, đổi lớp
 *    không tốn thêm. Tile raster thì mỗi lần kéo sang vùng mới là thêm lượt.
 * 3. **Điều kiện dùng các API đường đi** (Isochrone, Directions — Đợt 2): kết quả phải hiển
 *    thị "trên bản đồ Mapbox dùng thư viện hoặc SDK của Mapbox".
 *
 * Nhưng GL JS có điều kiện mà Leaflet không có: cần WebGL2 và cần token hợp lệ. Thiếu một
 * trong hai thì bản đồ GL không dựng được gì cả. Vì thế các bản Leaflet cũ được GIỮ NGUYÊN
 * làm đường lui, và mỗi bản đồ tự chọn động cơ lúc mở:
 *
 *   có token + có WebGL2 + chưa từng hỏng trong phiên này  →  GL
 *   ngược lại                                               →  Leaflet (Mapbox raster → OSM → Esri)
 *
 * GL hỏng GIỮA CHỪNG (token bị thu hồi, hết hạn mức, sai giới hạn URL) thì bản đồ đó tự đổi
 * sang Leaflet và ghi nhớ trong phiên, để các bản đồ mở sau không thử lại một thứ đã hỏng.
 */

export type MapEngine = "gl" | "leaflet";

export const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || "";

/** Ép dùng Leaflet: VITE_MAP_ENGINE=leaflet — để thử đường lui mà không phải phá token. */
const FORCED = import.meta.env.VITE_MAP_ENGINE as string | undefined;

const FAILED_KEY = "kgs.mapbox-gl-failed";

/** Kiểu bản đồ. Cùng biến môi trường với bản Leaflet (dạng "tài-khoản/mã-kiểu"). */
export const GL_STYLES = {
  streets: `mapbox://styles/${(import.meta.env.VITE_MAPBOX_STYLE as string | undefined) || "mapbox/streets-v12"}`,
  light: `mapbox://styles/${(import.meta.env.VITE_MAPBOX_STYLE_LIGHT as string | undefined) || "mapbox/light-v11"}`,
} as const;

export type GlStyle = keyof typeof GL_STYLES;

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}

function failedThisSession(): boolean {
  try {
    return sessionStorage.getItem(FAILED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Gọi khi GL hỏng — mọi bản đồ mở sau trong phiên này đi thẳng sang Leaflet. */
export function markGlFailed(): void {
  try {
    sessionStorage.setItem(FAILED_KEY, "1");
  } catch {
    // Trình duyệt chặn sessionStorage: chỉ mất phần "ghi nhớ", bản đồ hiện tại vẫn đã đổi.
  }
}

/** Chỉ gọi ở phía trình duyệt (trong useEffect) — cần document và sessionStorage. */
export function pickMapEngine(): MapEngine {
  if (FORCED === "leaflet") return "leaflet";
  if (!MAPBOX_TOKEN) return "leaflet";
  if (failedThisSession()) return "leaflet";
  if (!hasWebGL2()) return "leaflet";
  return "gl";
}

/**
 * Lỗi nào của GL là "chết hẳn" (phải đổi động cơ) chứ không phải vài tile lẻ hỏng.
 * 401: token sai/bị thu hồi · 403: sai giới hạn URL · 429: vượt hạn mức hoặc tốc độ.
 */
export function isFatalGlError(e: { error?: { status?: number; message?: string } }): boolean {
  const status = e.error?.status;
  if (status === 401 || status === 403 || status === 429) return true;
  // Kiểu bản đồ không tải được thì không còn gì để vẽ.
  return (
    /style/i.test(e.error?.message ?? "") && /fail|error|not found/i.test(e.error?.message ?? "")
  );
}

/** Chuỗi giao diện của GL JS bằng tiếng Việt. `language: "vi"` chỉ dịch nhãn bản đồ. */
export const GL_LOCALE_VI = {
  "AttributionControl.ToggleAttribution": "Hiện/ẩn ghi công bản đồ",
  "FullscreenControl.Enter": "Toàn màn hình",
  "FullscreenControl.Exit": "Thoát toàn màn hình",
  "GeolocateControl.FindMyLocation": "Tìm vị trí của tôi",
  "GeolocateControl.LocationNotAvailable": "Không lấy được vị trí",
  "LogoControl.Title": "Mapbox",
  "Map.Title": "Bản đồ",
  "NavigationControl.ResetBearing": "Xoay về hướng bắc",
  "NavigationControl.ZoomIn": "Phóng to",
  "NavigationControl.ZoomOut": "Thu nhỏ",
  "ScrollZoomBlocker.CtrlMessage": "Giữ Ctrl và cuộn chuột để phóng to bản đồ",
  "ScrollZoomBlocker.CmdMessage": "Giữ ⌘ và cuộn chuột để phóng to bản đồ",
  "TouchPanBlocker.Message": "Dùng hai ngón tay để di chuyển bản đồ",
};

/** Khoảng cách mặt cầu (haversine), mét. Thay cho L.LatLng.distanceTo của Leaflet. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Đa giác xấp xỉ một vòng tròn bán kính `radius` mét — GL JS không có lớp "circle theo mét". */
export function circlePolygon(
  center: { lat: number; lng: number },
  radius: number,
  steps = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const R = 6_371_008.8;
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;
  const d = radius / R;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const brg = (i / steps) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      );
    ring.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/**
 * Giao diện tối thiểu mà trang tìm kiếm cần từ bản đồ — thay cho việc cầm thẳng đối tượng
 * L.Map. Nhờ vậy trang không biết (và không cần biết) bản đồ đang chạy bằng GL hay Leaflet.
 */
export interface MapViewApi {
  getCenter(): { lat: number; lng: number };
  /** Khoảng cách từ tâm tới góc khung nhìn — bán kính vừa phủ trọn vùng đang thấy. */
  getViewRadiusMeters(): number;
}
