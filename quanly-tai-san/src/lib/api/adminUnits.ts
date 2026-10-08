import { api, toQuery } from "./http";

/** Đơn vị hành chính sau sắp xếp 2025 (34 tỉnh, bỏ cấp quận) — xem AdminUnitsController. */
export interface NewWardInfo {
  code: string;
  name: string;
  provinceCode: string;
}

export interface NewAddress {
  provinceCode: string;
  province: string;
  wardCode: string;
  ward: string;
  /** Phường cũ bị chia cho nhiều phường mới. */
  ambiguous: boolean;
}

export interface ResolveResult {
  address: NewAddress | null;
  candidates: NewWardInfo[];
}

export type WardBoundary = GeoJSON.Feature<
  GeoJSON.MultiPolygon,
  { code: string; name: string; province: string }
>;

export const adminUnitsApi = {
  /** Đường viền phường mới (OpenStreetMap, đã đơn giản hoá); null khi chưa có dữ liệu. */
  boundary: async (wardCode: string, signal?: AbortSignal): Promise<WardBoundary | null> => {
    try {
      return await api<WardBoundary>(
        `/admin-units/wards/${encodeURIComponent(wardCode)}/boundary`,
        {
          skipAuth: true,
          signal,
        },
      );
    } catch {
      return null; // 404: tỉnh này chưa có ranh giới — bản đồ không khoanh vùng, vẫn lọc bình thường
    }
  },
  /** Địa chỉ cũ (tỉnh, quận, phường) → địa chỉ mới. */
  resolve: (city: string, district: string, ward: string) =>
    api<ResolveResult>(`/admin-units/resolve${toQuery({ city, district, ward })}`, {
      skipAuth: true,
    }),
};
