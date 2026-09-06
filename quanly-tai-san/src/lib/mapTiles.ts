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
}

const OSM: TileProvider = {
  name: "OpenStreetMap",
  // Dạng không subdomain là dạng OpenStreetMap khuyến nghị hiện nay.
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
};

const ESRI: TileProvider = {
  name: "Esri",
  // Lưu ý thứ tự {y}/{x} — Esri dùng thứ tự ngược so với lược đồ XYZ thông thường.
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri",
  maxZoom: 19,
};

/**
 * Thứ tự ưu tiên. OpenStreetMap đứng đầu vì đó là nguồn đúng đắn nhất về mặt dữ liệu mở và
 * ghi công; Esri là lưới an toàn cho những mạng chặn OSM.
 *
 * Đặt VITE_MAP_TILE_URL (kèm VITE_MAP_TILE_ATTRIBUTION) để ép dùng một nguồn riêng — máy
 * chủ tile nội bộ, Mapbox, MapTiler — và bỏ qua chuỗi này.
 */
const OVERRIDE_URL = import.meta.env.VITE_MAP_TILE_URL as string | undefined;

export const TILE_PROVIDERS: TileProvider[] = OVERRIDE_URL
  ? [
      {
        name: "Tuỳ chỉnh",
        url: OVERRIDE_URL,
        attribution:
          (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined) ??
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: ["a", "b", "c"],
        maxZoom: 20,
      },
    ]
  : [OSM, ESRI];
