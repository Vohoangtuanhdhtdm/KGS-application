import { api, toQuery } from "./http";
import { apiForm } from "./http";
import type {
  AssetStatusCode,
  AssetTypeCode,
  DocumentTypeCode,
  EquipmentConditionCode,
  EquipmentSourceCode,
  OwnershipTypeCode,
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
  /** Số tin đăng đang chờ duyệt hoặc đang hiển thị của tài sản. */
  listingCount?: number;
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
  listingCount: number;
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

// ---- Bản đồ tài sản ----
/** Tài sản kèm toạ độ để vẽ pin. `latitude`/`longitude` null = chưa gắn vị trí. */
export interface AssetMapItem extends AssetListItem {
  latitude: number | null;
  longitude: number | null;
}

// ---- Giấy tờ ----
export interface AssetDocumentDto {
  id: string;
  assetId: string;
  type: DocumentTypeCode;
  title: string;
  file: AssetMediaFile;
  issueDate: string | null;
  expiryDate: string | null;
  leaseContractId: string | null;
  notes: string | null;
}

export interface AssetDocumentUploadInput {
  file: File;
  type: DocumentTypeCode;
  title: string;
  issueDate: string;
  expiryDate?: string | null;
  leaseContractId?: string | null;
  notes?: string | null;
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

  /**
   * Danh sách tài sản kèm toạ độ, dùng cho dashboard bản đồ.
   *
   * Trả về TOÀN BỘ tài sản của người dùng, kể cả tài sản chưa gắn vị trí (khi đó
   * `latitude`/`longitude` = null) — overlay danh sách cần chúng để còn nhắc bổ sung.
   */
  mapPins: (): Promise<AssetMapItem[]> => api<AssetMapItem[]>("/assets/map-pins"),

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

  documents: {
    list: (assetId: string, type?: DocumentTypeCode) =>
      api<AssetDocumentDto[]>(`/assets/${assetId}/documents${toQuery({ type })}`),
    upload: (assetId: string, input: AssetDocumentUploadInput) => {
      const fd = new FormData();
      fd.append("file", input.file);
      fd.append("type", String(input.type));
      fd.append("title", input.title);
      fd.append("issueDate", input.issueDate);
      if (input.expiryDate) fd.append("expiryDate", input.expiryDate);
      if (input.leaseContractId) fd.append("leaseContractId", input.leaseContractId);
      if (input.notes) fd.append("notes", input.notes);
      return apiForm<AssetDocumentDto>(`/assets/${assetId}/documents`, fd, "POST");
    },
    remove: (assetId: string, documentId: string) =>
      api<void>(`/assets/${assetId}/documents/${documentId}`, { method: "DELETE" }),
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

  maintenance: {
    list: (assetId: string) => api<MaintenanceDto[]>(`/assets/${assetId}/maintenance`),
    create: (assetId: string, body: MaintenanceInput) =>
      api<MaintenanceDto>(`/assets/${assetId}/maintenance`, { method: "POST", body }),
    update: (assetId: string, recordId: string, body: MaintenanceInput) =>
      api<MaintenanceDto>(`/assets/${assetId}/maintenance/${recordId}`, { method: "PUT", body }),
    remove: (assetId: string, recordId: string) =>
      api<void>(`/assets/${assetId}/maintenance/${recordId}`, { method: "DELETE" }),
  },
};
