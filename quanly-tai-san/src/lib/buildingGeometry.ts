/**
 * Dựng hình toà nhà "Toà nhà → Tầng → Căn" từ dữ liệu, không cần tệp 3D.
 *
 * Đầu vào: khung toà nhà (đường viền [lng, lat]), số tầng, chiều cao tầng và các căn chủ
 * nhà đã khai theo tầng. Đầu ra: GeoJSON để Mapbox GL vẽ bằng `fill-extrusion` — mỗi căn
 * là một khối riêng (bấm được, tô màu theo tình trạng), mỗi tầng một lớp chồng lên nhau.
 *
 * Mặt bằng từng căn là SƠ ĐỒ, không phải bản vẽ kiến trúc: khung được xoay theo trục dài,
 * chia thành hai dãy căn hai bên hành lang (kiểu chung cư mini / căn hộ dịch vụ phổ biến),
 * rồi cắt theo đúng đường viền bằng thuật toán Sutherland–Hodgman. Đủ để người tìm nhà thấy
 * căn nằm ở tầng mấy, phía nào, còn trống hay không — không giả vờ chính xác tới từng bức
 * tường.
 */
import type { BuildingUnit, LngLat, UnitStatusCode } from "@/lib/api/buildingModel";

type XY = [number, number];

const M_PER_DEG = 111_320;
/** Khe giữa hai tầng (m) — để mắt đọc được ranh giới tầng trên khối 3D. */
const SLAB_GAP = 0.35;

// ==================== Chiếu toạ độ ====================

/** Phép chiếu phẳng quanh một điểm gốc — sai số không đáng kể ở cỡ một toà nhà. */
export function makeProjection(origin: LngLat) {
  const kx = M_PER_DEG * Math.cos((origin[1] * Math.PI) / 180);
  return {
    toXY: (p: LngLat): XY => [(p[0] - origin[0]) * kx, (p[1] - origin[1]) * M_PER_DEG],
    toLngLat: (p: XY): LngLat => [origin[0] + p[0] / kx, origin[1] + p[1] / M_PER_DEG],
  };
}

export function centroid(ring: LngLat[]): LngLat {
  const n = ring.length || 1;
  return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
}

function signedArea(poly: XY[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Diện tích khung (m²). */
export function footprintArea(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const proj = makeProjection(centroid(ring));
  return Math.abs(signedArea(ring.map(proj.toXY)));
}

/** Bỏ điểm khép vòng trùng điểm đầu (vòng từ bản đồ thường khép kín). */
export function openRing(ring: LngLat[]): LngLat[] {
  if (ring.length > 1) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) return ring.slice(0, -1);
  }
  return ring;
}

/** Hình chữ nhật rộng × sâu (m), xoay `rotateDeg` độ, tâm tại `center`. */
export function rectangleFootprint(
  center: LngLat,
  width: number,
  depth: number,
  rotateDeg: number,
): LngLat[] {
  const proj = makeProjection(center);
  const r = (rotateDeg * Math.PI) / 180;
  const hw = width / 2;
  const hd = depth / 2;
  return (
    [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ] as XY[]
  ).map(([x, y]) =>
    roundLngLat(
      proj.toLngLat([x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]),
    ),
  );
}

function roundLngLat(p: LngLat): LngLat {
  return [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7];
}

// ==================== Chia mặt bằng ====================

/** Hướng trục dài: thử hướng của từng cạnh, lấy hướng cho hình chữ nhật bao nhỏ nhất. */
function principalAngle(poly: XY[]): number {
  let best = { angle: 0, area: Infinity };
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const b = bounds(rotate(poly, -angle));
    const area = (b.maxX - b.minX) * (b.maxY - b.minY);
    if (area < best.area - 1e-6) best = { angle, area };
  }
  // Xoay thêm 90° nếu cần để trục X luôn là chiều DÀI.
  const b = bounds(rotate(poly, -best.angle));
  return b.maxX - b.minX >= b.maxY - b.minY ? best.angle : best.angle + Math.PI / 2;
}

function rotate(poly: XY[], a: number): XY[] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return poly.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

function bounds(poly: XY[]) {
  return {
    minX: Math.min(...poly.map((p) => p[0])),
    maxX: Math.max(...poly.map((p) => p[0])),
    minY: Math.min(...poly.map((p) => p[1])),
    maxY: Math.max(...poly.map((p) => p[1])),
  };
}

/** Cắt đa giác `subject` (lồi hay lõm đều được) bằng hình chữ nhật trục thẳng — Sutherland–Hodgman. */
function clipToRect(subject: XY[], r: { x0: number; x1: number; y0: number; y1: number }): XY[] {
  const edges: [(p: XY) => boolean, (a: XY, b: XY) => XY][] = [
    [(p) => p[0] >= r.x0, (a, b) => lerpX(a, b, r.x0)],
    [(p) => p[0] <= r.x1, (a, b) => lerpX(a, b, r.x1)],
    [(p) => p[1] >= r.y0, (a, b) => lerpY(a, b, r.y0)],
    [(p) => p[1] <= r.y1, (a, b) => lerpY(a, b, r.y1)],
  ];
  let out = subject;
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    if (input.length === 0) break;
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cut(prev, cur));
      }
    }
  }
  return out;
}

function lerpX(a: XY, b: XY, x: number): XY {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + t * (b[1] - a[1])];
}
function lerpY(a: XY, b: XY, y: number): XY {
  const t = (y - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), y];
}

/**
 * Chia khung thành `n` ô theo kiểu hai dãy căn hai bên hành lang. Trả về các ô theo thứ tự
 * đi vòng: dãy trước từ trái sang phải, dãy sau từ phải sang trái — nên P.x01 và P.x0n nằm
 * cạnh nhau ở cùng một đầu, như cách đánh số căn ngoài đời.
 */
export function subdivide(ring: LngLat[], n: number): LngLat[][] {
  if (ring.length < 3 || n < 1) return [];
  const origin = centroid(ring);
  const proj = makeProjection(origin);
  const poly = ring.map(proj.toXY);
  const angle = principalAngle(poly);
  const local = rotate(poly, -angle);
  const b = bounds(local);
  const depth = b.maxY - b.minY;

  const twoRows = n >= 4 && depth >= 8;
  const corridor = twoRows ? Math.min(1.6, depth * 0.12) : 0;
  const rows = twoRows ? [Math.ceil(n / 2), Math.floor(n / 2)] : [n];
  const rowH = (depth - corridor) / rows.length;
  const gap = 0.3; // nửa bề dày vách giữa hai căn

  const cells: LngLat[][] = [];
  rows.forEach((count, ri) => {
    const y0 = b.minY + ri * (rowH + corridor);
    const w = (b.maxX - b.minX) / count;
    const order = Array.from({ length: count }, (_, i) => (ri === 0 ? i : count - 1 - i));
    for (const ci of order) {
      const rect = {
        x0: b.minX + ci * w + (ci > 0 ? gap : 0),
        x1: b.minX + (ci + 1) * w - (ci < count - 1 ? gap : 0),
        y0: y0 + (ri > 0 ? gap : 0),
        y1: y0 + rowH - (ri < rows.length - 1 ? gap : 0),
      };
      const clipped = clipToRect(local, rect);
      if (clipped.length < 3 || Math.abs(signedArea(clipped)) < 0.5) {
        cells.push([]); // khung lõm quá: ô này rơi ra ngoài — căn vẫn có trong danh sách
        continue;
      }
      cells.push(rotate(clipped, angle).map(proj.toLngLat));
    }
  });
  return cells;
}

// ==================== GeoJSON cho Mapbox ====================

/** Sắp xếp tên căn tự nhiên: "P.2" trước "P.10". */
const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

export type CellKind = "listed" | "vacant" | "occupied" | "maintenance" | "slab";

export const CELL_COLORS: Record<CellKind, string> = {
  listed: "#10b981",
  vacant: "#a7f3d0",
  occupied: "#94a3b8",
  maintenance: "#f59e0b",
  slab: "#c7d2fe",
};

export const CELL_LABELS: Record<CellKind, string> = {
  listed: "Trống · đang đăng tin",
  vacant: "Trống",
  occupied: "Đã có người",
  maintenance: "Đang sửa",
  slab: "Chưa khai căn",
};

export function cellKind(u: Pick<BuildingUnit, "status" | "listing"> | null): CellKind {
  if (!u) return "slab";
  if (u.listing) return "listed";
  const s: UnitStatusCode = u.status;
  return s === 1 ? "vacant" : s === 3 ? "maintenance" : "occupied";
}

export interface BuildingInput {
  footprint: LngLat[];
  floors: number;
  floorHeightMeters: number;
  units: BuildingUnit[];
}

/** Các căn theo tầng (tầng 1..floors). Căn chưa gắn tầng không vẽ được — trả riêng. */
export function unitsByFloor(b: BuildingInput) {
  const map = new Map<number, BuildingUnit[]>();
  const unplaced: BuildingUnit[] = [];
  for (const u of b.units) {
    if (u.floor == null || u.floor < 1 || u.floor > b.floors) unplaced.push(u);
    else map.set(u.floor, [...(map.get(u.floor) ?? []), u]);
  }
  for (const list of map.values()) list.sort((a, c) => collator.compare(a.name, c.name));
  return { map, unplaced };
}

export interface CellProps {
  id: string;
  floor: number;
  unitId: string | null;
  name: string;
  kind: CellKind;
  base: number;
  top: number;
}

/** Toàn bộ khối căn của toà nhà — mỗi tầng chia lại theo số căn của chính tầng đó. */
export function buildCells(
  b: BuildingInput,
): GeoJSON.FeatureCollection<GeoJSON.Polygon, CellProps> {
  const ring = openRing(b.footprint);
  const { map } = unitsByFloor(b);
  const features: GeoJSON.Feature<GeoJSON.Polygon, CellProps>[] = [];
  const cache = new Map<number, LngLat[][]>();
  for (let f = 1; f <= b.floors; f++) {
    const units = map.get(f) ?? [];
    const n = Math.max(units.length, 1);
    if (!cache.has(n)) cache.set(n, subdivide(ring, n));
    const cells = units.length ? cache.get(n)! : [ring];
    const base = (f - 1) * b.floorHeightMeters;
    const top = f * b.floorHeightMeters - SLAB_GAP;
    cells.forEach((cell, i) => {
      if (cell.length < 3) return;
      const u = units[i] ?? null;
      features.push({
        type: "Feature",
        id: features.length + 1,
        properties: {
          id: u?.id ?? `slab-${f}`,
          floor: f,
          unitId: u?.id ?? null,
          name: u?.name ?? `Tầng ${f}`,
          kind: cellKind(u),
          base,
          top,
        },
        geometry: { type: "Polygon", coordinates: [[...cell, cell[0]]] },
      });
    });
  }
  return { type: "FeatureCollection", features };
}

/** Đường viền khung (để vẽ nét và để xưởng dựng hiện khung đang sửa). */
export function footprintFeature(ring: LngLat[]): GeoJSON.Feature<GeoJSON.Polygon> | null {
  const r = openRing(ring);
  if (r.length < 3) return null;
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [[...r, r[0]]] },
  };
}
