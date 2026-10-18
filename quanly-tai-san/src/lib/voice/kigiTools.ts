import type { AssistantResult } from "@/lib/api/assistant";
import type { PublicListingFilters } from "@/lib/api/listings";
import type { SavedSearchCriteria } from "@/lib/api/savedSearches";
import { describeDemand } from "@/lib/demandSummary";

/**
 * Công cụ của KiGi — phần "não" chạy ở trình duyệt khi Gemini gọi hàm.
 *
 * KiGi không tự trích bộ lọc: mọi câu nói đi qua đúng pipeline trợ lý gõ tay (search-intent, đã
 * đánh giá), rồi các hàm dưới đây biến kết quả thành thứ mô hình đọc lên được. "Còn thiếu gì" và
 * "nới điều kiện nào" tính bằng mã, có số đếm thật — không để mô hình đoán.
 */

export type MissingKey = "thuê hay mua" | "khu vực" | "ngân sách" | "loại nhà";

const has = (v: unknown) => v !== null && v !== undefined && v !== "";

/** Điều quan trọng còn thiếu, theo thứ tự KiGi nên hỏi. Có điểm neo ("gần chợ Bến Thành") là đã có
 *  khu vực — toạ độ của nó chỉ được tìm ở trang Tìm nhà, không nằm trong tiêu chí. */
export function missingInfo(c: SavedSearchCriteria, hasAnchor = false): MissingKey[] {
  const out: MissingKey[] = [];
  if (c.type !== 1 && c.type !== 2) out.push("thuê hay mua");
  if (!hasAnchor && ![c.city, c.district, c.newProvinceCode, c.newWardCode, c.latitude].some(has))
    out.push("khu vực");
  if (![c.priceMin, c.priceMax, c.totalCostMax].some(has)) out.push("ngân sách");
  if (!c.propertyTypes?.length) out.push("loại nhà");
  return out;
}

/** Tiêu chí (null = bỏ trống) → tham số tìm kiếm (bỏ hẳn trường). Chỉ cần tổng số nên pageSize 1. */
export function criteriaToFilters(c: SavedSearchCriteria): PublicListingFilters {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  out.pageSize = 1;
  return out as PublicListingFilters;
}

/** Các cách nới khi 0 căn, theo thứ tự thử: giá trần → loại hình → tiện nghi. */
export function relaxCandidates(
  c: SavedSearchCriteria,
): { bo: string; criteria: SavedSearchCriteria }[] {
  const out: { bo: string; criteria: SavedSearchCriteria }[] = [];
  if (has(c.priceMax) || has(c.totalCostMax)) {
    const removed = { priceMax: c.priceMax, totalCostMax: c.totalCostMax };
    out.push({
      bo: describeDemand(removed).join(", "),
      criteria: { ...c, priceMax: null, totalCostMax: null },
    });
  }
  if (c.propertyTypes?.length)
    out.push({
      bo: describeDemand({ propertyTypes: c.propertyTypes }).join(", "),
      criteria: { ...c, propertyTypes: null },
    });
  if (c.amenities?.length)
    out.push({
      bo: describeDemand({ amenities: c.amenities }).join(", "),
      criteria: { ...c, amenities: null },
    });
  return out;
}

/** Kết quả công cụ trả cho Gemini — tên trường tiếng Việt, khớp lời dặn của KiGi. */
export interface KiGiToolPayload {
  dieu_kien_da_hieu: string[];
  chua_loc_duoc: string[];
  so_can: number;
  /** Có điểm neo (thời gian đi lại hoặc bán kính): số đếm chưa tính vùng quanh điểm neo — trang
   *  Tìm nhà mới tìm toạ độ của nó — nên KiGi phải nói "khoảng". */
  uoc_tinh: boolean;
  con_thieu: MissingKey[];
  goi_y_noi: { bo: string; so_can: number } | null;
}

export function buildToolPayload(
  r: AssistantResult,
  soCan: number,
  goiY: { bo: string; so_can: number } | null,
): KiGiToolPayload {
  return {
    dieu_kien_da_hieu: [...describeDemand(r.criteria), ...r.preferences],
    chua_loc_duoc: r.unrecognized,
    so_can: soCan,
    uoc_tinh: r.anchor != null,
    con_thieu: missingInfo(r.criteria, r.anchor != null),
    goi_y_noi: goiY,
  };
}

export interface KiGiDeps {
  searchIntent: (moTa: string, previous: AssistantResult | null) => Promise<AssistantResult>;
  count: (f: PublicListingFilters) => Promise<number>;
}

/** Thực thi cap_nhat_nhu_cau: cộng dồn bộ lọc, đếm, tìm gợi ý nới khi 0 căn. Không bao giờ ném. */
export async function runCapNhatNhuCau(
  moTa: string,
  previous: AssistantResult | null,
  deps: KiGiDeps,
): Promise<{ result: AssistantResult; payload: KiGiToolPayload } | { loi: string }> {
  try {
    const result = await deps.searchIntent(moTa, previous);
    const soCan = await deps.count(criteriaToFilters(result.criteria));
    let goiY: { bo: string; so_can: number } | null = null;
    if (soCan === 0) {
      for (const cand of relaxCandidates(result.criteria)) {
        const n = await deps.count(criteriaToFilters(cand.criteria));
        if (n > 0) {
          goiY = { bo: cand.bo, so_can: n };
          break;
        }
      }
    }
    return { result, payload: buildToolPayload(result, soCan, goiY) };
  } catch {
    return { loi: "Chưa xử lý được câu này" };
  }
}
