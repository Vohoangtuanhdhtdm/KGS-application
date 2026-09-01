// types/asset.ts
// Sinh trực tiếp từ Dtos.cs của backend — KHÔNG tự thêm/bớt field.
// Field optional (?) tương ứng đúng property nullable (Type?) phía C#.

// ---------- SHARED ----------
export interface AddressDto {
  city: string;
  district: string;
  ward: string;
  detail: string;
}

export interface GeoPointDto {
  latitude: number;
  longitude: number;
}

export interface StoredFileDto {
  url: string;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
}

// ---------- ENUM ----------
export enum AssetType {
  PrivateHouse = 1, Apartment = 2, Land = 3, Villa = 4,
  Shophouse = 5, Office = 6, Other = 99,
}

export enum AssetOwnershipType {
  Owned = 1, Leasehold = 2,
}

export enum AssetStatus {
  InUse = 1, RentedOut = 2, ForSale = 3, Vacant = 4, Sold = 5, LeaseEnded = 6,
}

export enum UnitStatus {
  Vacant = 1, Occupied = 2, UnderMaintenance = 3,
}

// ---------- REQUEST BODIES ----------
export interface AssetCreateRequest {
  name: string;
  type: AssetType;
  ownershipType: AssetOwnershipType;
  address: AddressDto;
  location?: GeoPointDto | null;
  area?: number | null;
  currentValue?: number | null;
  acquisitionDate?: string | null;
  notes?: string | null;
}

/** PUT /api/assets/{id} — KHÔNG có ownershipType (không sửa được sau khi tạo). */
export interface AssetUpdateRequest {
  name: string;
  type: AssetType;
  status: AssetStatus;
  address: AddressDto;
  location?: GeoPointDto | null;
  area?: number | null;
  currentValue?: number | null;
  acquisitionDate?: string | null;
  notes?: string | null;
}

export interface AssetSearchQuery {
  keyword?: string;
  type?: AssetType;
  status?: AssetStatus;
  ownershipType?: AssetOwnershipType;
  city?: string;
  page?: number;
  pageSize?: number;
}

export interface NearbyQuery {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  limit?: number;
}

export interface AssetUnitRequest {
  name: string;
  floorNumber?: number | null;
  area?: number | null;
  notes?: string | null;
}

// ---------- RESPONSE DTOs ----------
export interface AssetSummaryDto {
  id: string;
  name: string;
  type: AssetType;
  ownershipType: AssetOwnershipType;
  status: AssetStatus;
  city: string;
  district: string;
  currentValue: number | null;
  thumbnailUrl: string | null;
  linkedPropertyId: number | null;
}

export interface AssetNearbyDto {
  id: string;
  name: string;
  type: AssetType;
  status: AssetStatus;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

export interface AssetDetailDto {
  id: string;
  name: string;
  type: AssetType;
  ownershipType: AssetOwnershipType;
  status: AssetStatus;
  address: AddressDto;
  location: GeoPointDto | null;
  area: number | null;
  currentValue: number | null;
  acquisitionDate: string | null;
  notes: string | null;
  thumbnail: StoredFileDto | null;
  linkedPropertyId: number | null;
  unitCount: number;
  activeContractCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface AssetUnitDto {
  id: string;
  name: string;
  floorNumber: number | null;
  area: number | null;
  status: UnitStatus;
  notes: string | null;
}

export interface AssetMediaDto {
  id: string;
  file: StoredFileDto;
  caption: string | null;
  takenAt: string;
  sortOrder: number;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}