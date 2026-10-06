import { api } from "./http";
import { ApiError } from "@/lib/auth/types";

/** [lng, lat] */
export type LngLat = [number, number];

/** 1 Trống · 2 Đang ở · 3 Đang sửa — cùng mã với UnitStatus phía máy chủ. */
export type UnitStatusCode = 1 | 2 | 3;

export interface BuildingUnitListing {
  slug: string;
  title: string;
  price: number;
  type: 1 | 2;
  rentPaymentCycle: 1 | 2 | 3 | 4 | null;
  /** Tối đa 6 ảnh đầu của tin. */
  imageUrls?: string[];
}

export interface BuildingUnit {
  id: string;
  name: string;
  floor: number | null;
  area: number | null;
  status: UnitStatusCode;
  listing: BuildingUnitListing | null;
}

export interface BuildingModel {
  assetId: string;
  assetName: string;
  footprint: LngLat[];
  floors: number;
  floorHeightMeters: number;
  published: boolean;
  units: BuildingUnit[];
  focusUnitId: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Ảnh chung của toà nhà (ảnh bìa các tin trong toà) — cho căn chưa có tin. */
  buildingImages?: string[];
}

export interface SaveBuildingModelInput {
  footprint: LngLat[];
  floors: number;
  floorHeightMeters: number;
  published: boolean;
}

export const buildingModelApi = {
  /** Chủ nhà: mô hình của tài sản (khung rỗng khi chưa dựng). */
  forAsset: (assetId: string) => api<BuildingModel>(`/assets/${assetId}/building-model`),
  save: (assetId: string, body: SaveBuildingModelInput) =>
    api<BuildingModel>(`/assets/${assetId}/building-model`, { method: "PUT", body }),
  /** Người tìm nhà: mô hình toà nhà chứa tin này. null = chủ nhà chưa dựng hoặc chưa công khai. */
  forListing: async (slug: string): Promise<BuildingModel | null> => {
    try {
      return await api<BuildingModel>(`/listings/${encodeURIComponent(slug)}/building`, {
        skipAuth: true,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
};

export interface BuildingListingPreview {
  slug: string;
  title: string;
  price: number;
  type: 1 | 2;
  rentPaymentCycle: 1 | 2 | 3 | 4 | null;
  unitName: string | null;
}

/** Toà nhà có mô hình công khai trong khung nhìn bản đồ tìm kiếm. */
export interface MapBuilding {
  assetId: string;
  address: string;
  footprint: LngLat[];
  floors: number;
  floorHeightMeters: number;
  unitCount: number;
  vacantCount: number;
  listingCount: number;
  listings: BuildingListingPreview[];
}

/** Khung nhìn rộng hơn mức này thì máy chủ từ chối — cùng giá trị với MaxViewSpanDegrees. */
export const MAX_VIEW_SPAN_DEG = 0.2;

export const mapBuildingsApi = {
  inView: (
    b: { west: number; south: number; east: number; north: number },
    type: 1 | 2 | null,
    signal?: AbortSignal,
  ) =>
    api<MapBuilding[]>(
      `/listings/buildings?west=${b.west}&south=${b.south}&east=${b.east}&north=${b.north}${type ? `&type=${type}` : ""}`,
      { skipAuth: true, signal },
    ),
};
