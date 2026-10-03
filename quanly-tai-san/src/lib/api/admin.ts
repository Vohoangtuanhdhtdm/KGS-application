import { api, toQuery } from "./http";
import type { ListingReportDto, ReportStatusCode } from "./listings";
import type { ListingTypeCode, ListingStatusCode } from "@/constants/enums";
import type {
  ModerationActionCode,
  ModerationReasonCode,
  ReportActionCode,
} from "@/constants/enums";

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

export interface ModerationEventDto {
  action: ModerationActionCode;
  reasons: ModerationReasonCode[];
  note: string | null;
  /** Vòng thứ mấy, tính từ 1. */
  round: number;
  createdAt: string;
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
  /** Trả tin về cho chủ tin sửa — bậc trung gian giữa duyệt và từ chối. */
  requestChanges: (listingId: string, reasons: ModerationReasonCode[], note?: string | null) =>
    api<void>(`/admin/listings/${listingId}/request-changes`, {
      method: "POST",
      body: { reasons, note: note ?? null },
    }),

  moderationHistory: (listingId: string) =>
    api<ModerationEventDto[]>(`/admin/listings/${listingId}/moderation-history`),

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

  /** confirmed = true nghĩa là có vi phạm thật; false nghĩa là tin không sai.
   *  action: cách xử lý tin khi có vi phạm — bỏ trống thì máy chủ chọn theo lý do báo. */
  resolve: (
    id: string,
    confirmed: boolean,
    note: string | null,
    action?: ReportActionCode | null,
  ) =>
    api<ResolveReportResult>(`/admin/listing-reports/${id}/resolve`, {
      method: "POST",
      body: { confirmed, note, action: confirmed ? (action ?? null) : null },
    }),
};

export interface ResolveReportResult {
  reportsClosed: number;
  /** null = tin không đổi (bỏ qua báo cáo, hoặc tin đã không còn hiển thị). */
  appliedAction: ReportActionCode | null;
  listingStatus: ListingStatusCode;
}

// ============================================================
// Quản trị mọi tin đăng (A2) và người dùng (A3)
// ============================================================

export interface AdminListingRow {
  id: string;
  slug: string | null;
  title: string;
  type: ListingTypeCode;
  status: ListingStatusCode;
  price: number;
  rentPaymentCycle: 1 | 2 | 3 | 4 | null;
  assetType: number;
  city: string;
  district: string;
  unitName: string | null;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerLocked: boolean;
  createdAt: string;
  publishedAt: string | null;
  viewCount: number;
  pendingReports: number;
  confirmedReports: number;
  moderationNote: string | null;
  /** Tin do quản trị gỡ/đóng — khôi phục được. */
  canRestore: boolean;
}

export interface PagedAdmin<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  emailConfirmed: boolean;
  isAdmin: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  lockReason: string | null;
  listingCount: number;
  liveListingCount: number;
  confirmedViolations: number;
  pendingReports: number;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  lockedAt: string | null;
  lockedByName: string | null;
  listings: AdminListingRow[];
}

export interface AdminActionResult {
  message: string;
  affectedListings: number;
}

export interface AdminListingQuery {
  q?: string;
  status?: ListingStatusCode | "";
  type?: ListingTypeCode | "";
  assetType?: number | "";
  ownerId?: string;
  reportedOnly?: boolean;
  sort?: "newest" | "reports" | "views" | "price";
  page?: number;
  pageSize?: number;
}

export const adminManageApi = {
  listings: (f: AdminListingQuery) =>
    api<PagedAdmin<AdminListingRow>>(`/admin/all-listings${toQuery(f as Record<string, unknown>)}`),
  takeDown: (id: string, reasons: ModerationReasonCode[], note: string | null) =>
    api<AdminActionResult>(`/admin/all-listings/${id}/take-down`, {
      method: "POST",
      body: { reasons, note },
    }),
  restore: (id: string, note: string | null) =>
    api<AdminActionResult>(`/admin/all-listings/${id}/restore`, { method: "POST", body: { note } }),

  users: (f: { q?: string; filter?: string; sort?: string; page?: number; pageSize?: number }) =>
    api<PagedAdmin<AdminUserRow>>(`/admin/users${toQuery(f)}`),
  user: (id: string) => api<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`),
  lock: (id: string, reason: string, days: number | null, hideListings: boolean) =>
    api<AdminActionResult>(`/admin/users/${encodeURIComponent(id)}/lock`, {
      method: "POST",
      body: { reason, days, hideListings },
    }),
  unlock: (id: string, restoreListings: boolean) =>
    api<AdminActionResult>(`/admin/users/${encodeURIComponent(id)}/unlock`, {
      method: "POST",
      body: { restoreListings },
    }),
  setAdmin: (id: string, admin: boolean) =>
    api<AdminActionResult>(`/admin/users/${encodeURIComponent(id)}/admin-role`, {
      method: "PUT",
      body: { admin },
    }),
};
