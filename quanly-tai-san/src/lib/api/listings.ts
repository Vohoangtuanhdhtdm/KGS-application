import { api, toQuery } from "./http";
import type { PagedResult } from "./assets";
import type {
  ListingTypeCode,
  PaymentCycleCode,
  ListingStatusCode,
  WaterPricingCode,
} from "@/constants/enums";
import { PAYMENT_CYCLE } from "@/constants/enums";
import { formatCurrency } from "@/lib/format";

// ---- Types ----
//
// Sau khi gộp Property vào Asset, tin đăng không còn giữ bản sao địa chỉ/diện tích/toạ độ.
// Backend đọc xuyên qua Listing.Asset rồi trả về trong DTO, nên hình dạng phía client gần
// như không đổi — điều đổi là chúng luôn khớp với tài sản thay vì đóng băng lúc đăng tin.

/**
 * Điều kiện thuê. Mọi trường nullable: null = chủ tin CHƯA KHAI, khác hẳn false (đã khai
 * là không). Bộ lọc chỉ khớp khi khai tường minh — và đây cũng chính là các trường mà
 * AI Agent tìm kiếm sẽ chuyển câu hỏi tự nhiên thành điều kiện lọc cứng.
 */
export interface ListingTermsDto {
  depositMonths: number | null;
  electricityPrice: number | null;
  waterPrice: number | null;
  waterPricing: WaterPricingCode | null;
  serviceFee: number | null;
  parkingFee: number | null;
  internetFee: number | null;
  minLeaseMonths: number | null;
  availableFrom: string | null;
  maxOccupants: number | null;
  petsAllowed: boolean | null;
  curfewFree: boolean | null;
  sharedWithOwner: boolean | null;
  cookingAllowed: boolean | null;
}

export const EMPTY_TERMS: ListingTermsDto = {
  depositMonths: null,
  electricityPrice: null,
  waterPrice: null,
  waterPricing: null,
  serviceFee: null,
  parkingFee: null,
  internetFee: null,
  minLeaseMonths: null,
  availableFrom: null,
  maxOccupants: null,
  petsAllowed: null,
  curfewFree: null,
  sharedWithOwner: null,
  cookingAllowed: null,
};

export interface PublicListingSummaryDto {
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
  distanceMeters: number | null;
  /** Tên phòng khi tin đăng cho một phòng cụ thể, null khi đăng nguyên căn. */
  unitName: string | null;
  publishedAt: string | null;
  /** Tổng chi phí cố định hàng tháng — số người thuê thực sự so sánh. */
  totalMonthlyCost: number;
  depositMonths: number | null;
  petsAllowed: boolean | null;
  amenities: string[];
}

export interface PublicListingDetailDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: ListingTypeCode;
  price: number;
  rentPaymentCycle: PaymentCycleCode | null;
  city: string;
  district: string;
  ward: string;
  addressDetail: string;
  area: number | null;
  frontage: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  houseDirection: string | null;
  legalStatus: string | null;
  furnitureState: string | null;
  assetType: number;
  assetTypeLabel: string;
  unitName: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[];
  viewCount: number;
  publishedAt: string | null;
  terms: ListingTermsDto;
  amenities: string[];
  totalMonthlyCost: number;
  ownerName: string;
  ownerPhone: string;
}

export interface OwnerListingDto {
  id: string;
  slug: string | null;
  title: string;
  type: ListingTypeCode;
  status: ListingStatusCode;
  price: number;
  rentPaymentCycle: PaymentCycleCode | null;
  viewCount: number;
  createdAt: string;
  publishedAt: string | null;
  assetId: string;
  assetName: string;
  unitName: string | null;
  /** Lý do admin từ chối, hoặc ghi chú khi tin bị đưa về chờ duyệt lại. */
  moderationNote: string | null;
  /** 0–100. Tin càng đầy đủ dữ kiện càng được bộ lọc và AI Agent tìm thấy. */
  completenessPercent: number;
}

export interface PublicListingFilters {
  type?: ListingTypeCode | "";
  city?: string;
  district?: string;
  priceMin?: number | "";
  priceMax?: number | "";
  bedroomsMin?: number | "";
  keyword?: string;
  latitude?: number | "";
  longitude?: number | "";
  radiusMeters?: number | "";
  // Bộ lọc điều kiện thuê — cũng là các hard filter AI Agent sẽ sinh ra
  totalCostMax?: number | "";
  petsAllowed?: boolean | "";
  curfewFree?: boolean | "";
  sharedWithOwner?: boolean | "";
  availableBy?: string;
  amenities?: string[];
  page?: number;
  pageSize?: number;
}

export interface CreateListingInput {
  type: ListingTypeCode;
  /** null = đăng nguyên căn; có giá trị = đăng riêng một tầng/phòng. */
  assetUnitId?: string | null;
  title: string;
  description: string;
  price: number;
  rentPaymentCycle?: PaymentCycleCode | null;
  selectedAssetMediaIds: string[];
  terms?: ListingTermsDto | null;
  amenities?: string[];
}

export interface UpdateListingInput {
  title: string;
  description: string;
  price: number;
  rentPaymentCycle?: PaymentCycleCode | null;
  terms?: ListingTermsDto | null;
  amenities?: string[];
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
export const listingsApi = {
  // Công khai — không cần đăng nhập
  search: (f: PublicListingFilters = {}) =>
    api<PagedResult<PublicListingSummaryDto>>(
      `/listings/search${toQuery({ ...f, page: f.page ?? 1, pageSize: f.pageSize ?? 12 })}`,
      { skipAuth: true },
    ),
  detail: (slug: string) => api<PublicListingDetailDto>(`/listings/${slug}`, { skipAuth: true }),

  // Cần đăng nhập
  mine: () => api<OwnerListingDto[]>("/listings/mine"),
  byAsset: (assetId: string) => api<OwnerListingDto[]>(`/assets/${assetId}/listings`),
  create: (assetId: string, body: CreateListingInput) =>
    api<OwnerListingDto>(`/assets/${assetId}/listings`, { method: "POST", body }),
  update: (listingId: string, body: UpdateListingInput) =>
    api<OwnerListingDto>(`/listings/${listingId}`, { method: "PUT", body }),
  close: (listingId: string) => api<void>(`/listings/${listingId}/close`, { method: "POST" }),
};
