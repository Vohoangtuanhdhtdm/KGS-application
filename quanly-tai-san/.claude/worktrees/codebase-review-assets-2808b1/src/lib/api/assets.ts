import { api, toQuery } from "./http";
import { apiForm } from "./http";
import { ApiError } from "@/lib/auth/types";
import type {
  AssetStatusCode,
  AssetTypeCode,
  EquipmentConditionCode,
  EquipmentSourceCode,
  OccupantTypeCode,
  OwnershipTypeCode,
  SaleListingStatusCode,
  UnitStatusCode,
} from "@/constants/enums";

// ---- Types ----
export interface AssetAddress {
  city: string;
  district: string;
  ward: string;
  detail?: string | null;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface AssetListItem {
  id: string;
  name: string;
  type: AssetTypeCode;
  ownershipType: OwnershipTypeCode;
  status: AssetStatusCode;
  city: string;
  district: string;
  currentValue: number | null;
  thumbnailUrl: string | null;
  linkedPropertyId?: string | null;
}

export interface AssetMediaFile {
  url: string;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface AssetDetail {
  id: string;
  name: string;
  type: AssetTypeCode;
  ownershipType: OwnershipTypeCode;
  status: AssetStatusCode;
  address: AssetAddress;
  location: GeoLocation | null;
  area: number | null;
  currentValue: number | null;
  acquisitionDate: string | null;
  notes: string | null;
  thumbnail: AssetMediaFile | null;
  linkedPropertyId: string | null;
  unitCount: number;
  activeContractCount: number;
  createdAt: string;
  updatedAt: string;
  // Thông tin mô tả chi tiết — điền một lần, tái dùng khi đăng tin công khai
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  houseDirection: string | null;
  legalStatus: string | null;
  furnitureState: string | null;
}

/** 6 trường mô tả chi tiết, dùng chung giữa form tạo/sửa tài sản và form đăng tin. */
export interface AssetDetailSpecs {
  floors?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  houseDirection?: string | null;
  legalStatus?: string | null;
  furnitureState?: string | null;
}

export interface CreateAssetInput extends AssetDetailSpecs {
  name: string;
  type: AssetTypeCode;
  ownershipType: OwnershipTypeCode;
  address: AssetAddress;
  location?: GeoLocation | null;
  area?: number | null;
  currentValue?: number | null;
  acquisitionDate?: string | null;
  notes?: string | null;
}

export interface UpdateAssetInput extends CreateAssetInput {
  status: AssetStatusCode;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface AssetListFilters {
  keyword?: string;
  type?: AssetTypeCode | "";
  status?: AssetStatusCode | "";
  ownershipType?: OwnershipTypeCode | "";
  city?: string;
  page?: number;
  pageSize?: number;
}

export interface NearbyAsset {
  id: string;
  name: string;
  type: AssetTypeCode;
  status: AssetStatusCode;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

// ---- Units ----
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

// ---- Media ----
export interface AssetMediaItem {
  id: string;
  file: AssetMediaFile;
  caption: string | null;
  takenAt: string | null;
  sortOrder: number;
}

// ---- Nhóm D: Vận hành ----
export interface EquipmentDto {
  id: string;
  assetUnitId: string | null;
  name: string;
  quantity: number;
  condition: EquipmentConditionCode;
  source: EquipmentSourceCode;
  notes: string | null;
}

export interface EquipmentInput {
  assetUnitId?: string | null;
  name: string;
  quantity: number;
  condition: EquipmentConditionCode;
  source: EquipmentSourceCode;
  notes?: string | null;
}

export interface UsagePeriodDto {
  id: string;
  occupantType: OccupantTypeCode;
  occupantName: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
}

export interface UsagePeriodInput {
  occupantType: OccupantTypeCode;
  occupantName?: string | null;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
}

export interface MaintenanceDto {
  id: string;
  assetUnitId: string | null;
  title: string;
  description: string | null;
  startDate: string;
  completedDate: string | null;
  cost: number | null;
  vendorId: string | null;
  vendorName: string | null;
  notes: string | null;
}

export interface MaintenanceInput {
  assetUnitId?: string | null;
  title: string;
  description?: string | null;
  startDate: string;
  completedDate?: string | null;
  cost?: number | null;
  vendorId?: string | null;
  notes?: string | null;
  recordAsExpense: boolean;
}

export interface SaleListingBroker {
  brokerId: string;
  brokerName: string;
  phone: string | null;
  sentAt: string;
  notes: string | null;
}

export interface SaleListingDto {
  id: string;
  assetId: string;
  askingPrice: number;
  status: SaleListingStatusCode;
  listedAt: string;
  agreementNotes: string | null;
  brokers: SaleListingBroker[];
}

export interface SaleListingCreateInput {
  askingPrice: number;
  agreementNotes?: string | null;
}

export interface SaleListingUpdateInput {
  askingPrice: number;
  status: SaleListingStatusCode;
  agreementNotes?: string | null;
}

// ---- API functions ----
export const assetsApi = {
  list: (f: AssetListFilters = {}) =>
    api<PagedResult<AssetListItem>>(
      `/assets${toQuery({ ...f, page: f.page ?? 1, pageSize: f.pageSize ?? 20 })}`,
    ),
  detail: (id: string) => api<AssetDetail>(`/assets/${id}`),
  create: (body: CreateAssetInput) => api<AssetDetail>("/assets", { method: "POST", body }),
  update: (id: string, body: UpdateAssetInput) =>
    api<AssetDetail>(`/assets/${id}`, { method: "PUT", body }),
  remove: (id: string) => api<void>(`/assets/${id}`, { method: "DELETE" }),
  nearby: (lat: number, lng: number, radiusMeters: number, limit = 50) =>
    api<NearbyAsset[]>(
      `/assets/nearby${toQuery({ latitude: lat, longitude: lng, radiusMeters, limit })}`,
    ),

  units: {
    list: (assetId: string) => api<AssetUnit[]>(`/assets/${assetId}/units`),
    create: (assetId: string, body: UnitInput) =>
      api<AssetUnit>(`/assets/${assetId}/units`, { method: "POST", body }),
    update: (assetId: string, unitId: string, body: UnitInput) =>
      api<AssetUnit>(`/assets/${assetId}/units/${unitId}`, { method: "PUT", body }),
    remove: (assetId: string, unitId: string) =>
      api<void>(`/assets/${assetId}/units/${unitId}`, { method: "DELETE" }),
  },

  media: {
    list: (assetId: string) => api<AssetMediaItem[]>(`/assets/${assetId}/media`),
    upload: (assetId: string, files: File[], caption?: string, takenAt?: string) => {
      const fd = new FormData();
      for (const f of files) fd.append("Files", f);
      if (caption) fd.append("Caption", caption);
      if (takenAt) fd.append("TakenAt", takenAt);
      return apiForm<AssetMediaItem[]>(`/assets/${assetId}/media`, fd, "POST");
    },
    remove: (assetId: string, mediaId: string) =>
      api<void>(`/assets/${assetId}/media/${mediaId}`, { method: "DELETE" }),
    setThumbnail: (assetId: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiForm<AssetDetail>(`/assets/${assetId}/thumbnail`, fd, "PUT");
    },
    setThumbnailFromMedia: (assetId: string, mediaId: string) =>
      api<AssetDetail>(`/assets/${assetId}/thumbnail/from-media/${mediaId}`, { method: "PUT" }),
  },

  equipment: {
    list: (assetId: string) => api<EquipmentDto[]>(`/assets/${assetId}/equipment`),
    create: (assetId: string, body: EquipmentInput) =>
      api<EquipmentDto>(`/assets/${assetId}/equipment`, { method: "POST", body }),
    update: (assetId: string, equipmentId: string, body: EquipmentInput) =>
      api<EquipmentDto>(`/assets/${assetId}/equipment/${equipmentId}`, { method: "PUT", body }),
    remove: (assetId: string, equipmentId: string) =>
      api<void>(`/assets/${assetId}/equipment/${equipmentId}`, { method: "DELETE" }),
  },

  usagePeriods: {
    list: (assetId: string) => api<UsagePeriodDto[]>(`/assets/${assetId}/usage-periods`),
    create: (assetId: string, body: UsagePeriodInput) =>
      api<UsagePeriodDto>(`/assets/${assetId}/usage-periods`, { method: "POST", body }),
    update: (assetId: string, periodId: string, body: UsagePeriodInput) =>
      api<UsagePeriodDto>(`/assets/${assetId}/usage-periods/${periodId}`, {
        method: "PUT",
        body,
      }),
    remove: (assetId: string, periodId: string) =>
      api<void>(`/assets/${assetId}/usage-periods/${periodId}`, { method: "DELETE" }),
  },

  maintenance: {
    list: (assetId: string) => api<MaintenanceDto[]>(`/assets/${assetId}/maintenance`),
    create: (assetId: string, body: MaintenanceInput) =>
      api<MaintenanceDto>(`/assets/${assetId}/maintenance`, { method: "POST", body }),
    update: (assetId: string, recordId: string, body: MaintenanceInput) =>
      api<MaintenanceDto>(`/assets/${assetId}/maintenance/${recordId}`, { method: "PUT", body }),
    remove: (assetId: string, recordId: string) =>
      api<void>(`/assets/${assetId}/maintenance/${recordId}`, { method: "DELETE" }),
  },

  saleListing: {
    // 404 = tài sản chưa có tin rao bán → trả null thay vì ném lỗi
    get: async (assetId: string): Promise<SaleListingDto | null> => {
      try {
        return await api<SaleListingDto>(`/assets/${assetId}/sale-listing`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    create: (assetId: string, body: SaleListingCreateInput) =>
      api<SaleListingDto>(`/assets/${assetId}/sale-listing`, { method: "POST", body }),
    update: (assetId: string, body: SaleListingUpdateInput) =>
      api<SaleListingDto>(`/assets/${assetId}/sale-listing`, { method: "PUT", body }),
    addBroker: (assetId: string, body: { brokerId: string; notes?: string | null }) =>
      api<SaleListingDto>(`/assets/${assetId}/sale-listing/brokers`, { method: "POST", body }),
    removeBroker: (assetId: string, brokerId: string) =>
      api<void>(`/assets/${assetId}/sale-listing/brokers/${brokerId}`, { method: "DELETE" }),
    markSold: (assetId: string) =>
      api<SaleListingDto>(`/assets/${assetId}/sale-listing/mark-sold`, { method: "POST" }),
  },
};
