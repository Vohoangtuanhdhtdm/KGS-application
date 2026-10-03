import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth/AuthContext";
import { notificationsApi, type NotificationItem } from "@/lib/api/notifications";
import { timeAgo } from "@/lib/format";
import { NOTIFICATION_KEYS, notificationIcon, useOpenNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/**
 * Chuông thông báo ở thanh trên cùng.
 *
 * Số chưa đọc được hỏi lại mỗi phút và mỗi khi quay lại tab — đủ "gần thời gian thực" cho
 * việc như "có người hỏi thuê" mà không cần mở kết nối thường trực. Danh sách chỉ tải khi
 * mở chuông.
 */
export function NotificationBell({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const openItem = useOpenNotification();

  const count = useQuery({
    queryKey: NOTIFICATION_KEYS.count,
    queryFn: notificationsApi.unreadCount,
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const list = useQuery({
    queryKey: NOTIFICATION_KEYS.list,
    queryFn: () => notificationsApi.list({ pageSize: 12 }),
    enabled: isAuthenticated && open,
  });
  const readAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (!isAuthenticated) return null;
  const unread = count.data?.count ?? 0;
  const items = list.data?.items ?? [];

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) qc.invalidateQueries({ queryKey: NOTIFICATION_KEYS.list });
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative",
            tone === "dark" &&
              "text-ws-admin-ink-foreground/80 hover:bg-white/10 hover:text-ws-admin-ink-foreground",
          )}
          aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-[18px] text-destructive-foreground tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Thông báo</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Đánh dấu đã đọc hết
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {list.isLoading && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Đang tải…</p>
          )}
          {!list.isLoading && items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Chưa có thông báo nào. Khi có người hỏi thuê, tin được duyệt hay có lời mời xem nhà,
              bạn sẽ thấy ở đây.
            </p>
          )}
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onOpen={() => {
                setOpen(false);
                void openItem(n);
              }}
            />
          ))}
        </div>
        <div className="border-t px-3 py-2 text-center">
          <Link
            to="/thong-bao"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            Xem tất cả thông báo
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NotificationRow({ n, onOpen }: { n: NotificationItem; onOpen: () => void }) {
  const Icon = notificationIcon(n);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/60",
        !n.isRead && "bg-primary/5",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          n.isRead ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("line-clamp-2 text-sm", !n.isRead && "font-semibold")}>{n.title}</span>
        <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
        <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
      </span>
      {!n.isRead && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Chưa đọc" />
      )}
    </button>
  );
}
