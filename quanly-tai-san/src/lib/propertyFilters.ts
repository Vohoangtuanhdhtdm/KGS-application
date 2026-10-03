import {
  ASSET_TYPE,
  FURNITURE_STATE_OPTIONS,
  HOUSE_DIRECTIONS,
  LEGAL_STATUS_OPTIONS,
  TYPE_FIELDS,
  type AssetTypeCode,
} from "@/constants/enums";
import type { SavedSearchCriteria } from "@/lib/api/savedSearches";

/** Bộ lọc đặc điểm bất động sản — phủ mọi loại hình, cả mua lẫn thuê. */
export interface PropertyFilterState {
  types: AssetTypeCode[];
  areaMin: number | null;
  areaMax: number | null;
  bathroomsMin: number | null;
  floorsMin: number | null;
  frontageMin: number | null;
  directions: string[];
  legal: string[];
  furniture: string[];
}

export const EMPTY_PROPERTY_FILTERS: PropertyFilterState = {
  types: [],
  areaMin: null,
  areaMax: null,
  bathroomsMin: null,
  floorsMin: null,
  frontageMin: null,
  directions: [],
  legal: [],
  furniture: [],
};

export const DIRECTION_OPTIONS = HOUSE_DIRECTIONS as readonly string[];
export const LEGAL_OPTIONS = LEGAL_STATUS_OPTIONS.filter((x) => x !== "Khác") as string[];
export const FURNITURE_OPTIONS = FURNITURE_STATE_OPTIONS.filter((x) => x !== "Khác") as string[];
/** "Có sổ" — cách người mua thật sự hỏi, gộp các loại giấy chứng nhận. */
export const HAS_TITLE = ["Sổ hồng riêng", "Sổ hồng chung", "Sổ đỏ"];

/** Thứ tự loại hình theo mua/thuê: thứ người ta hay tìm nhất đứng trước. */
export function typeOrder(mode: 1 | 2): AssetTypeCode[] {
  return mode === 2 ? [7, 2, 1, 6, 8, 9, 5, 4, 3, 99] : [1, 2, 3, 5, 4, 6, 8, 9, 99];
}

export type FieldKey = keyof (typeof TYPE_FIELDS)[AssetTypeCode];

/**
 * Trường nào đáng hiện trong bộ lọc.
 *
 * Đã chọn loại hình: hợp của các trường có nghĩa với những loại đó (chọn "Đất" thì không hỏi
 * phòng tắm). Chưa chọn: mặc định theo mua/thuê — người mua quan tâm pháp lý, hướng, mặt
 * tiền; người thuê quan tâm nội thất. Lọc theo một trường không áp dụng sẽ loại oan những
 * tin vốn để trống trường đó.
 */
export function visibleFields(s: PropertyFilterState, mode: 1 | 2): Record<FieldKey, boolean> {
  if (s.types.length > 0) {
    const out = {
      rooms: false,
      floors: false,
      frontage: false,
      direction: false,
      legal: false,
      furniture: false,
    };
    for (const t of s.types)
      for (const k of Object.keys(out) as FieldKey[]) out[k] ||= TYPE_FIELDS[t][k];
    // Đi thuê thì gần như không ai lọc theo sổ hồng.
    if (mode === 2) out.legal = false;
    return out;
  }
  return mode === 1
    ? { rooms: true, floors: true, frontage: true, direction: true, legal: true, furniture: false }
    : {
        rooms: true,
        floors: false,
        frontage: false,
        direction: false,
        legal: false,
        furniture: true,
      };
}

export function countPropertyFilters(s: PropertyFilterState): number {
  return (
    (s.types.length ? 1 : 0) +
    (s.areaMin != null || s.areaMax != null ? 1 : 0) +
    (s.bathroomsMin != null ? 1 : 0) +
    (s.floorsMin != null ? 1 : 0) +
    (s.frontageMin != null ? 1 : 0) +
    (s.directions.length ? 1 : 0) +
    (s.legal.length ? 1 : 0) +
    (s.furniture.length ? 1 : 0)
  );
}

/** Gửi lên API tìm kiếm. */
export function toSearchParams(s: PropertyFilterState) {
  return {
    propertyTypes: s.types.length ? s.types.map(Number) : undefined,
    areaMin: s.areaMin ?? ("" as const),
    areaMax: s.areaMax ?? ("" as const),
    bathroomsMin: s.bathroomsMin ?? ("" as const),
    floorsMin: s.floorsMin ?? ("" as const),
    frontageMin: s.frontageMin ?? ("" as const),
    directions: s.directions.length ? s.directions : undefined,
    legalStatuses: s.legal.length ? s.legal : undefined,
    furnitureStates: s.furniture.length ? s.furniture : undefined,
  };
}

/** Khôi phục từ bộ lọc đã lưu. */
export function fromCriteria(c: SavedSearchCriteria): PropertyFilterState {
  return {
    types: (c.propertyTypes ?? []).filter((t) => t in ASSET_TYPE) as AssetTypeCode[],
    areaMin: c.areaMin ?? null,
    areaMax: c.areaMax ?? null,
    bathroomsMin: c.bathroomsMin ?? null,
    floorsMin: c.floorsMin ?? null,
    frontageMin: c.frontageMin ?? null,
    directions: c.directions ?? [],
    legal: c.legalStatuses ?? [],
    furniture: c.furnitureStates ?? [],
  };
}

/** Các chip "đang lọc", mỗi chip gỡ được riêng. */
export function propertyChips(
  s: PropertyFilterState,
  set: (next: PropertyFilterState) => void,
): { key: string; label: string; clear: () => void }[] {
  const out: { key: string; label: string; clear: () => void }[] = [];
  if (s.types.length)
    out.push({
      key: "types",
      label: s.types.map((t) => ASSET_TYPE[t]).join(" / "),
      clear: () => set({ ...s, types: [] }),
    });
  if (s.areaMin != null || s.areaMax != null)
    out.push({
      key: "area",
      label:
        s.areaMin != null && s.areaMax != null
          ? `${s.areaMin}–${s.areaMax} m²`
          : s.areaMin != null
            ? `Từ ${s.areaMin} m²`
            : `Đến ${s.areaMax} m²`,
      clear: () => set({ ...s, areaMin: null, areaMax: null }),
    });
  if (s.bathroomsMin != null)
    out.push({
      key: "bath",
      label: `Từ ${s.bathroomsMin} phòng tắm`,
      clear: () => set({ ...s, bathroomsMin: null }),
    });
  if (s.floorsMin != null)
    out.push({
      key: "floors",
      label: `Từ ${s.floorsMin} tầng`,
      clear: () => set({ ...s, floorsMin: null }),
    });
  if (s.frontageMin != null)
    out.push({
      key: "frontage",
      label: `Mặt tiền từ ${s.frontageMin} m`,
      clear: () => set({ ...s, frontageMin: null }),
    });
  if (s.directions.length)
    out.push({
      key: "dir",
      label: `Hướng ${s.directions.join(", ")}`,
      clear: () => set({ ...s, directions: [] }),
    });
  if (s.legal.length)
    out.push({
      key: "legal",
      label:
        s.legal.length === HAS_TITLE.length && HAS_TITLE.every((x) => s.legal.includes(x))
          ? "Có sổ"
          : s.legal.join(" / "),
      clear: () => set({ ...s, legal: [] }),
    });
  if (s.furniture.length)
    out.push({
      key: "furn",
      label: `Nội thất: ${s.furniture.join(", ").toLowerCase()}`,
      clear: () => set({ ...s, furniture: [] }),
    });
  return out;
}
