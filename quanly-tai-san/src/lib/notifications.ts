import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarClock,
  FileText,
  Inbox,
  MailOpen,
  Search,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { notificationsApi, type NotificationItem } from "@/lib/api/notifications";

/** Biểu tượng theo nơi thông báo dẫn tới — đủ để liếc là biết loại việc. */
export function notificationIcon(n: Pick<NotificationItem, "linkPath" | "title">): LucideIcon {
  const p = n.linkPath ?? "";
  if (p.startsWith("/yeu-cau?tab=invites")) return MailOpen;
  if (p.startsWith("/yeu-cau")) return Inbox;
  if (p.startsWith("/tin-cua-toi"))
    return n.title.includes("gỡ") || n.title.includes("từ chối") ? ShieldAlert : FileText;
  if (p.startsWith("/tin-dang")) return Search;
  return Bell;
}

export const NOTIFICATION_KEYS = {
  count: ["notifications", "count"] as const,
  list: ["notifications", "list"] as const,
};

/** Mở đường dẫn của thông báo. Dùng history thay vì navigate({to}) vì đường dẫn có thể kèm
 *  query ("/yeu-cau?tab=invites") — navigate coi cả chuỗi là pathname. */
export function useOpenNotification() {
  const router = useRouter();
  const qc = useQueryClient();
  return async (n: NotificationItem) => {
    if (!n.isRead) {
      await notificationsApi.markRead(n.id).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (n.linkPath) router.history.push(n.linkPath);
  };
}
