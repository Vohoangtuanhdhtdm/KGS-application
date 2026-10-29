import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Handshake, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { AdminRoute } from "@/components/auth/ProtectedRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ADMIN_DEMANDS_KEY, adminDemandsApi, type AdminDemand } from "@/lib/api/adminDemands";
import { getErrorMessage } from "@/lib/api/errors";
import { describeDemand } from "@/lib/demandSummary";
import { formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/nhu-cau")({
  head: () => ({ meta: [{ title: "Duyệt nhu cầu — KGS" }] }),
  component: () => (
    <AdminRoute>
      <AdminDemandsPage />
    </AdminRoute>
  ),
});

const REASON_PRESETS = [
  "Lời nhắn có thông tin liên lạc",
  "Nội dung quảng cáo, rao vặt",
  "Nhu cầu không có thật hoặc trùng lặp",
];

/**
 * Hàng đợi kiểm duyệt "Đăng nhu cầu": chỉ những nhu cầu bị bộ lọc tự động giữ lại (có liên kết,
 * số điện thoại, rao vặt, tài khoản chưa xác thực, đăng dày…). Nhu cầu sạch đã được duyệt ngay.
 */
function AdminDemandsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ADMIN_DEMANDS_KEY, queryFn: adminDemandsApi.pending });
  const rows = q.data ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // null = đóng; "bulk" = từ chối các mục đã chọn; còn lại = id một nhu cầu.
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const refresh = () => {
    setSelected(new Set());
    void qc.invalidateQueries({ queryKey: ADMIN_DEMANDS_KEY });
    void qc.invalidateQueries({ queryKey: ["admin-demands-count"] });
  };
  // Lỗi thường là 409 — người đăng vừa tắt, hoặc quản trị khác vừa xử lý: tải lại để bỏ dòng cũ.
  const fail = (e: unknown) => {
    toast.error(getErrorMessage(e, "Chưa xử lý được"));
    refresh();
  };
  const skippedNote = (skipped: number) =>
    skipped > 0 ? ` ${skipped} nhu cầu đã được xử lý hoặc bị tắt trước đó nên bỏ qua.` : "";

  const approve = useMutation({
    mutationFn: adminDemandsApi.approve,
    onSuccess: () => {
      toast.success("Đã duyệt — chủ nhà phù hợp giờ đã thấy nhu cầu này.");
      refresh();
    },
    onError: fail,
  });
  const reject = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) =>
      id === "bulk"
        ? adminDemandsApi.bulk([...selected], false, why)
        : adminDemandsApi.reject(id, why).then(() => null),
    onSuccess: (r) => {
      toast.success(
        r
          ? `Đã từ chối ${r.handled} nhu cầu và báo lý do cho người đăng.${skippedNote(r.skipped)}`
          : "Đã từ chối và báo lý do cho người đăng.",
      );
      setRejecting(null);
      setReason("");
      refresh();
    },
    onError: fail,
  });
  const bulkApprove = useMutation({
    mutationFn: () => adminDemandsApi.bulk([...selected], true, null),
    onSuccess: (r) => {
      toast.success(`Đã duyệt ${r.handled} nhu cầu.${skippedNote(r.skipped)}`);
      refresh();
    },
    onError: fail,
  });
  const busy = approve.isPending || reject.isPending || bulkApprove.isPending;

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <div className="max-w-[1000px] space-y-5 p-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Handshake className="h-6 w-6" />
          Duyệt nhu cầu
        </h1>
        <p className="text-sm text-muted-foreground">
          Nhu cầu bị bộ lọc tự động giữ lại. Chủ nhà chưa thấy chúng cho tới khi được duyệt; nhu cầu
          sạch đã được duyệt ngay khi đăng.
        </p>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {selected.size > 0 ? `Đã chọn ${selected.size}` : `${rows.length} nhu cầu chờ duyệt`}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setSelected(
                selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
              )
            }
          >
            {selected.size === rows.length ? "Bỏ chọn" : "Chọn tất cả"}
          </Button>
          <Button
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => bulkApprove.mutate()}
          >
            <Check className="mr-1.5 h-4 w-4" /> Duyệt đã chọn
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || selected.size === 0}
            onClick={() => setRejecting("bulk")}
          >
            <X className="mr-1.5 h-4 w-4" /> Từ chối đã chọn
          </Button>
        </div>
      )}

      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(q.error, "Không tải được hàng đợi")}
        </p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Không có nhu cầu nào chờ duyệt.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <DemandRow
              key={d.id}
              d={d}
              checked={selected.has(d.id)}
              onCheck={(on) => toggle(d.id, on)}
              busy={busy}
              onApprove={() => approve.mutate(d.id)}
              onReject={() => setRejecting(d.id)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={rejecting !== null}
        onOpenChange={(o) => {
          if (!o) setRejecting(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Từ chối nhu cầu</DialogTitle>
            <DialogDescription>
              Người đăng sẽ nhận lý do này và có thể sửa lời nhắn để gửi lại.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {REASON_PRESETS.map((p) => (
              <Button key={p} size="sm" variant="outline" onClick={() => setReason(p)}>
                {p}
              </Button>
            ))}
          </div>
          <Textarea
            id="reject-reason"
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do (bắt buộc)"
            aria-label="Lý do từ chối"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Huỷ
            </Button>
            <Button
              disabled={!reason.trim() || reject.isPending}
              onClick={() => rejecting && reject.mutate({ id: rejecting, why: reason.trim() })}
            >
              {reject.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DemandRow({
  d,
  checked,
  onCheck,
  busy,
  onApprove,
  onReject,
}: {
  d: AdminDemand;
  checked: boolean;
  onCheck: (on: boolean) => void;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex gap-3 p-4">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheck(v === true)}
          aria-label={`Chọn ${d.name}`}
          className="mt-1"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{d.name}</p>
            <span className="text-xs text-muted-foreground">
              Gửi {formatDateTime(d.submittedAt)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {(d.reviewReason ?? "")
              .split("; ")
              .filter(Boolean)
              .map((r) => (
                <Badge
                  key={r}
                  variant="outline"
                  className="border-amber-500/50 text-amber-700 dark:text-amber-400"
                >
                  {r}
                </Badge>
              ))}
          </div>
          <p className="text-sm text-muted-foreground">{describeDemand(d.criteria).join(" · ")}</p>
          {d.note && (
            <blockquote className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-sm">
              {d.note}
            </blockquote>
          )}
          <p className="text-xs text-muted-foreground">
            {d.userName} · {d.email}
            {!d.emailConfirmed && " (chưa xác thực)"} · tham gia {formatDate(d.userJoinedAt)}
          </p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" disabled={busy} onClick={onApprove}>
              <Check className="mr-1.5 h-4 w-4" /> Duyệt
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={onReject}>
              <X className="mr-1.5 h-4 w-4" /> Từ chối
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
