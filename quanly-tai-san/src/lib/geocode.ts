/**
 * Tìm địa chỉ bằng Mapbox Geocoding v6 "tạm thời" (100.000 lượt/tháng miễn phí).
 *
 * Điều khoản của loại geocoding này: kết quả chỉ dùng để HIỂN THỊ trên bản đồ Mapbox, không
 * được lưu lại. Mọi nơi gọi hàm này chỉ dùng kết quả để đưa camera hoặc đặt tâm tìm kiếm tạm
 * thời trên bản đồ GL — không ghi toạ độ geocoding xuống cơ sở dữ liệu.
 */
import { MAPBOX_TOKEN, distanceMeters } from "./mapEngine";

export interface GeocodeHit {
  id: string;
  name: string;
  place: string;
  lat: number;
  lng: number;
}

const LIMIT = 8;
/** Kết quả trong bán kính này quanh điểm ưu tiên được đưa lên đầu. */
const NEAR_METERS = 50_000;

type Feature = {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: { name?: string; place_formatted?: string };
};

/**
 * Dữ liệu Mapbox đã theo địa giới MỚI (sau sáp nhập 2025): "Quận 1" không còn, nên "Hàm Nghi,
 * Quận 1" ra rỗng trong khi "Hàm Nghi" ra ngay. Người dùng vẫn quen gõ kèm quận — bỏ phần
 * quận/huyện đi.
 */
export function cleanQuery(text: string): string {
  return (
    text
      .replace(/(^|[\s,])(quận|huyện|q\.)\s*[^,]*/giu, " ")
      .replace(/\s*,\s*(,\s*)+/g, ", ")
      .replace(/^[\s,]+|[\s,]+$/g, "")
      .trim() || text
  );
}

export async function geocodeForward(
  text: string,
  proximity: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<GeocodeHit[] | null> {
  const search = async (q: string): Promise<Feature[] | null> => {
    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", q);
    url.searchParams.set("country", "vn");
    url.searchParams.set("language", "vi");
    url.searchParams.set("limit", String(LIMIT));
    url.searchParams.set("proximity", `${proximity.lng},${proximity.lat}`);
    url.searchParams.set("access_token", MAPBOX_TOKEN);
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return ((await res.json()) as { features?: Feature[] }).features ?? [];
  };

  const cleaned = cleanQuery(text);
  let features = await search(cleaned);
  // Vẫn rỗng thì thử lại với phần trước dấu phẩy — chỉ tốn thêm một lượt khi lượt đầu trống.
  if (features && features.length === 0 && cleaned.includes(",")) {
    features = await search(cleaned.split(",")[0].trim());
  }
  if (!features) return null;

  const all = features.map((f) => ({
    id: f.id,
    name: f.properties.name ?? "",
    place: f.properties.place_formatted ?? "",
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
  // `proximity` của Geocoding v6 chỉ ưu tiên rất nhẹ: gõ "Chợ Bến Thành" khi đang xem TP.HCM
  // vẫn ra phố "Bến Bình" ở Hải Phòng đứng đầu. Đưa kết quả gần lên trước, giữ nguyên thứ tự
  // liên quan của Mapbox trong mỗi nhóm.
  const near = all.filter((s) => distanceMeters(proximity, s) <= NEAR_METERS);
  const far = all.filter((s) => distanceMeters(proximity, s) > NEAR_METERS);
  return [...near, ...far];
}
