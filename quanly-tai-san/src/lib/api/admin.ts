import { api, toQuery } from "./http";
import type { ListingTypeCode, PropertyStatusCode } from "@/constants/enums";

export interface AdminPendingProperty {
  id: string;
  title: string;
  type: ListingTypeCode;
  price: number;
  city: string | null;
  district: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  imageCount: number;
  createdAt: string;
}

// ⚠️ KHÔNG có totalPages — khác PagedResult<T> chuẩn
export interface AdminPendingPage {
  items: AdminPendingProperty[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface AdminStatusCount {
  status: PropertyStatusCode;
  count: number;
}

export interface AdminPropertyStats {
  byStatus: AdminStatusCount[];
  totalUsers: number;
  totalAssets: number;
}

export const adminApi = {
  pending: (page = 1, pageSize = 20) =>
    api<AdminPendingPage>(`/admin/properties/pending${toQuery({ page, pageSize })}`),
  stats: () => api<AdminPropertyStats>("/admin/properties/stats"),
  approve: (propertyId: string, note?: string | null) =>
    api<void>(`/admin/properties/${propertyId}/approve`, {
      method: "POST",
      body: { note: note ?? null },
    }),
  reject: (propertyId: string, reason: string) =>
    api<void>(`/admin/properties/${propertyId}/reject`, { method: "POST", body: { reason } }),
};
