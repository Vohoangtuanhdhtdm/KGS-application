import { api, toQuery } from "./http";
import type { PagedResult } from "./assets";
import type { ListingTypeCode, PaymentCycleCode, PropertyStatusCode } from "@/constants/enums";
import { PAYMENT_CYCLE } from "@/constants/enums";
import { formatCurrency } from "@/lib/format";

// ---- Types ----
export interface PublicPropertySummaryDto {
  id: string;
  slug: string;
  title: string;
  type: ListingTypeCode;
  price: number;
  rentPaymentCycle: PaymentCycleCode | null;
  city: string;
  district: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  thumbnailUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  // patch-10: có giá trị khi tìm kèm toạ độ (Giai đoạn 2), null khi lọc theo City/District như hiện tại
  distanceMeters: number | null;
  // Giả định optional — API hiện tại (theo đặc tả patch-10) không xác nhận có field này ở
  // summary DTO; để optional + render có điều kiện, không giả định sai nếu backend chưa trả về.
  createdAt?: string | null;
}

export interface PublicPropertyDetailDto {
  id: string;
  slug: string;
  title: string;
  type: ListingTypeCode;
  price: number;
  rentPaymentCycle: PaymentCycleCode | null;
  description: string | null;
  city: string;
  district: string;
  ward: string | null;
  addressDetail: string | null;
  area: number | null;
  frontage: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  houseDirection: string | null;
  legalStatus: string | null;
  furnitureState: string | null;
  propertyType: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[];
  ownerName: string;
  ownerPhone: string;
  createdAt: string;
}

export interface OwnerListingDto {
  id: string;
  slug: string;
  title: string;
  type: ListingTypeCode;
  status: PropertyStatusCode;
  price: number;
  rentPaymentCycle: PaymentCycleCode | null;
  viewCount: number;
  createdAt: string;
  linkedAssetId: string | null;
}

export interface PublicListingFilters {
  type?: ListingTypeCode | "";
  city?: string;
  district?: string;
  priceMin?: number | "";
  priceMax?: number | "";
  bedroomsMin?: number | "";
  keyword?: string;
  // patch-10, tuỳ chọn — chưa dùng ở Giai đoạn 1 (bố cục cốt lõi), để dành Giai đoạn 2
  // (geocoding địa chỉ, "Tìm trong khu vực này")
  latitude?: number | "";
  longitude?: number | "";
  radiusMeters?: number | "";
  page?: number;
  pageSize?: number;
}

export interface CreatePropertyListingInput {
  type: ListingTypeCode;
  title: string;
  description: string;
  price: number;
  rentPaymentCycle?: PaymentCycleCode | null;
  floors?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  frontage?: number | null;
  houseDirection?: string | null;
  legalStatus?: string | null;
  furnitureState?: string | null;
  propertyType?: string | null;
  selectedAssetMediaIds: string[];
}

// ---- Helper hiển thị giá theo loại tin ----
const CYCLE_SUFFIX: Record<PaymentCycleCode, string> = {
  1: "/tháng",
  2: "/quý",
  3: "/6 tháng",
  4: "/năm",
};

export function formatListingPrice(
  price: number,
  type: ListingTypeCode,
  cycle: PaymentCycleCode | null,
): string {
  if (type === 2) {
    const suffix = cycle && PAYMENT_CYCLE[cycle] ? CYCLE_SUFFIX[cycle] : "/tháng";
    return `${formatCurrency(price)}${suffix}`;
  }
  return formatCurrency(price);
}

// ---- API ----
export const propertiesApi = {
  // Công khai — không cần đăng nhập
  search: (f: PublicListingFilters = {}) =>
    api<PagedResult<PublicPropertySummaryDto>>(
      `/property-listings/search${toQuery({ ...f, page: f.page ?? 1, pageSize: f.pageSize ?? 12 })}`,
      { skipAuth: true },
    ),
  detail: (slug: string) =>
    api<PublicPropertyDetailDto>(`/property-listings/${slug}`, { skipAuth: true }),

  // Cần đăng nhập
  myListings: () => api<OwnerListingDto[]>("/property-listings/my-listings"),
  createFromAsset: (assetId: string, body: CreatePropertyListingInput) =>
    api<OwnerListingDto>(`/assets/${assetId}/property-listing`, { method: "POST", body }),
};
