import { api, toQuery } from "./http";
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

export const adminApi = {
  pending: (page = 1, pageSize = 20) =>
    api<AdminPendingPage>(`/admin/listings/pending${toQuery({ page, pageSize })}`),
  stats: () => api<AdminListingStats>("/admin/listings/stats"),
  approve: (listingId: string, note?: string | null) =>
    api<void>(`/admin/listings/${listingId}/approve`, {
      method: "POST",
      body: { note: note ?? null },
    }),
  reject: (listingId: string, reason: string) =>
    api<void>(`/admin/listings/${listingId}/reject`, { method: "POST", body: { reason } }),
};
