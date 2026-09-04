import { api, toQuery } from "./http";
import type { ListingReportDto, ReportStatusCode } from "./listings";
import type { ListingTypeCode, ListingStatusCode } from "@/constants/enums";

export interface AdminPendingListing {
  id: string;
  title: string;
  type: ListingTypeCode;
  price: number;
  city: string | null;
  district: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  unitName: string | null;
  imageCount: number;
  createdAt: string;
}

// ⚠️ KHÔNG có totalPages — khác PagedResult<T> chuẩn
export interface AdminPendingPage {
  items: AdminPendingListing[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface AdminStatusCount {
  status: ListingStatusCode;
  count: number;
}

export interface AdminListingStats {
  byStatus: AdminStatusCount[];
  totalUsers: number;
  totalAssets: number;
}

export interface AdminListingDetail {
  id: string;
  title: string;
  description: string;
  type: ListingTypeCode;
  status: ListingStatusCode;
  price: number;
  rentPaymentCycle: number | null;
  totalMonthlyCost: number;
  city: string;
  district: string;
  ward: string;
  addressDetail: string;
  latitude: number | null;
  longitude: number | null;
  assetType: number;
  assetTypeLabel: string;
  unitName: string | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;
  houseDirection: string | null;
  legalStatus: string | null;
  furnitureState: string | null;
  imageUrls: string[];
  amenities: string[];
  completenessPercent: number;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  /** Tong so tin cua cung nguoi dang — 40 tin cho duyet la tin hieu rat khac 1 tin. */
  ownerListingCount: number;
  createdAt: string;
  moderationNote: string | null;
}

export interface BulkModerateResult {
  succeeded: number;
  skipped: number;
  messages: string[];
}

export interface AdminPendingFilters {
  type?: ListingTypeCode | "";
  city?: string;
  district?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export const adminApi = {
  pending: (f: AdminPendingFilters = {}) =>
    api<AdminPendingPage>(
      `/admin/listings/pending${toQuery({ ...f, page: f.page ?? 1, pageSize: f.pageSize ?? 20 })}`,
    ),
  detail: (listingId: string) => api<AdminListingDetail>(`/admin/listings/${listingId}`),
  bulk: (listingIds: string[], approve: boolean, reason?: string) =>
    api<BulkModerateResult>("/admin/listings/bulk", {
      method: "POST",
      body: { listingIds, approve, reason: reason ?? null },
    }),
  stats: () => api<AdminListingStats>("/admin/listings/stats"),
  approve: (listingId: string, note?: string | null) =>
    api<void>(`/admin/listings/${listingId}/approve`, {
      method: "POST",
      body: { note: note ?? null },
    }),
  reject: (listingId: string, reason: string) =>
    api<void>(`/admin/listings/${listingId}/reject`, { method: "POST", body: { reason } }),
};

export const adminReportsApi = {
  /** Bỏ trống status để lấy tất cả. */
  list: (status?: ReportStatusCode) =>
    api<ListingReportDto[]>(`/admin/listing-reports${toQuery({ status })}`),

  /** confirmed = true nghĩa là có vi phạm thật; false nghĩa là tin không sai. */
  resolve: (id: string, confirmed: boolean, note: string | null) =>
    api<void>(`/admin/listing-reports/${id}/resolve`, {
      method: "POST",
      body: { confirmed, note },
    }),
};
