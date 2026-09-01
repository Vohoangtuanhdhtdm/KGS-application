import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, XCircle, Image as ImageIcon } from "lucide-react";
import { adminApi, type AdminPendingProperty } from "@/lib/api/admin";
import { getErrorMessage } from "@/lib/api/errors";
import { ApiError } from "@/lib/auth/types";
import { formatDate, formatCurrency } from "@/lib/format";
import { LISTING_TYPE, PROPERTY_STATUS, type PropertyStatusCode } from "@/constants/enums";
import { AdminRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/properties")({
  head: () => ({ meta: [{ title: "Duyệt tin đăng — Quản trị" }] }),
  component: () => (
    <AdminRoute>
      <AdminPropertiesPage />
    </AdminRoute>
  ),
});

const STAT_ORDER: PropertyStatusCode[] = [1, 2, 3, 4];
const STAT_TONE: Record<PropertyStatusCode, string> = {
  1: "text-muted-foreground",
  2: "text-success",
  3: "text-destructive",
  4: "text-foreground",
};

function AdminPropertiesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [approveItem, setApproveItem] = useState<AdminPendingProperty | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [rejectItem, setRejectItem] = useState<AdminPendingProperty | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const pendingQ = useQuery({
    queryKey: ["admin-pending", page],
    queryFn: () => adminApi.pending(page, 20),
    placeholderData: keepPreviousData,
    retry: 1,
  });
  const statsQ = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats(),
    retry: 1,
  });

  // Cập nhật cả danh sách chờ duyệt LẪN 4 thẻ thống kê
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-pending"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  // 409 = tin đã được admin khác xử lý → giữ nguyên dòng, chỉ báo + refresh cho đồng bộ
  const handleConflict = (err: unknown): boolean => {
    if (err instanceof ApiError && err.status === 409) {
      toast.warning(getErrorMessage(err, "Tin này vừa được xử lý bởi người khác."));
      refreshAll();
      return true;
    }
    return false;
  };

  const approve = useMutation({
    mutationFn: () => adminApi.approve(approveItem!.id, approveNote.trim() || null),
    onSuccess: () => {
      toast.success("Đã duyệt tin");
      setApproveItem(null);
      setApproveNote("");
      refreshAll();
    },
    onError: (err) => {
      if (handleConflict(err)) {
        setApproveItem(null);
        return;
      }
      toast.error(getErrorMessage(err, "Duyệt thất bại"));
    },
  });

  const reject = useMutation({
    mutationFn: () => adminApi.reject(rejectItem!.id, rejectReason.trim()),
    onSuccess: () => {
      toast.success("Đã từ chối tin");
      setRejectItem(null);
      setRejectReason("");
      refreshAll();
    },
    onError: (err) => {
      if (handleConflict(err)) {
        setRejectItem(null);
        return;
      }
      toast.error(getErrorMessage(err, "Từ chối thất bại"));
    },
  });

  const stats = statsQ.data;
  const countByStatus = (s: PropertyStatusCode) =>
    stats?.byStatus.find((x) => x.status === s)?.count ?? 0;

  const data = pendingQ.data;
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Duyệt tin đăng</h1>
        <p className="text-sm text-muted-foreground">
          Quản trị viên xem xét và duyệt các tin đăng đang chờ.
        </p>
      </div>

      {/* 4 thẻ thống kê theo trạng thái */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_ORDER.map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {PROPERTY_STATUS[s]}
              </div>
              <div className={`mt-1 text-3xl font-semibold ${STAT_TONE[s]}`}>
                {statsQ.isLoading ? "—" : countByStatus(s)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Đang chờ duyệt{data ? ` (${data.totalCount})` : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : pendingQ.isError ? (
            <div className="py-10 text-center text-sm text-destructive">
              {getErrorMessage(pendingQ.error, "Không tải được danh sách")}
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Không có tin đăng nào đang chờ duyệt.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-3 flex-wrap"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-sm text-primary font-semibold">
                      {formatCurrency(p.price)} · {LISTING_TYPE[p.type]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[p.district, p.city].filter(Boolean).join(", ") || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>
                        {p.ownerName ?? "—"}
                        {p.ownerEmail ? ` · ${p.ownerEmail}` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        {p.imageCount} ảnh
                      </span>
                      <span>Nộp {formatDate(p.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setApproveNote("");
                        setApproveItem(p);
                      }}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setRejectReason("");
                        setRejectItem(p);
                      }}
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Từ chối
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Trang trước
              </Button>
              <span className="text-sm text-muted-foreground">
                Trang {data.page}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duyệt — ghi chú tuỳ chọn */}
      <Dialog
        open={!!approveItem}
        onOpenChange={(o) => !approve.isPending && !o && setApproveItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duyệt tin đăng</DialogTitle>
            <DialogDescription>
              Duyệt "{approveItem?.title}" — tin sẽ hiển thị công khai trên marketplace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-note">Ghi chú (tuỳ chọn)</Label>
            <Textarea
              id="approve-note"
              rows={3}
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setApproveItem(null)}
              disabled={approve.isPending}
            >
              Huỷ
            </Button>
            <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
              {approve.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận duyệt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Từ chối — lý do bắt buộc */}
      <Dialog
        open={!!rejectItem}
        onOpenChange={(o) => !reject.isPending && !o && setRejectItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối tin đăng</DialogTitle>
            <DialogDescription>
              Từ chối "{rejectItem?.title}". Lý do sẽ được gửi tới chủ tin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Lý do (bắt buộc)</Label>
            <Textarea
              id="reject-reason"
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectItem(null)} disabled={reject.isPending}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={reject.isPending || !rejectReason.trim()}
              onClick={() => reject.mutate()}
            >
              {reject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
