import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ExternalLink,
  Flag,
  ListChecks,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  ShieldOff,
  X,
} from "lucide-react";
import { AdminRoute } from "@/components/auth/ProtectedRoute";
import { adminManageApi, type AdminListingQuery, type AdminListingRow } from "@/lib/api/admin";
import { formatListingPrice } from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import {
  LISTING_STATUS,
  LISTING_STATUS_CLASS,
  MODERATION_REASON,
  type ListingStatusCode,
  type ModerationReasonCode,
} from "@/constants/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Search {
  ownerId?: string;
  ownerName?: string;
}

export const Route = createFileRoute("/admin/all-listings")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ownerId: typeof s.ownerId === "string" ? s.ownerId : undefined,
    ownerName: typeof s.ownerName === "string" ? s.ownerName : undefined,
  }),
  head: () => ({ meta: [{ title: "Tất cả tin đăng — KGS" }] }),
  component: () => (
    <AdminRoute>
      <AllListingsPage />
    </AdminRoute>
  ),
});

const PAGE_SIZE = 20;
const ALL = "all";

function AllListingsPage() {
  const { ownerId, ownerName } = Route.useSearch();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [type, setType] = useState<string>(ALL);
  const [reportedOnly, setReportedOnly] = useState(false);
  const [sort, setSort] = useState<NonNullable<AdminListingQuery["sort"]>>("newest");
  const [page, setPage] = useState(1);
  const [takingDown, setTakingDown] = useState<AdminListingRow | null>(null);
  const [restoring, setRestoring] = useState<AdminListingRow | null>(null);

  // Gõ tới đâu lọc tới đó, nhưng đợi người dùng ngừng gõ một nhịp mới gọi API.
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => setPage(1), [q, status, type, reportedOnly, sort, ownerId]);

  const filters: AdminListingQuery = {
    q,
    status: status === ALL ? "" : (Number(status) as ListingStatusCode),
    type: type === ALL ? "" : (Number(type) as 1 | 2),
    ownerId,
    reportedOnly: reportedOnly || undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  };
  const query = useQuery({
    queryKey: ["admin-all-listings", filters],
    queryFn: () => adminManageApi.listings(filters),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <ListChecks className="h-5 w-5 text-muted-foreground" /> Tất cả tin đăng
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mọi tin trên hệ thống, ở mọi trạng thái. Gỡ được tin đang hiển thị mà không cần đợi ai
          báo, và khôi phục tin đã gỡ nhầm.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tiêu đề, người đăng, email, quận, mã tin…"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi trạng thái</SelectItem>
            {Object.entries(LISTING_STATUS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Bán & thuê</SelectItem>
            <SelectItem value="1">Bán</SelectItem>
            <SelectItem value="2">Cho thuê</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Mới tạo trước</SelectItem>
            <SelectItem value="reports">Nhiều báo vi phạm</SelectItem>
            <SelectItem value="views">Nhiều lượt xem</SelectItem>
            <SelectItem value="price">Giá cao trước</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={reportedOnly} onCheckedChange={(v) => setReportedOnly(v === true)} />
          Đang bị báo
        </label>
      </div>

      {ownerId && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="gap-1.5">
            Của: {ownerName ?? ownerId}
            <button
              type="button"
              aria-label="Bỏ lọc theo người đăng"
              onClick={() => navigate({ to: "/admin/all-listings", search: {} })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tin đăng</TableHead>
              <TableHead>Người đăng</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Giá</TableHead>
              <TableHead className="text-center">Báo</TableHead>
              <TableHead className="text-right">Xem</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Không có tin nào khớp bộ lọc.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="max-w-[340px]">
                  <div className="truncate font-medium" title={l.title}>
                    {l.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {l.unitName ? `${l.unitName} · ` : ""}
                    {l.district}, {l.city}
                  </div>
                  {l.moderationNote && l.status !== 2 && (
                    <div
                      className={`mt-0.5 line-clamp-2 text-xs ${
                        l.status === 3 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {l.moderationNote}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  <Link
                    to="/admin/users"
                    search={{ focus: l.ownerId }}
                    className="font-medium hover:underline"
                  >
                    {l.ownerName}
                  </Link>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {l.ownerLocked && <Lock className="h-3 w-3 text-destructive" />}
                    {l.ownerEmail}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`whitespace-nowrap ${LISTING_STATUS_CLASS[l.status]}`}
                  >
                    {LISTING_STATUS[l.status]}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-sm font-medium">
                  {formatListingPrice(l.price, l.type, l.rentPaymentCycle)}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {l.pendingReports > 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <Flag className="h-3 w-3" /> {l.pendingReports}
                    </Badge>
                  ) : l.confirmedReports > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {l.confirmedReports} đã xử lý
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{l.viewCount}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(l.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {l.status === 2 && l.slug && (
                      <Button variant="ghost" size="icon" asChild title="Xem tin công khai">
                        <Link to="/tin-dang/$slug" params={{ slug: l.slug }} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {(l.status === 1 || l.status === 2) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setTakingDown(l)}
                      >
                        <ShieldOff className="mr-1 h-4 w-4" /> Gỡ
                      </Button>
                    )}
                    {l.canRestore && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={l.ownerLocked}
                        title={l.ownerLocked ? "Mở khoá tài khoản người đăng trước" : undefined}
                        onClick={() => setRestoring(l)}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" /> Khôi phục
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.totalCount} tin · trang {page}/{pages}
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

      <TakeDownDialog
        key={takingDown?.id ?? "none"}
        listing={takingDown}
        onClose={() => setTakingDown(null)}
      />
      <RestoreDialog
        key={restoring?.id ?? "none-r"}
        listing={restoring}
        onClose={() => setRestoring(null)}
      />
    </div>
  );
}

function useAfterAction(onClose: () => void) {
  const qc = useQueryClient();
  return (msg: string) => {
    qc.invalidateQueries({ queryKey: ["admin-all-listings"] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-user"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    toast.success(msg);
    onClose();
  };
}

function TakeDownDialog({
  listing,
  onClose,
}: {
  listing: AdminListingRow | null;
  onClose: () => void;
}) {
  const [reasons, setReasons] = useState<ModerationReasonCode[]>(
    listing?.pendingReports ? [7] : [],
  );
  const [note, setNote] = useState("");
  const done = useAfterAction(onClose);
  const needNote = reasons.includes(99) && !note.trim();
  const m = useMutation({
    mutationFn: () => adminManageApi.takeDown(listing!.id, reasons, note.trim() || null),
    onSuccess: (r) => done(r.message),
    onError: (e) => toast.error(getErrorMessage(e, "Không gỡ được tin")),
  });
  if (!listing) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gỡ tin đăng</DialogTitle>
          <DialogDescription>
            “{listing.title}” sẽ biến khỏi trang tìm kiếm và chuyển về “Bị từ chối”. Chủ tin nhận
            thông báo kèm lý do, sửa xong có thể gửi duyệt lại.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Lý do (chọn ít nhất một)</Label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MODERATION_REASON).map(Number) as ModerationReasonCode[]).map((r) => {
              const on = reasons.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReasons(on ? reasons.filter((x) => x !== r) : [...reasons, r])}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    on
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {MODERATION_REASON[r]}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="td-note">
            Ghi chú gửi chủ tin {reasons.includes(99) ? "(bắt buộc)" : "(không bắt buộc)"}
          </Label>
          <Textarea
            id="td-note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            variant="destructive"
            disabled={reasons.length === 0 || needNote || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Gỡ tin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestoreDialog({
  listing,
  onClose,
}: {
  listing: AdminListingRow | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const done = useAfterAction(onClose);
  const m = useMutation({
    mutationFn: () => adminManageApi.restore(listing!.id, note.trim() || null),
    onSuccess: (r) => done(r.message),
    onError: (e) => toast.error(getErrorMessage(e, "Không khôi phục được tin")),
  });
  if (!listing) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Khôi phục tin đăng</DialogTitle>
          <DialogDescription>
            “{listing.title}” hiển thị trở lại và chủ tin được báo. Tin bị gỡ khi còn đang chờ duyệt
            sẽ quay về hàng đợi duyệt thay vì lên trang ngay.
          </DialogDescription>
        </DialogHeader>
        {listing.moderationNote && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Lý do lúc gỡ: {listing.moderationNote}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="rs-note">Ghi chú (không bắt buộc)</Label>
          <Textarea
            id="rs-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Khôi phục
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
