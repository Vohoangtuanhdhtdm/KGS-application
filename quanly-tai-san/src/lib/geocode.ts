/**
 * Tìm địa chỉ và địa điểm trên bản đồ: Mapbox Geocoding v6 trước, Search Box khi cần.
 *
 * Geocoding v6 "tạm thời" miễn phí 100.000 lượt/tháng nhưng KHÔNG có điểm quan tâm (trường học,
 * chợ, bệnh viện…): gõ "Đại học Thủ Dầu Một" nó chỉ trả về khu vực "Thu Dau Mot". Search Box có
 * các điểm đó nhưng hạn mức miễn phí thấp hơn nhiều (tính theo phiên). Vì vậy:
 *
 *   1. luôn hỏi v6 trước;
 *   2. chỉ khi không kết quả nào của v6 khớp tên người dùng gõ mới hỏi Search Box (`/suggest`),
 *      gắn MỘT mã phiên cho cả lần gõ — các lượt gợi ý cùng phiên chỉ tính một phiên;
 *   3. toạ độ của gợi ý Search Box chỉ lấy (`/retrieve`, cùng phiên) khi người dùng chọn nó.
 *
 * Điều khoản của cả hai: kết quả chỉ dùng để HIỂN THỊ trên bản đồ Mapbox, không được lưu lại.
 * Mọi nơi gọi chỉ dùng kết quả để đưa camera tới hoặc đặt tâm tìm kiếm tạm thời — ghim của tin
 * đăng vẫn do người đăng tự đặt.
 */
import { MAPBOX_TOKEN, distanceMeters } from "./mapEngine";

export interface GeocodeHit {
  id: string;
  name: string;
  place: string;
  /** Có sẵn với kết quả Geocoding v6; gợi ý Search Box thì lấy bằng `resolveHit`. */
  lat?: number;
  lng?: number;
  /** Mã của gợi ý Search Box — dùng cho `/retrieve`. */
  mapboxId?: string;
}

const LIMIT = 8;
/** Kết quả trong bán kính này quanh điểm ưu tiên được đưa lên đầu. */
const NEAR_METERS = 50_000;
/** Tỉ lệ từ khoá khớp tên từ mức này trở lên thì coi như v6 đã tìm đúng chỗ. */
const GOOD_MATCH = 0.8;

const SEARCHBOX = "https://api.mapbox.com/search/searchbox/v1";

/** Một mã phiên Search Box cho một lần gõ — tạo mới sau khi người dùng chọn xong. */
export function newSearchSession(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

const ADMIN_PREFIX = /^(quận|huyện|q\.|thị xã|tx\.|phường|p\.|xã)(\s|$)/iu;

/**
 * Dữ liệu Mapbox đã theo địa giới MỚI (sau sáp nhập 2025): "Quận 1" không còn, Bình Dương đã
 * thuộc TP.HCM. Gửi kèm tên cũ ("…, Bình Dương", "Hàm Nghi, Quận 1") làm Mapbox trả kết quả
 * rác hoặc rỗng. Vì vậy chỉ gửi PHẦN CHÍNH (trước dấu phẩy đầu); phần sau là ngữ cảnh, quận /
 * huyện / phường cũ thì bỏ hẳn.
 */
export function splitQuery(text: string): { head: string; context: string[] } {
  const parts = text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s, i) => i === 0 || !ADMIN_PREFIX.test(s));
  if (parts.length === 0) return { head: text.trim(), context: [] };
  // "45, Điện Biên Phủ": số nhà đứng riêng thuộc về tên đường phía sau.
  if (parts.length > 1 && /^[\d/\-\s]+[a-z]?$/iu.test(parts[0])) {
    parts.splice(0, 2, `${parts[0]} ${parts[1]}`);
  }
  return { head: cleanQuery(parts[0]), context: parts.slice(1) };
}

/** "Hàm Nghi Quận 1" (không dấu phẩy) → "Hàm Nghi". */
export function cleanQuery(text: string): string {
  return (
    text
      .replace(/(^|[\s,])(quận|huyện|q\.)\s*[^,]*/giu, " ")
      .replace(/\s*,\s*(,\s*)+/g, ", ")
      .replace(/^[\s,]+|[\s,]+$/g, "")
      .trim() || text
  );
}

function tokens(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !/^\d+$/.test(t)); // số nhà không có trong tên đường
}

/** Bao nhiêu phần từ khoá người dùng gõ có trong tên kết quả (0–1), không phân biệt dấu. */
export function nameScore(query: string, name: string): number {
  const q = tokens(query);
  if (q.length === 0) return 0;
  const n = new Set(tokens(name));
  return q.filter((t) => n.has(t)).length / q.length;
}

/** Tên càng sát từ khoá càng cao: "Đại học Thủ Dầu Một" trên "Bánh Mì Chảo Đại Học Thủ Dầu Một". */
function exactness(query: string, name: string): number {
  const q = new Set(tokens(query));
  const n = tokens(name);
  if (n.length === 0) return 0;
  return n.filter((t) => q.has(t)).length / Math.max(q.size, n.length);
}

type V6Feature = {
  id: string;
  geometry: { coordinates: [number, number] };
  properties: { name?: string; place_formatted?: string };
};

type Suggestion = {
  mapbox_id: string;
  name: string;
  full_address?: string;
  place_formatted?: string;
  distance?: number;
};

async function searchV6(q: string, proximity: { lat: number; lng: number }, signal?: AbortSignal) {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", q);
  url.searchParams.set("country", "vn");
  url.searchParams.set("language", "vi");
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("proximity", `${proximity.lng},${proximity.lat}`);
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  return ((await res.json()) as { features?: V6Feature[] }).features ?? [];
}

async function suggest(
  q: string,
  proximity: { lat: number; lng: number },
  session: string,
  signal?: AbortSignal,
) {
  const url = new URL(`${SEARCHBOX}/suggest`);
  url.searchParams.set("q", q);
  url.searchParams.set("session_token", session);
  url.searchParams.set("country", "vn");
  url.searchParams.set("language", "vi");
  url.searchParams.set("limit", "6");
  url.searchParams.set("proximity", `${proximity.lng},${proximity.lat}`);
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  return ((await res.json()) as { suggestions?: Suggestion[] }).suggestions ?? [];
}

/**
 * Gợi ý cho một câu người dùng gõ. Truyền `session` (từ `newSearchSession`) để cho phép hỏi
 * Search Box khi v6 không tìm ra địa điểm; không truyền thì chỉ dùng v6.
 */
export async function geocodeForward(
  text: string,
  proximity: { lat: number; lng: number },
  signal?: AbortSignal,
  session?: string,
): Promise<GeocodeHit[] | null> {
  const { head } = splitQuery(text);
  const features = await searchV6(head, proximity, signal);
  if (!features) return null;

  const all: GeocodeHit[] = features.map((f) => ({
    id: f.id,
    name: f.properties.name ?? "",
    place: f.properties.place_formatted ?? "",
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
  // `proximity` của Geocoding v6 chỉ ưu tiên rất nhẹ: gõ "Chợ Bến Thành" khi đang xem TP.HCM
  // vẫn ra phố "Bến Bình" ở Hải Phòng đứng đầu. Đưa kết quả gần lên trước, giữ nguyên thứ tự
  // liên quan của Mapbox trong mỗi nhóm.
  const isNear = (s: GeocodeHit) =>
    distanceMeters(proximity, { lat: s.lat!, lng: s.lng! }) <= NEAR_METERS;
  const v6 = [...all.filter(isNear), ...all.filter((s) => !isNear(s))];

  const best = Math.max(0, ...v6.map((h) => nameScore(head, h.name)));
  if (best >= GOOD_MATCH || !session) return v6;

  // v6 không biết địa điểm này (thường là trường, chợ, bệnh viện…): hỏi Search Box.
  const sugg = await suggest(head, proximity, session, signal).catch(() => null);
  if (!sugg || sugg.length === 0) return v6;
  const ranked = sugg
    .map((s) => ({ s, cover: nameScore(head, s.name), exact: exactness(head, s.name) }))
    .sort(
      (a, b) =>
        Number(b.cover >= GOOD_MATCH) - Number(a.cover >= GOOD_MATCH) ||
        b.exact - a.exact ||
        (a.s.distance ?? Infinity) - (b.s.distance ?? Infinity),
    )
    .map(({ s }): GeocodeHit => ({
      id: `sb-${s.mapbox_id}`,
      name: s.name,
      place: s.full_address ?? s.place_formatted ?? "",
      mapboxId: s.mapbox_id,
    }));
  return [...ranked, ...v6].slice(0, LIMIT);
}

/** Toạ độ của một gợi ý: có sẵn (v6) thì trả luôn, gợi ý Search Box thì `/retrieve` cùng phiên. */
export async function resolveHit(
  hit: GeocodeHit,
  session: string,
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number } | null> {
  if (hit.lat != null && hit.lng != null) return { lat: hit.lat, lng: hit.lng };
  if (!hit.mapboxId) return null;
  const url = new URL(`${SEARCHBOX}/retrieve/${encodeURIComponent(hit.mapboxId)}`);
  url.searchParams.set("session_token", session);
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const f = ((await res.json()) as { features?: V6Feature[] }).features?.[0];
  return f ? { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] } : null;
}

/** Kết quả đầu tiên kèm toạ độ — cho những nơi cần một điểm ngay (trợ lý tìm nhà). */
export async function geocodeFirst(
  text: string,
  proximity: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<GeocodeHit | null> {
  const session = newSearchSession();
  const first = (await geocodeForward(text, proximity, signal, session))?.[0];
  if (!first) return null;
  const at = await resolveHit(first, session, signal);
  return at ? { ...first, ...at } : null;
}
