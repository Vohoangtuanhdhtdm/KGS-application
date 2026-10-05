import type { BuildingUnit } from "@/lib/api/buildingModel";
import type { OwnerBuilding, OwnerBuildingUnit } from "@/lib/api/buildings";

/**
 * Căn của chủ nhà → dạng căn mà hình mặt đứng / mô hình dùng. Chỉ tin ĐANG HIỂN THỊ mới tô
 * màu "trống · đang đăng tin" — bản nháp hay tin chờ duyệt thì người tìm nhà chưa thấy.
 */
export function toFacadeUnits(units: OwnerBuildingUnit[]): BuildingUnit[] {
  return units.map((u) => ({
    id: u.id,
    name: u.name,
    floor: u.floor,
    area: u.area,
    status: u.status,
    listing:
      u.listingStatus === 2 && u.listingSlug
        ? { slug: u.listingSlug, title: "", price: 0, type: 2, rentPaymentCycle: null }
        : null,
  }));
}

/** Căn đăng tin được ngay: chưa có tin nào chưa đóng. */
export const isPostable = (u: OwnerBuildingUnit) => u.listingId == null;

export function buildingStats(b: OwnerBuilding) {
  return {
    units: b.units.length,
    vacant: b.units.filter((u) => u.status === 1).length,
    live: b.units.filter((u) => u.listingStatus === 2).length,
    postable: b.units.filter((u) => isPostable(u) && u.status === 1).length,
  };
}
