/**
 * Nguồn ảnh nền bản đồ, kèm nguồn dự phòng.
 *
 * Trước đây cả hai bản đồ gắn cứng `https://{s}.tile.openstreetmap.org/...`. Vấn đề không
 * nằm ở chất lượng nguồn mà ở chỗ khác hẳn: **tên miền đó nằm trong danh sách chặn của rất
 * nhiều phần mềm chặn quảng cáo và một số nhà mạng.** Trên chính máy phát triển của đồ án
 * này, `tile.openstreetmap.org` phân giải về 127.0.0.1 — mọi tile hỏng, và bản đồ hiện ra
 * một vùng trắng trơn không kèm lời giải thích nào. Người dùng chỉ thấy "bản đồ bị lỗi".
 *
 * Chọn một nguồn khác không giải quyết được gốc rễ: mạng nào chặn gì là chuyện của từng
 * mạng, và nguồn thay thế hôm nay có thể bị chặn ngày mai. Nên ở đây là một CHUỖI nguồn:
 * dùng nguồn chính, tile hỏng liên tục thì tự chuyển sang nguồn sau. Chỉ khi hết nguồn mới
 * báo cho người dùng.
 *
 * Một cạm bẫy đã gặp và tránh: CARTO basemaps trông như nguồn miễn phí không cần khoá,
 * nhưng nay trả về tile **đóng dấu chìm "API KEY REQUIRED"** kín mặt bản đồ. Tile đó tải
 * THÀNH CÔNG nên không có lỗi nào để bắt — chỉ nhìn mới thấy. Vì vậy CARTO không nằm trong
 * danh sách này.
 */

export interface TileProvider {
  name: string;
  url: string;
  attribution: string;
  subdomains?: string[];
  maxZoom: number;
  /** Mapbox phát tile 512px; Leaflet mặc định 256px. */
  tileSize?: number;
  /** Đi kèm tileSize 512: một tile 512px phủ đúng vùng của bốn tile 256px ở mức zoom trên. */
  zoomOffset?: number;
}

/** "streets" cho bản đồ tìm nhà (cần đường, trường, chợ); "light" cho bản đồ tài sản, nơi
    các panel trắng đặt đè lên nền và cần một nền gần như đơn sắc để còn đọc được. */
export type TileVariant = "streets" | "light";

const OSM: TileProvider = {
  name: "OpenStreetMap",
  // Dạng không subdomain là dạng OpenStreetMap khuyến nghị hiện nay.
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
};

const ESRI: TileProvider = {
  name: "Esri",
  // Lưu ý thứ tự {y}/{x} — Esri dùng thứ tự ngược so với lược đồ XYZ thông thường.
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri",
  maxZoom: 19,
};

// ---------------------------------------------------------------------------
// Mapbox — nguồn chính khi có token
// ---------------------------------------------------------------------------
//
// Dùng Static Tiles API (ảnh raster dựng sẵn từ một kiểu bản đồ Mapbox) qua chính Leaflet đang
// có, KHÔNG chuyển sang Mapbox GL JS. Ba lý do:
//
// 1. Không phải viết lại ba bản đồ — marker giá, gom cụm, đồng bộ hover với danh sách đều giữ
//    nguyên. Viết lại là đổi một thứ đã kiểm kỹ lấy rủi ro, chỉ để đổi nguồn ảnh nền.
// 2. Mapbox lỗi (hết hạn mức, token bị thu hồi, sai giới hạn URL) thì chuỗi dự phòng bên dưới
//    tự lùi về OpenStreetMap — bản đồ không bao giờ vì Mapbox mà chết. Với GL JS, Mapbox hỏng
//    là bản đồ hỏng.
// 3. Tile 512px + zoomOffset -1: mỗi lần tải một vùng chỉ tốn 1/4 số lượt so với tile 256px,
//    và Mapbox cho trình duyệt giữ tile 12 giờ — xem lại trong khoảng đó không tốn lượt nào.
//
// Token là loại CÔNG KHAI (pk.), vốn được thiết kế để nằm trong mã phía trình duyệt. Nhưng nó
// nằm trong .env.local (bị .gitignore loại), không nằm trong kho mã: kho đang công khai, và
// token lộ trên GitHub nghĩa là người lạ tiêu hạn mức miễn phí của dự án.

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

/** Đổi kiểu bản đồ không cần sửa mã — ví dụ một kiểu tự tạo trong Mapbox Studio với nhãn
    tiếng Việt: VITE_MAPBOX_STYLE=ten-tai-khoan/ma-kieu. */
const MAPBOX_STYLES: Record<TileVariant, string> = {
  streets: (import.meta.env.VITE_MAPBOX_STYLE as string | undefined) || "mapbox/streets-v12",
  light: (import.meta.env.VITE_MAPBOX_STYLE_LIGHT as string | undefined) || "mapbox/light-v11",
};

function mapbox(variant: TileVariant): TileProvider | null {
  if (!MAPBOX_TOKEN) return null;
  return {
    // Tên khác nhau theo kiểu để BaseTileLayer dựng lại lớp tile khi đổi kiểu.
    name: `Mapbox · ${variant}`,
    // {r} → "@2x" trên màn hình mật độ cao: ảnh nét gấp đôi, Mapbox vẫn tính MỘT lượt.
    url: `https://api.mapbox.com/styles/v1/${MAPBOX_STYLES[variant]}/tiles/{z}/{x}/{y}{r}?access_token=${MAPBOX_TOKEN}`,
    // Ghi công và liên kết "Improve this map" là điều kiện sử dụng của Mapbox.
    attribution:
      '&copy; <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> ' +
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> ' +
      '<a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener"><strong>Improve this map</strong></a>',
    maxZoom: 20,
    tileSize: 512,
    zoomOffset: -1,
  };
}

/**
 * Thứ tự ưu tiên: Mapbox (nếu có token) → OpenStreetMap → Esri.
 *
 * OpenStreetMap là lưới an toàn khi Mapbox không phục vụ, Esri là lưới an toàn cho những mạng
 * chặn OSM. Không có token (máy chạy CI, người mới clone kho mã) thì bản đồ vẫn chạy bằng OSM.
 *
 * Đặt VITE_MAP_TILE_URL (kèm VITE_MAP_TILE_ATTRIBUTION) để ép dùng một nguồn riêng — máy
 * chủ tile nội bộ, MapTiler — và bỏ qua cả chuỗi này.
 */
const OVERRIDE_URL = import.meta.env.VITE_MAP_TILE_URL as string | undefined;

export function getTileProviders(variant: TileVariant = "streets"): TileProvider[] {
  if (OVERRIDE_URL) {
    return [
      {
        name: "Tuỳ chỉnh",
        url: OVERRIDE_URL,
        attribution:
          (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined) ??
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: ["a", "b", "c"],
        maxZoom: 20,
      },
    ];
  }
  const mb = mapbox(variant);
  return mb ? [mb, OSM, ESRI] : [OSM, ESRI];
}
