import { api } from "./http";
import type { UnitStatusCode } from "@/constants/enums";

/**
 * Căn/phòng của một toà nhà (Asset nhiều căn) — trang Toà nhà dùng để thêm, sửa, xoá căn.
 *
 * Phần còn lại của API tài sản (danh sách, hồ sơ, ảnh, giấy tờ, bản đồ tài sản) thuộc khu quản
 * lý tài sản đã gỡ khỏi đề tài; tạo toà nhà đi qua lib/api/buildings.ts, đăng tin qua listings.
 */
export interface AssetUnit {
  id: string;
  name: string;
  floorNumber: number | null;
  area: number | null;
  status: UnitStatusCode;
  notes: string | null;
}

export interface UnitInput {
  name: string;
  floorNumber?: number | null;
  area?: number | null;
  status?: UnitStatusCode;
  notes?: string | null;
}

export const assetsApi = {
  units: {
    list: (assetId: string) => api<AssetUnit[]>(`/assets/${assetId}/units`),
    create: (assetId: string, body: UnitInput) =>
      api<AssetUnit>(`/assets/${assetId}/units`, { method: "POST", body }),
    update: (assetId: string, unitId: string, body: UnitInput) =>
      api<AssetUnit>(`/assets/${assetId}/units/${unitId}`, { method: "PUT", body }),
    remove: (assetId: string, unitId: string) =>
      api<void>(`/assets/${assetId}/units/${unitId}`, { method: "DELETE" }),
  },
};
