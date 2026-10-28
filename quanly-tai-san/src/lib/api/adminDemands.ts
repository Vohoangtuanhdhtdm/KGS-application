import { api } from "./http";
import type { SavedSearchCriteria } from "./savedSearches";

/** Một nhu cầu bị bộ lọc tự động giữ lại, chờ quản trị duyệt. */
export interface AdminDemand {
  id: string;
  name: string;
  criteria: SavedSearchCriteria;
  note: string | null;
  /** Các dấu hiệu bị gắn cờ, nối bằng "; ". */
  reviewReason: string | null;
  submittedAt: string;
  userName: string;
  email: string;
  emailConfirmed: boolean;
  userJoinedAt: string;
}

export const ADMIN_DEMANDS_KEY = ["admin-demands"];

export const adminDemandsApi = {
  pending: () => api<AdminDemand[]>("/admin/demands/pending"),
  pendingCount: () => api<number>("/admin/demands/pending/count"),
  approve: (id: string) => api<void>(`/admin/demands/${id}/approve`, { method: "POST" }),
  reject: (id: string, reason: string) =>
    api<void>(`/admin/demands/${id}/reject`, { method: "POST", body: { reason } }),
  bulk: (ids: string[], approve: boolean, reason: string | null) =>
    api<{ handled: number; skipped: number }>("/admin/demands/bulk", {
      method: "POST",
      body: { ids, approve, reason },
    }),
};
