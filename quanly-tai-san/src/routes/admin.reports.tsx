import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Flag,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { adminReportsApi } from "@/lib/api/admin";
import {
  REPORT_REASON,
  REPORT_STATUS,
  type ListingReportDto,
  type ReportStatusCode,
} from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { LISTING_STATUS } from "@/constants/enums";
import { AdminRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Báo vi phạm — KGS" }] }),
  component: () => (
    <AdminRoute>
      <AdminReportsPage />
    </AdminRoute>
  ),
});

const TABS: { value: ReportStatusCode | "all"; label: string }[] = [
  { value: 1, label: "Chờ xử lý" },
  { value: 2, label: "Đã xử lý" },
  { value: 3, label: "Không vi phạm" },
  { value: "all", label: "Tất cả" },
];

function AdminReportsPage() {
  const [tab, setTab] = useState<ReportStatusCode | "all">(1);
  const [resolving, setResolving] = useState<{ report: ListingReportDto; confirmed: boolean } | null>(
    null,
  );

  const query = useQuery({
    queryKey: ["admin-reports", tab],
    queryFn: () => adminReportsApi.list(tab === "all" ? undefined : tab),
    retry: 1,
  });

  const reports = query.data ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Báo vi phạm tin đăng</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Kiểm duyệt trước khi đăng chỉ chặn được thứ nhìn là biết sai. Phần lớn cái sai thật
        sự — phòng đã cho thuê, ảnh lấy của nhà khác, đòi cọc trước khi xem — chỉ lộ ra sau
        khi có người gọi điện hỏi.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Button
            key={String(t.value)}
            variant={tab === t.value ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive/60" />
            <p className="text-sm text-destructive">
              {getErrorMessage(query.error, "Không tải được danh sách báo cáo")}
            </p>
            <Button size="sm" variant="outline" onClick={() => query.refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-1.5">
            <ShieldCheck className="h-10 w-10 mx-auto text-success/50 mb-1" />
            <p>Không có báo cáo nào trong mục này.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              onResolve={(confirmed) => setResolving({ report: r, confirmed })}
            />
          ))}
        </div>
      )}

      <ResolveDialog state={resolving} onClose={() => setResolving(null)} />
    </div>
  );
}

function ReportCard({
  report: r,
  onResolve,
}: {
  report: ListingReportDto;
  onResolve: (confirmed: boolean) => void;
}) {
  const pending = r.status === 1;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={pending ? "default" : "secondary"}>{REPORT_STATUS[r.status]}</Badge>
              <Badge variant="outline" className="font-normal">
                {LISTING_STATUS[r.listingStatus]}
              </Badge>
              {/* Nhiều người khác nhau cùng báo một tin là tín hiệu mạnh hơn hẳn — và ràng
                  buộc một-báo-cáo-mỗi-người ở CSDL đảm bảo con số này đúng là số người. */}
              {r.pendingCountOnListing > 1 && (
                <Badge variant="destructive" className="font-normal">
                  {r.pendingCountOnListing} người cùng báo
                </Badge>
              )}
            </div>

            <p className="font-medium truncate">{r.listingTitle}</p>

            <p className="text-sm">
              <span className="text-muted-foreground">Lý do: </span>
              {REPORT_REASON[r.reason]}
            </p>

            {r.detail && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.detail}</p>
            )}

            <p className="text-xs text-muted-foreground">
              {r.reporterName} · {formatDateTime(r.createdAt)}
            </p>

            {!pending && r.handlerNote && (
              <p className="text-xs text-muted-foreground">
                Ghi chú xử lý: {r.handlerNote}
              </p>
            )}
          </div>

          {r.listingSlug && (
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
              <Link to="/tin-dang/$slug" params={{ slug: r.listingSlug }} target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
                Xem tin
              </Link>
            </Button>
          )}
        </div>

        {pending && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="destructive" onClick={() => onResolve(true)}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Có vi phạm
            </Button>
            <Button size="sm" variant="outline" onClick={() => onResolve(false)}>
              <XCircle className="h-4 w-4 mr-1.5" />
              Tin không sai
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResolveDialog({
  state,
  onClose,
}: {
  state: { report: ListingReportDto; confirmed: boolean } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const resolve = useMutation({
    mutationFn: () => adminReportsApi.resolve(state!.report.id, state!.confirmed, note.trim() || null),
    onSuccess: () => {
      // Làm mới mọi tab, không riêng tab đang mở: báo cáo vừa xử lý phải biến khỏi tab
      // "chờ xử lý" và xuất hiện ở tab kia.
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      setNote("");
      onClose();
      toast.success("Đã xử lý báo cáo.");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không xử lý được báo cáo")),
  });

  if (!state) return null;

  const { report, confirmed } = state;
  const others = report.pendingCountOnListing - 1;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {confirmed ? "Xác nhận tin có vi phạm" : "Kết luận tin không sai"}
          </DialogTitle>
          <DialogDescription>
            {confirmed
              ? "Đánh dấu báo cáo là đúng. Nếu cần gỡ tin xuống, dùng màn hình duyệt tin đăng."
              : "Đánh dấu tin này không vi phạm. Báo cáo sẽ được đóng lại."}
            {others > 0 && (
              <>
                {" "}
                Thao tác này đóng luôn {others} báo cáo đang chờ khác trên cùng tin.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="resolve-note">Ghi chú (không bắt buộc)</Label>
          <Textarea
            id="resolve-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ghi lại kết luận để người kiểm duyệt sau hiểu vì sao đóng."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            variant={confirmed ? "destructive" : "default"}
            disabled={resolve.isPending}
            onClick={() => resolve.mutate()}
          >
            {resolve.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

