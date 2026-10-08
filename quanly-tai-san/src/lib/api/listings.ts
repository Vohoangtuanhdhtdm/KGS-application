import { api, apiForm, toQuery } from "./http";
import type { PagedResult } from "./assets";
import type {
  ListingTypeCode,
  PaymentCycleCode,
  ListingStatusCode,
  WaterPricingCode,
} from "@/constants/enums";
import { PAYMENT_CYCLE } from "@/constants/enums";
import type { ModerationActionCode, ModerationReasonCode } from "@/constants/enums";
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
  /** Những mong muốn mềm (prefer) mà tin nhắc tới — chỉ có khi tìm qua trợ lý. */
  matchedPreferences?: string[] | null;
  /** Toà nhà của tin có mô hình 3D công khai. */
  hasBuildingModel?: boolean;
  /** Tối đa 5 ảnh đầu — lướt ảnh ngay trên thẻ. */
  imageUrls?: string[];
  imageCount?: number;
  /** Mã loại hình (AssetDomainType). */
  assetType?: number;
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
  /** null khi người đăng chưa có số — đừng dựng `tel:` từ giá trị này khi nó rỗng. */
  ownerPhone: string | null;
  ownerAvatarUrl: string | null;
  ownerJoinedAt: string;
  ownerActiveListingCount: number;
  /** Để dẫn tới hồ sơ công khai /nguoi-dang/{id}. */
  ownerId?: string | null;
  ownerInquiriesReceived?: number;
  ownerInquiriesAnswered?: number;
  ownerMedianResponseHours?: number | null;
  /** Địa chỉ sau sắp xếp 2025, suy ra từ địa chỉ cũ. */
  newProvince?: string | null;
  newWard?: string | null;
  newWardCode?: string | null;
  /** Phường cũ bị chia cho nhiều phường mới — phường mới chỉ là ước đoán. */
  newAddressApprox?: boolean;
}

/** Hai dải gợi ý dưới trang chi tiết. */
export interface RelatedListingsDto {
  similar: PublicListingSummaryDto[];
  fromOwner: PublicListingSummaryDto[];
}

/** Khớp với enum ListingReportReason phía backend. */
export const REPORT_REASON = {
  1: "Tin rác, đăng trùng lặp",
  2: "Thông tin sai (giá, diện tích, địa chỉ)",
  3: "Đã cho thuê/bán rồi mà tin vẫn còn",
  4: "Có dấu hiệu lừa đảo",
  5: "Nội dung không phù hợp",
  6: "Lý do khác",
} as const;
export type ReportReasonCode = keyof typeof REPORT_REASON;

export const REPORT_STATUS = {
  1: "Chờ xử lý",
  2: "Đã xử lý",
  3: "Không vi phạm",
} as const;
export type ReportStatusCode = keyof typeof REPORT_STATUS;

export interface ListingReportDto {
  id: string;
  listingId: string;
  listingTitle: string;
  listingSlug: string | null;
  listingStatus: ListingStatusCode;
  reason: ReportReasonCode;
  detail: string | null;
  status: ReportStatusCode;
  reporterName: string;
  createdAt: string;
  handledAt: string | null;
  handlerNote: string | null;
  /** Số người khác nhau cùng đang báo tin này. */
  pendingCountOnListing: number;
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

export interface ListingImageDto {
  id: string;
  url: string;
  sortOrder: number;
}

export interface CreateListingDirectInput {
  type: ListingTypeCode;
  title: string;
  description: string;
  price: number;
  rentPaymentCycle?: PaymentCycleCode | null;

  city: string;
  district: string;
  ward: string;
  addressDetail?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  propertyType: number;
  area?: number | null;
  frontage?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floors?: number | null;
  houseDirection?: string | null;
  legalStatus?: string | null;
  furnitureState?: string | null;

  terms?: ListingTermsDto | null;
  amenities?: string[];

  /** Đăng cho một căn trong toà nhà có sẵn (xem trang Toà nhà). */
  assetId?: string | null;
  assetUnitId?: string | null;
}

export interface EditListingDto {
  id: string;
  status: ListingStatusCode;
  type: ListingTypeCode;
  title: string;
  description: string;
  price: number;
  rentPaymentCycle: PaymentCycleCode | null;

  city: string;
  district: string;
  ward: string;
  addressDetail: string;
  propertyType: number;
  area: number | null;
  frontage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;
  houseDirection: string | null;
  legalStatus: string | null;
  furnitureState: string | null;

  terms: ListingTermsDto;
  amenities: string[];
  images: ListingImageDto[];

  /** false khi tai san con tin dang khac — sua dia chi luc do se doi luon cac tin kia. */
  canEditPropertyFields: boolean;
  moderationNote: string | null;
  /** Ghim vị trí hiện tại, null nếu chưa ghim. */
  latitude: number | null;
  longitude: number | null;
  assetId: string;
  /** Tin của một căn trong toà nhà. */
  assetUnitId: string | null;
  assetName: string | null;
  unitName: string | null;
}

/** Khop voi enum ListingSort phia backend. */
export const LISTING_SORT = {
  1: "Mới nhất",
  2: "Giá thấp đến cao",
  3: "Giá cao đến thấp",
  4: "Diện tích lớn nhất",
  5: "Gần tôi nhất",
  6: "Phù hợp nhất",
} as const;
export type ListingSortCode = keyof typeof LISTING_SORT;

export interface ModerationEventDto {
  action: ModerationActionCode;
  reasons: ModerationReasonCode[];
  note: string | null;
  round: number;
  createdAt: string;
}

export interface ListingAreaDto {
  city: string;
  /** Rỗng ở dòng phường/xã mới. */
  district: string;
  /** Số tin đang hiển thị ở khu vực này. */
  count: number;
  /** Dòng phường/xã mới (sau sắp xếp 2025) — có mã phường. */
  newProvinceCode?: string | null;
  newProvince?: string | null;
  newWardCode?: string | null;
  newWard?: string | null;
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
  /** Vùng đi lại (Isochrone) "lng,lat;lng,lat;..." — gửi kèm vòng tròn bao ngoài ở trên. */
  within?: string;
  /** Đơn vị hành chính sau sắp xếp 2025: mã tỉnh mới / mã phường mới. */
  newProvinceCode?: string;
  newWardCode?: string;
  // Đặc điểm bất động sản — mọi loại hình, cả bán lẫn thuê
  propertyTypes?: number[];
  areaMin?: number | "";
  areaMax?: number | "";
  bathroomsMin?: number | "";
  floorsMin?: number | "";
  frontageMin?: number | "";
  directions?: string[];
  legalStatuses?: string[];
  furnitureStates?: string[];
  /** Chỉ tin thuộc toà nhà có mô hình 3D. */
  has3D?: boolean | "";
  /** Mong muốn mềm, phân cách bằng ";" — chỉ ảnh hưởng thứ tự (sắp "Phù hợp nhất"). */
  prefer?: string;
  // Bộ lọc điều kiện thuê — cũng là các hard filter AI Agent sẽ sinh ra
  totalCostMax?: number | "";
  petsAllowed?: boolean | "";
  curfewFree?: boolean | "";
  sharedWithOwner?: boolean | "";
  availableBy?: string;
  amenities?: string[];
  sortBy?: ListingSortCode | "";
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

  // Chi duoc ap dung khi tai san CHI co dung tin nay (canEditPropertyFields).
  city?: string | null;
  district?: string | null;
  ward?: string | null;
  addressDetail?: string | null;
  propertyType?: number | null;
  area?: number | null;
  frontage?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floors?: number | null;
  houseDirection?: string | null;
  legalStatus?: string | null;
  furnitureState?: string | null;
  /** Gửi đủ cả hai thì đặt/di chuyển ghim; bỏ trống thì giữ nguyên. */
  latitude?: number | null;
  longitude?: number | null;
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

/** Một ô của lớp giá/m² trên bản đồ tìm nhà (xem PriceGrid ở backend). */
export interface PriceGridCell {
  key: string;
  west: number;
  south: number;
  east: number;
  north: number;
  /** Trọng tâm các tin trong ô — chỗ đặt nhãn. */
  lat: number;
  lng: number;
  count: number;
  pricedCount: number;
  medianPricePerM2: number | null;
  minPrice: number;
}

export interface PriceGridResult {
  cells: PriceGridCell[];
  /** Bốn mốc chia năm mức màu, tính trên mọi tin khớp bộ lọc (không riêng khung nhìn). */
  breaks: number[];
  totalInView: number;
  totalMatched: number;
  minReliableCount: number;
}

export interface MapBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

// ---- API ----
export const listingsApi = {
  // Công khai — không cần đăng nhập
  search: (f: PublicListingFilters = {}) =>
    api<PagedResult<PublicListingSummaryDto>>(
      `/listings/search${toQuery({ ...f, page: f.page ?? 1, pageSize: f.pageSize ?? 12 })}`,
      { skipAuth: true },
    ),
  /** Lớp giá/m²: tin khớp bộ lọc gom theo ô lưới trong khung nhìn. Bắt buộc có type. */
  priceGrid: (f: PublicListingFilters, box: MapBox, zoom: number, signal?: AbortSignal) =>
    api<PriceGridResult>(
      `/listings/price-grid${toQuery({
        ...f,
        // Lớp giá nói về thị trường trong khung nhìn — điều kiện vị trí và phân trang không dùng.
        latitude: undefined,
        longitude: undefined,
        radiusMeters: undefined,
        within: undefined,
        page: undefined,
        pageSize: undefined,
        sortBy: undefined,
        ...box,
        zoom: +zoom.toFixed(2),
      })}`,
      { skipAuth: true, signal },
    ),
  /** Lịch sử kiểm duyệt tin của chính mình — mọi vòng, mọi lý do, không có tên người duyệt. */
  moderationHistory: (listingId: string) =>
    api<ModerationEventDto[]>(`/listings/${listingId}/moderation-history`),
  /** Các khu vực đang có tin, để ô tìm khu vực gợi ý. Danh sách nhỏ, tải một lần rồi lọc tại chỗ. */
  areas: (type?: ListingTypeCode) =>
    api<ListingAreaDto[]>(`/listings/areas${toQuery({ type })}`, { skipAuth: true }),
  detail: (slug: string) => api<PublicListingDetailDto>(`/listings/${slug}`, { skipAuth: true }),
  related: (slug: string) =>
    api<RelatedListingsDto>(`/listings/${slug}/related`, { skipAuth: true }),
  report: (slug: string, reason: ReportReasonCode, detail: string | null) =>
    api<void>(`/listings/${slug}/reports`, { method: "POST", body: { reason, detail } }),

  // Cần đăng nhập
  mine: () => api<OwnerListingDto[]>("/listings/mine"),
  byAsset: (assetId: string) => api<OwnerListingDto[]>(`/assets/${assetId}/listings`),
  create: (assetId: string, body: CreateListingInput) =>
    api<OwnerListingDto>(`/assets/${assetId}/listings`, { method: "POST", body }),
  update: (listingId: string, body: UpdateListingInput) =>
    api<OwnerListingDto>(`/listings/${listingId}`, { method: "PUT", body }),
  close: (listingId: string) => api<void>(`/listings/${listingId}/close`, { method: "POST" }),

  // ---- Luong dang tin truc tiep: tao nhap -> them anh -> gui duyet ----
  createDirect: (body: CreateListingDirectInput) =>
    api<OwnerListingDto>("/listings", { method: "POST", body }),
  images: (listingId: string) => api<ListingImageDto[]>(`/listings/${listingId}/images`),
  addImages: (listingId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return apiForm<ListingImageDto[]>(`/listings/${listingId}/images`, form);
  },
  removeImage: (listingId: string, imageId: string) =>
    api<void>(`/listings/${listingId}/images/${imageId}`, { method: "DELETE" }),
  submit: (listingId: string) =>
    api<OwnerListingDto>(`/listings/${listingId}/submit`, { method: "POST" }),

  // ---- Vong doi tin dang ----
  forEdit: (listingId: string) => api<EditListingDto>(`/listings/${listingId}/edit`),
  bump: (listingId: string) =>
    api<OwnerListingDto>(`/listings/${listingId}/bump`, { method: "POST" }),
  reopen: (listingId: string) =>
    api<OwnerListingDto>(`/listings/${listingId}/reopen`, { method: "POST" }),
  deleteDraft: (listingId: string) => api<void>(`/listings/${listingId}`, { method: "DELETE" }),
};

/** Hồ sơ công khai của người đăng — chỉ những gì hệ thống kiểm chứng được. */
export interface OwnerProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  joinedAt: string;
  emailVerified: boolean;
  hasPhone: boolean;
  activeListingCount: number;
  publishedListingCount: number;
  inquiriesReceived: number;
  inquiriesAnswered: number;
  medianResponseHours: number | null;
  listings: PublicListingSummaryDto[];
}

export const ownersApi = {
  profile: (id: string) =>
    api<OwnerProfile>(`/owners/${encodeURIComponent(id)}`, { skipAuth: true }),
};
