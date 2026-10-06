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
import { LISTING_STATUS, REPORT_ACTION, type ReportActionCode } from "@/constants/enums";
import type { ReportReasonCode } from "@/lib/api/listings";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  const [resolving, setResolving] = useState<{
    report: ListingReportDto;
    confirmed: boolean;
  } | null>(null);

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
        Kiểm duyệt trước khi đăng chỉ chặn được thứ nhìn là biết sai. Phần lớn cái sai thật sự —
        phòng đã cho thuê, ảnh lấy của nhà khác, đòi cọc trước khi xem — chỉ lộ ra sau khi có người
        gọi điện hỏi.
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

      {/* key theo báo cáo: mở báo cáo khác thì lựa chọn xử lý của lần trước không dính sang. */}
      <ResolveDialog
        key={resolving ? `${resolving.report.id}:${resolving.confirmed}` : "none"}
        state={resolving}
        onClose={() => setResolving(null)}
      />
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
              <p className="text-xs text-muted-foreground">Ghi chú xử lý: {r.handlerNote}</p>
            )}
          </div>

          {/* Trang công khai CHỈ tồn tại với tin đang hiển thị (status 2). Trước đây nút
              "Xem tin" hiện ra với mọi tin có slug, nên báo cáo về một tin đã đóng hoặc bị
              từ chối dẫn kiểm duyệt viên tới trang 404 — đúng lúc họ cần nhìn nội dung để
              quyết định. Tin đã không còn công khai thì bản thân điều đó là thông tin cần
              nói ra, vì nó thường làm báo cáo trở nên không còn phải xử lý gấp. */}
          {r.listingSlug && r.listingStatus === 2 ? (
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
              <Link to="/tin-dang/$slug" params={{ slug: r.listingSlug }} target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
                Xem tin
              </Link>
            </Button>
          ) : (
            <p className="w-40 shrink-0 text-right text-xs text-muted-foreground">
              Tin không còn hiển thị công khai ({LISTING_STATUS[r.listingStatus].toLowerCase()}) nên
              không mở xem được.
            </p>
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

/** Cách xử lý đề xuất theo lý do báo — khớp ReportOutcomes.DefaultAction ở máy chủ. */
const DEFAULT_ACTION: Record<ReportReasonCode, ReportActionCode> = {
  1: 1, // tin rác → gỡ
  2: 2, // sai thông tin → yêu cầu sửa
  3: 3, // đã cho thuê/bán → đóng
  4: 1, // lừa đảo → gỡ
  5: 1, // không phù hợp → gỡ
  6: 2, // khác → yêu cầu sửa
};

const RESULT_TEXT: Record<ReportActionCode, string> = {
  1: "Đã gỡ tin và báo cho chủ tin.",
  2: "Đã trả tin về cho chủ tin sửa.",
  3: "Đã đóng tin và báo cho chủ tin.",
};

function ResolveDialog({
  state,
  onClose,
}: {
  state: { report: ListingReportDto; confirmed: boolean } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  // null = chưa chọn tay → dùng đề xuất theo lý do báo.
  const [picked, setPicked] = useState<ReportActionCode | null>(null);
  const action: ReportActionCode | null = state
    ? (picked ?? DEFAULT_ACTION[state.report.reason])
    : null;
  // Chỉ tin ĐANG HIỂN THỊ mới cần xử lý; tin đã đóng/gỡ thì chỉ đóng báo cáo.
  const listingLive = state?.report.listingStatus === 2;

  const resolve = useMutation({
    mutationFn: () =>
      adminReportsApi.resolve(
        state!.report.id,
        state!.confirmed,
        note.trim() || null,
        listingLive ? action : null,
      ),
    onSuccess: (r) => {
      // Làm mới mọi tab, không riêng tab đang mở: báo cáo vừa xử lý phải biến khỏi tab
      // "chờ xử lý" và xuất hiện ở tab kia.
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      qc.invalidateQueries({ queryKey: ["admin-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setNote("");
      setPicked(null);
      onClose();
      toast.success(r.appliedAction ? RESULT_TEXT[r.appliedAction] : "Đã xử lý báo cáo.");
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
              ? listingLive
                ? "Đánh dấu báo cáo là đúng và xử lý tin ngay. Chủ tin nhận thông báo kèm lý do."
                : "Đánh dấu báo cáo là đúng. Tin đã không còn hiển thị nên không cần xử lý thêm."
              : "Đánh dấu tin này không vi phạm. Báo cáo sẽ được đóng lại, tin giữ nguyên."}
            {others > 0 && (
              <> Thao tác này đóng luôn {others} báo cáo đang chờ khác trên cùng tin.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {confirmed && listingLive && action && (
          <div className="space-y-1.5">
            <Label>Xử lý tin đăng</Label>
            <RadioGroup
              value={String(action)}
              onValueChange={(v) => setPicked(Number(v) as ReportActionCode)}
              className="gap-2"
            >
              {([1, 2, 3] as ReportActionCode[]).map((a) => (
                <label
                  key={a}
                  className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 has-[[data-state=checked]]:border-primary"
                >
                  <RadioGroupItem value={String(a)} className="mt-0.5" />
                  <span className="text-sm">
                    <span className="font-medium">{REPORT_ACTION[a].label}</span>
                    {a === DEFAULT_ACTION[report.reason] && (
                      <span className="ml-1 text-xs text-muted-foreground">(đề xuất)</span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {REPORT_ACTION[a].hint}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="resolve-note">Ghi chú (không bắt buộc)</Label>
          <Textarea
            id="resolve-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={
              confirmed && listingLive
                ? "Ghi chú này được gửi kèm thông báo cho chủ tin."
                : "Ghi lại kết luận để người kiểm duyệt sau hiểu vì sao đóng."
            }
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
