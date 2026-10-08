/**
 * Tiện ích quanh một tin đăng (chợ, trường, y tế, xe buýt...) từ dữ liệu Mapbox Streets v8
 * (lớp poi_label và transit_stop_label). Gộp HAI nguồn, vì mỗi nguồn chỉ tốt một nửa — đã đo
 * thật ở trung tâm Quận 1:
 *
 * 1. Tilequery API (1 lượt/lần mở tin, miễn phí 100.000 lượt/tháng): đọc tile zoom 16, đủ
 *    MỌI điểm, nhưng chỉ trả 50 điểm GẦN NHẤT — ở khu dày đặc 50 điểm đó chỉ phủ 140 m, nên
 *    riêng nó thì "Y tế", "Công viên" đều báo không có dù bệnh viện cách vài trăm mét.
 * 2. Tile mà bản đồ GL đã tải sẵn (không tốn thêm lượt nào — phí tính theo lần mở bản đồ):
 *    ~2.700 điểm phủ tới ~2,5 km, nhưng ở zoom 15 tile đã lược bớt điểm nhỏ (cửa hàng tiện
 *    lợi, trường mầm non), nên riêng nó thì bỏ sót những chỗ sát nhà nhất.
 *
 * Gộp lại: sát nhà thì đầy đủ (Tilequery), xa hơn thì vẫn có (tile). Chỉ khẳng định "không có"
 * trong phạm vi các tile đã tải (coveredMeters) — ngoài phạm vi đó thì không có dữ liệu để nói.
 */
import type mapboxgl from "mapbox-gl";
import { MAPBOX_TOKEN, distanceMeters } from "./mapEngine";

export type NearbyGroupKey = "market" | "school" | "health" | "bus" | "park" | "food";

export const NEARBY_GROUPS: { key: NearbyGroupKey; label: string; color: string }[] = [
  { key: "market", label: "Chợ, siêu thị", color: "#ea580c" },
  { key: "school", label: "Trường học", color: "#7c3aed" },
  { key: "health", label: "Y tế", color: "#dc2626" },
  { key: "bus", label: "Xe buýt, metro", color: "#0891b2" },
  { key: "park", label: "Công viên", color: "#16a34a" },
  { key: "food", label: "Ăn uống", color: "#ca8a04" },
];

export interface NearbyPlace {
  id: string;
  name: string;
  /** Loại cụ thể bằng tiếng Việt, ví dụ "Nhà thuốc" — dùng khi điểm không có tên. */
  kind: string;
  lat: number;
  lng: number;
  /** Đường chim bay, mét. */
  distance: number;
}

export interface NearbyResult {
  groups: Record<NearbyGroupKey, NearbyPlace[]>;
  /** Bán kính quanh nhà mà dữ liệu chắc chắn đầy đủ (tối đa MAX_RADIUS). */
  coveredMeters: number;
}

const MAX_RADIUS = 1000;

// Tên loại tiếng Việt theo biểu tượng maki / loại trạm. Không có trong bảng thì dùng tên nhóm.
const KIND_VI: Record<string, string> = {
  school: "Trường học",
  college: "Trường cao đẳng, đại học",
  hospital: "Bệnh viện",
  doctor: "Phòng khám",
  dentist: "Nha khoa",
  pharmacy: "Nhà thuốc",
  veterinary: "Thú y",
  grocery: "Cửa hàng thực phẩm",
  convenience: "Cửa hàng tiện lợi",
  shop: "Cửa hàng",
  marketplace: "Chợ",
  park: "Công viên",
  garden: "Vườn hoa",
  playground: "Sân chơi",
  restaurant: "Nhà hàng",
  "restaurant-noodle": "Quán bún, phở",
  cafe: "Quán cà phê",
  "fast-food": "Đồ ăn nhanh",
  bakery: "Tiệm bánh",
  bar: "Quán bar",
  "ice-cream": "Kem",
  bus: "Trạm xe buýt",
  metro_rail: "Ga metro",
  rail: "Ga tàu",
};

function groupOf(p: Record<string, unknown>, layer: string): NearbyGroupKey | null {
  if (layer === "transit_stop_label") return "bus";
  switch (p.class) {
    case "food_and_drink_stores":
      return "market";
    case "education":
      return "school";
    case "medical":
      return "health";
    case "park_like":
      // park_like của Mapbox gộp cả nghĩa trang ("Nghĩa Trang Nghệ Sĩ" hiện ra dưới mục Công
      // viên ở một tin Gò Vấp) — sai nghĩa và dễ phản cảm trên trang bán/thuê nhà.
      return p.maki === "cemetery" || /cemetery|grave/i.test(String(p.type ?? "")) ? null : "park";
    case "food_and_drink":
      return "food";
    default:
      return p.maki === "marketplace" ? "market" : null;
  }
}

// ---- Vùng các tile đã tải ----
// Bản đồ tải những tile (ô vuông 512 px) phủ khung nhìn ở mức zoom hiện tại. Hình chữ nhật
// hợp bởi các ô đó là phần chắc chắn có dữ liệu; khoảng cách từ nhà tới mép gần nhất của nó
// là bán kính "đã quét đủ".
const lon2x = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
const x2lon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const y2lat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

function coveredRadius(map: mapboxgl.Map, center: { lat: number; lng: number }): number {
  // Tile vector Mapbox là 512 px nên zoom của tile = phần nguyên zoom bản đồ (tối đa 16).
  const z = Math.min(16, Math.floor(map.getZoom()));
  const b = map.getBounds();
  if (!b) return 0;
  const west = x2lon(lon2x(b.getWest(), z), z);
  const east = x2lon(lon2x(b.getEast(), z) + 1, z);
  const north = y2lat(lat2y(b.getNorth(), z), z);
  const south = y2lat(lat2y(b.getSouth(), z) + 1, z);
  return Math.min(
    distanceMeters(center, { lat: center.lat, lng: west }),
    distanceMeters(center, { lat: center.lat, lng: east }),
    distanceMeters(center, { lat: north, lng: center.lng }),
    distanceMeters(center, { lat: south, lng: center.lng }),
  );
}

type Candidate = NearbyPlace & { group: NearbyGroupKey; dedupe: string };

function toCandidate(
  props: Record<string, unknown>,
  layer: string,
  lng: number,
  lat: number,
  center: { lat: number; lng: number },
): Candidate | null {
  const group = groupOf(props, layer);
  if (!group) return null;
  const kindKey = String(props.maki ?? props.mode ?? "");
  const kind = KIND_VI[kindKey] ?? NEARBY_GROUPS.find((g) => g.key === group)!.label;
  const name = String(props.name_vi ?? props.name ?? "").trim();
  // Một điểm có mặt ở nhiều tile kề nhau và ở cả hai nguồn; hai trạm cùng tên ở hai bên đường
  // cũng chỉ giữ một. Điểm không tên thì phân biệt bằng toạ độ.
  const dedupe = name ? `${group}|${name}` : `${group}|${lat.toFixed(4)},${lng.toFixed(4)}`;
  return {
    id: `${group}-${dedupe}`,
    name: name || kind,
    kind,
    lat,
    lng,
    distance: distanceMeters(center, { lat, lng }),
    group,
    dedupe,
  };
}

/** Nguồn 2: tile bản đồ đã tải. Gọi khi bản đồ "idle" lần đầu. */
export function collectFromMap(
  map: mapboxgl.Map,
  center: { lat: number; lng: number },
): { candidates: Candidate[]; coveredMeters: number } {
  const coveredMeters = Math.min(MAX_RADIUS, Math.floor(coveredRadius(map, center)));
  const candidates: Candidate[] = [];
  for (const layer of ["poi_label", "transit_stop_label"]) {
    let feats: mapboxgl.GeoJSONFeature[] = [];
    try {
      feats = map.querySourceFeatures("composite", { sourceLayer: layer });
    } catch {
      continue; // kiểu bản đồ tự chọn (VITE_MAPBOX_STYLE) có thể không có nguồn "composite"
    }
    for (const f of feats) {
      if (f.geometry.type !== "Point") continue;
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const c = toCandidate(f.properties ?? {}, layer, lng, lat, center);
      if (c && c.distance <= coveredMeters) candidates.push(c);
    }
  }
  return { candidates, coveredMeters };
}

/** Nguồn 1: Tilequery — 50 điểm gần nhất, đầy đủ ở zoom 16. */
export async function fetchTilequery(
  center: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<Candidate[]> {
  const url = new URL(
    `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${center.lng},${center.lat}.json`,
  );
  url.searchParams.set("radius", String(MAX_RADIUS));
  url.searchParams.set("limit", "50");
  // Chỉ điểm quan tâm: trạm xe buýt dày đặc dọc mọi tuyến đường, gộp vào sẽ chiếm gần hết
  // 50 chỗ. Trạm xe buýt lấy từ tile bản đồ là đủ.
  url.searchParams.set("layers", "poi_label");
  url.searchParams.set("dedupe", "true");
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Tilequery ${res.status}`);
  const data = (await res.json()) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: Record<string, unknown>;
    }[];
  };
  return (data.features ?? [])
    .map((f) =>
      toCandidate(
        f.properties,
        "poi_label",
        f.geometry.coordinates[0],
        f.geometry.coordinates[1],
        center,
      ),
    )
    .filter((c): c is Candidate => c !== null);
}

/** Gộp các nguồn, bỏ trùng giữ bản gần nhất, chia theo nhóm. */
export function buildNearby(sources: Candidate[][], coveredMeters: number): NearbyResult {
  const groups = Object.fromEntries(NEARBY_GROUPS.map((g) => [g.key, []])) as unknown as Record<
    NearbyGroupKey,
    NearbyPlace[]
  >;
  const all = sources.flat().sort((a, b) => a.distance - b.distance);
  const seen = new Set<string>();
  for (const { group, dedupe, ...place } of all) {
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    groups[group].push(place);
  }
  return { groups, coveredMeters };
}

/** "~3 phút đi bộ": đường chim bay × 1,3 (đường thật vòng vèo hơn) ÷ 80 m/phút. */
export function walkMinutes(distance: number): number {
  return Math.max(1, Math.round((distance * 1.3) / 80));
}

// ---------------- Vùng đi bộ (Isochrone) ----------------

/** Điểm có nằm trong đa giác không (vòng ngoài [lng, lat]) — tia ngang, đủ đúng ở cỡ vài km. */
export function insideRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface WalkReach {
  minutes: number;
  /** Các điểm của từng nhóm nằm TRONG vùng đi bộ, gần nhất trước. */
  groups: Record<NearbyGroupKey, NearbyPlace[]>;
  /** Số nhóm có ít nhất một điểm trong vùng. */
  reached: number;
  /**
   * Vùng đi bộ rộng hơn phạm vi đã quét tiện ích: nhóm chưa thấy có thể nằm ở phần rìa chưa
   * quét — chỉ nói "chưa thấy", không khẳng định "không có".
   */
  partial: boolean;
}

/**
 * "Đi bộ X phút tới được những gì": lọc tiện ích theo vùng đi bộ THẬT (men theo đường sá), thay
 * cho ước tính đường chim bay × 1,3. Hai điểm cùng cách nhà 500 m có thể một cái 6 phút, một cái
 * 15 phút vì phải vòng qua kênh hay đường cao tốc — đó là điều vùng đi bộ trả lời được.
 */
export function walkReach(
  data: NearbyResult,
  ring: [number, number][],
  boundingRadiusMeters: number,
  minutes: number,
): WalkReach {
  const groups = Object.fromEntries(
    NEARBY_GROUPS.map((g) => [
      g.key,
      data.groups[g.key].filter((p) => insideRing(p.lng, p.lat, ring)),
    ]),
  ) as unknown as Record<NearbyGroupKey, NearbyPlace[]>;
  return {
    minutes,
    groups,
    reached: NEARBY_GROUPS.filter((g) => groups[g.key].length > 0).length,
    // boundingRadiusMeters đã cộng 50 m lề (xem fetchIsochrone).
    partial: boundingRadiusMeters - 50 > data.coveredMeters,
  };
}
