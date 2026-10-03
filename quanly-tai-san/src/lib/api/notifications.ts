import { api, toQuery } from "./http";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  /** Đường dẫn tương đối trong ứng dụng, có thể kèm query ("/yeu-cau?tab=invites"). */
  linkPath: string | null;
  linkLabel: string | null;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationPage {
  items: NotificationItem[];
  unreadCount: number;
  totalCount: number;
  page: number;
  pageSize: number;
}

export const notificationsApi = {
  list: (p: { unreadOnly?: boolean; page?: number; pageSize?: number }) =>
    api<NotificationPage>(`/notifications${toQuery(p)}`),
  unreadCount: () => api<{ count: number }>("/notifications/unread-count"),
  markRead: (id: string) => api<void>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => api<void>("/notifications/read-all", { method: "POST" }),
};
