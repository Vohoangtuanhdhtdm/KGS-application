import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { notificationsApi } from "@/lib/api/notifications";
import { NotificationRow } from "@/components/notifications/NotificationBell";
import { useOpenNotification } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/thong-bao")({
  head: () => ({ meta: [{ title: "Thông báo — KGS" }] }),
  component: () => (
    <ProtectedRoute>
      <NotificationsPage />
    </ProtectedRoute>
  ),
});

const PAGE_SIZE = 20;

/** Toàn bộ thông báo — chuông chỉ hiện vài cái mới nhất. */
function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const openItem = useOpenNotification();

  const q = useQuery({
    queryKey: ["notifications", "page", unreadOnly, page],
    queryFn: () =>
      notificationsApi.list({ unreadOnly: unreadOnly || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const readAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const data = q.data;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Bell className="h-5 w-5 text-muted-foreground" /> Thông báo
          {data && data.unreadCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({data.unreadCount} chưa đọc)
            </span>
          )}
        </h1>
        <div className="flex gap-2">
          <div className="inline-flex rounded-md border p-0.5">
            {[
              { v: false, label: "Tất cả" },
              { v: true, label: "Chưa đọc" },
            ].map((t) => (
              <Button
                key={String(t.v)}
                size="sm"
                variant={unreadOnly === t.v ? "default" : "ghost"}
                className="h-8 rounded-sm"
                onClick={() => {
                  setUnreadOnly(t.v);
                  setPage(1);
                }}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!data?.unreadCount || readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" /> Đọc hết
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        {q.isLoading && <Skeleton className="h-40 w-full" />}
        {data?.items.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {unreadOnly ? "Bạn đã đọc hết thông báo." : "Chưa có thông báo nào."}
          </p>
        )}
        {data?.items.map((n) => (
          <NotificationRow key={n.id} n={n} onOpen={() => void openItem(n)} />
        ))}
      </div>

      {data && data.totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Trang {page}/{pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
