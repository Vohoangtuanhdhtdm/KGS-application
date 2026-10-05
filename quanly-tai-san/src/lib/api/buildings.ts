import { api } from "./http";
import type { ListingStatusCode, UnitStatusCode } from "@/constants/enums";

/** Một căn trong toà nhà của chủ nhà, kèm tin CHƯA ĐÓNG của căn đó (nếu có). */
export interface OwnerBuildingUnit {
  id: string;
  name: string;
  floor: number | null;
  area: number | null;
  status: UnitStatusCode;
  listingId: string | null;
  listingStatus: ListingStatusCode | null;
  listingSlug: string | null;
}

export interface OwnerBuilding {
  assetId: string;
  name: string;
  propertyType: number;
  city: string;
  district: string;
  ward: string;
  addressDetail: string;
  latitude: number | null;
  longitude: number | null;
  floors: number;
  hasModel: boolean;
  published: boolean;
  units: OwnerBuildingUnit[];
}

export interface CreateBuildingInput {
  name: string | null;
  propertyType: number;
  city: string;
  district: string;
  ward: string;
  addressDetail: string | null;
  latitude: number;
  longitude: number;
  floors: number;
  unitsPerFloor: number;
  firstUnitFloor: number;
  unitArea: number | null;
}

export const buildingsApi = {
  /** Toà nhà / khu trọ nhiều căn của tôi. */
  mine: () => api<OwnerBuilding[]>("/buildings"),
  create: (body: CreateBuildingInput) => api<OwnerBuilding>("/buildings", { method: "POST", body }),
};
