import { api } from "./http";
import type { PublicListingFilters } from "./listings";

/**
 * Tiêu chí của một bộ lọc đã lưu.
 *
 * Khác `PublicListingFilters` ở một điểm quan trọng: bộ lọc trên trang tìm kiếm dùng chuỗi
 * rỗng cho "chưa chọn" vì nó đi qua query string, còn cái này đi trong thân JSON. Gửi `""`
 * vào một `decimal?` phía backend sẽ hỏng ngay ở bước model binding, nên phải là `null`.
 */
export interface SavedSearchCriteria {
  type?: number | null;
  city?: string | null;
  district?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  bedroomsMin?: number | null;
  keyword?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
  totalCostMax?: number | null;
  petsAllowed?: boolean | null;
  curfewFree?: boolean | null;
  sharedWithOwner?: boolean | null;
  availableBy?: string | null;
  amenities?: string[] | null;
}

export interface SavedSearchDto {
  id: string;
  name: string;
  criteria: SavedSearchCriteria;
  notifyEnabled: boolean;
  createdAt: string;
  lastNotifiedAt: string | null;
  /** Số tin khớp bộ lọc được duyệt sau lần xem gần nhất — huy hiệu "3 tin mới". */
  newCount: number;
}

/** Đổi bộ lọc của trang tìm kiếm thành tiêu chí lưu được: `""` thành `null`. */
export function toCriteria(f: PublicListingFilters): SavedSearchCriteria {
  const val = <T>(v: T | "" | undefined): T | null =>
    v === "" || v === undefined ? null : v;

  return {
    type: val(f.type),
    city: f.city?.trim() ? f.city.trim() : null,
    district: f.district?.trim() ? f.district.trim() : null,
    priceMin: val(f.priceMin),
    priceMax: val(f.priceMax),
    bedroomsMin: val(f.bedroomsMin),
    keyword: f.keyword?.trim() ? f.keyword.trim() : null,
    latitude: val(f.latitude),
    longitude: val(f.longitude),
    radiusMeters: val(f.radiusMeters),
    totalCostMax: val(f.totalCostMax),
    petsAllowed: val(f.petsAllowed),
    curfewFree: val(f.curfewFree),
    sharedWithOwner: val(f.sharedWithOwner),
    availableBy: f.availableBy?.trim() ? f.availableBy.trim() : null,
    amenities: f.amenities?.length ? f.amenities : null,
  };
}

export const savedSearchesApi = {
  list: () => api<SavedSearchDto[]>("/saved-searches"),

  create: (name: string, criteria: SavedSearchCriteria, notifyEnabled = true) =>
    api<SavedSearchDto>("/saved-searches", {
      method: "POST",
      body: { name, criteria, notifyEnabled },
    }),

  setNotify: (id: string, enabled: boolean) =>
    api<SavedSearchDto>(`/saved-searches/${id}/notify?enabled=${enabled}`, { method: "PATCH" }),

  markSeen: (id: string) => api<void>(`/saved-searches/${id}/seen`, { method: "POST" }),

  remove: (id: string) => api<void>(`/saved-searches/${id}`, { method: "DELETE" }),
};
