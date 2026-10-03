import { AMENITIES, type AmenityKey } from "@/constants/enums";
import type { SavedSearchCriteria } from "@/lib/api/savedSearches";
import { formatCurrency } from "@/lib/format";

/**
 * Điều kiện riêng của tin THUÊ: tổng chi phí, nội quy, ngày dọn vào, tiện nghi bắt buộc.
 *
 * API đã lọc được các điều kiện này từ lâu (đó là bộ lọc cứng của trợ lý), nhưng trang tìm
 * kiếm chưa có chỗ giữ chúng — nên trước đây chỉ bộ lọc đã lưu mới dùng tới. Trợ lý điền vào
 * đây, và người dùng gỡ từng điều kiện ở hàng chip như mọi bộ lọc khác.
 */
export interface RentTerms {
  totalCostMax: number | null;
  petsAllowed: boolean | null;
  curfewFree: boolean | null;
  sharedWithOwner: boolean | null;
  availableBy: string | null;
  amenities: string[];
}

export const EMPTY_RENT_TERMS: RentTerms = {
  totalCostMax: null,
  petsAllowed: null,
  curfewFree: null,
  sharedWithOwner: null,
  availableBy: null,
  amenities: [],
};

export const isEmptyRentTerms = (t: RentTerms) =>
  t.totalCostMax == null &&
  t.petsAllowed == null &&
  t.curfewFree == null &&
  t.sharedWithOwner == null &&
  t.availableBy == null &&
  t.amenities.length === 0;

export function rentTermsFromCriteria(c: SavedSearchCriteria): RentTerms {
  return {
    totalCostMax: c.totalCostMax ?? null,
    petsAllowed: c.petsAllowed ?? null,
    curfewFree: c.curfewFree ?? null,
    sharedWithOwner: c.sharedWithOwner ?? null,
    availableBy: c.availableBy ? c.availableBy.slice(0, 10) : null,
    amenities: c.amenities ?? [],
  };
}

export function rentTermsToSearchParams(t: RentTerms) {
  return {
    totalCostMax: t.totalCostMax ?? ("" as const),
    petsAllowed: t.petsAllowed ?? ("" as const),
    curfewFree: t.curfewFree ?? ("" as const),
    sharedWithOwner: t.sharedWithOwner ?? ("" as const),
    availableBy: t.availableBy ?? undefined,
    amenities: t.amenities.length ? t.amenities : undefined,
  };
}

export function rentTermChips(
  t: RentTerms,
  set: (next: RentTerms) => void,
): { key: string; label: string; clear: () => void }[] {
  const out: { key: string; label: string; clear: () => void }[] = [];
  if (t.totalCostMax != null)
    out.push({
      key: "totalCost",
      label: `Tổng chi phí ≤ ${formatCurrency(t.totalCostMax, { compact: true })}`,
      clear: () => set({ ...t, totalCostMax: null }),
    });
  if (t.petsAllowed)
    out.push({
      key: "pets",
      label: "Cho nuôi thú cưng",
      clear: () => set({ ...t, petsAllowed: null }),
    });
  if (t.curfewFree)
    out.push({
      key: "curfew",
      label: "Giờ giấc tự do",
      clear: () => set({ ...t, curfewFree: null }),
    });
  if (t.sharedWithOwner === false)
    out.push({
      key: "shared",
      label: "Không chung chủ",
      clear: () => set({ ...t, sharedWithOwner: null }),
    });
  if (t.availableBy)
    out.push({
      key: "availableBy",
      label: `Dọn vào trước ${new Date(t.availableBy).toLocaleDateString("vi-VN")}`,
      clear: () => set({ ...t, availableBy: null }),
    });
  if (t.amenities.length)
    out.push({
      key: "amenities",
      label: `Phải có: ${t.amenities.map((a) => AMENITIES[a as AmenityKey] ?? a).join(", ")}`,
      clear: () => set({ ...t, amenities: [] }),
    });
  return out;
}
