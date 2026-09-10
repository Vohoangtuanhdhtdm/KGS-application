import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi, type AdminPendingListing } from "@/lib/api/admin";
import { getErrorMessage } from "@/lib/api/errors";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  AMENITIES,
  LISTING_STATUS,
  LISTING_TYPE,
  MODERATION_REASON,
  type AmenityKey,
  type ListingStatusCode,
  type ModerationReasonCode,
} from "@/constants/enums";
import { AdminRoute } from "@/components/auth/ProtectedRoute";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Check,
  ImageIcon,
  Inbox,
  Mail,
  MapPin,
  PenLine,
  Phone,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

export const Route = createFileRoute("/admin/listings")({
  head: () => ({ meta: [{ title: "Duyệt tin đăng — KGS" }] }),
  component: () => (
    <AdminRoute>
      <AdminModerationPage />
    </AdminRoute>
  ),
});

const STAT_ORDER: ListingStatusCode[] = [1, 2, 3, 4];
const STAT_TONE: Record<ListingStatusCode, string> = {
  1: "text-muted-foreground",
  2: "text-success",
  3: "text-destructive",
  4: "text-foreground",
  5: "text-muted-foreground",
  6: "text-warning-foreground",
};

/**
 * Lý do từ chối theo mẫu.
 *
 * Có mẫu sẵn không phải để tiết kiệm gõ phím mà để lý do NHẤT QUÁN giữa các lần duyệt:
 * hai tin sai cùng một kiểu phải nhận cùng một lời giải thích, nếu không chủ tin sẽ không
 * học được cách sửa. Vẫn cho sửa lại tự do vì luôn có ca ngoại lệ.
 */
const REJECT_TEMPLATES = [
  "Ảnh không phải ảnh thật của bất động sản, hoặc lấy từ nguồn khác.",
  "Thông tin giá không khớp với mô tả, hoặc giá không có thật nhằm câu khách.",
  "Mô tả quá sơ sài, không đủ thông tin để người thuê quyết định.",
  "Địa chỉ không rõ ràng hoặc không tồn tại.",
  "Nội dung trùng lặp với một tin khác đang hiển thị.",
  "Tin có dấu hiệu lừa đảo hoặc yêu cầu đặt cọc trước khi xem nhà.",
];

/** `embedded` = đang render bên trong FeatureSheet: bỏ padding/tiêu đề trùng lặp. */
export function AdminModerationPage({ embedded = false }: { embedded?: boolean } = {}) {
  const qc = useQueryClient();

  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  /** Khi bật, hộp từ chối đang xử lý cả lô đã tick chứ không phải một tin. */
  const [rejectBulk, setRejectBulk] = useState(false);

  const statsQ = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminApi.stats(), retry: 1 });

  /**
   * Số trang của hàng đợi.
   *
   * Máy chủ vẫn luôn phân trang (20 tin/trang, kèm totalCount), nhưng phía giao diện
   * trước đây không gửi `page` và cũng không dựng nút chuyển trang — nên nó vĩnh viễn
   * đứng ở trang 1. Dữ liệu thử nghiệm có đúng 20 tin chờ duyệt nên trông vẫn đủ, và đó
   * chính là lý do lỗi này lọt qua: hàng đợi thứ 21 trở đi không có đường nào tới được.
   */
  const [page, setPage] = useState(1);

  const filters = {
    keyword: keyword.trim() || undefined,
    type: type === "all" ? undefined : (Number(type) as 1 | 2),
    page,
  };

  // Đổi điều kiện lọc thì tập kết quả khác hẳn — giữ nguyên số trang cũ sẽ nhảy vào giữa
  // một danh sách mới, hoặc rơi vào trang trống.
  useEffect(() => {
    setPage(1);
  }, [keyword, type]);

  const queueQ = useQuery({
    queryKey: ["admin-pending", filters],
    queryFn: () => adminApi.pending(filters),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const rows = queueQ.data?.items ?? [];
  const totalCount = queueQ.data?.totalCount ?? 0;
  const pageSize = queueQ.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstOnPage = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastOnPage = Math.min(page * pageSize, totalCount);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-pending"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    setChecked(new Set());
  };

  const moderate = useMutation({
    mutationFn: ({ ids, approve, reason }: { ids: string[]; approve: boolean; reason?: string }) =>
      adminApi.bulk(ids, approve, reason),
    onSuccess: (res, vars) => {
      refresh();
      if (selectedId && vars.ids.includes(selectedId)) setSelectedId(null);
      toast.success(
        vars.approve ? `Đã duyệt ${res.succeeded} tin` : `Đã từ chối ${res.succeeded} tin`,
        res.skipped > 0
          ? { description: `${res.skipped} tin bị bỏ qua: ${res.messages[0] ?? ""}` }
          : undefined,
      );
      setRejectOpen(false);
      setRejectReason("");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không xử lý được")),
  });

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* Hộp "Yêu cầu chỉnh sửa".
     Lý do chọn từ danh sách chuẩn thay vì gõ tự do — xem chú thích ở enum ModerationReason
     phía backend. Ghi chú tự do vẫn giữ, vì danh sách cố định không phủ hết mọi trường hợp. */
  const [changesOpen, setChangesOpen] = useState(false);
  const [changeReasons, setChangeReasons] = useState<Set<ModerationReasonCode>>(new Set());
  const [changeNote, setChangeNote] = useState("");

  const requestChanges = useMutation({
    mutationFn: () =>
      adminApi.requestChanges(selectedId!, [...changeReasons], changeNote.trim() || null),
    onSuccess: () => {
      refresh();
      setSelectedId(null);
      setChangesOpen(false);
      setChangeReasons(new Set());
      setChangeNote("");
      toast.success("Đã gửi yêu cầu chỉnh sửa cho chủ tin");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không gửi được yêu cầu")),
  });

  const toggleReason = (r: ModerationReasonCode) =>
    setChangeReasons((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });

  // "Khác" mà không ghi rõ thì yêu cầu chỉnh sửa không nói được điều gì — đúng lúc mục đích
  // của nó là nói rõ phải sửa gì. Backend cũng chặn, đây chỉ là chặn sớm cho đỡ mất công.
  const thieuGhiChu = changeReasons.has(99) && !changeNote.trim();
  const guiDuocYeuCau = changeReasons.size > 0 && !thieuGhiChu;

  const openReject = (bulk: boolean) => {
    setRejectBulk(bulk);
    setRejectReason("");
    setRejectOpen(true);
  };

  const doReject = () => {
    const ids = rejectBulk ? [...checked] : selectedId ? [selectedId] : [];
    if (ids.length === 0) return;
    moderate.mutate({ ids, approve: false, reason: rejectReason.trim() });
  };

  return (
    <div className={embedded ? "space-y-5" : "p-6 space-y-5 max-w-[1400px]"}>
      <div>
        {!embedded && (
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Duyệt tin đăng
          </h1>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          Xem trọn nội dung tin trước khi quyết định. Chủ tin nhận email kèm lý do khi bị từ chối.
        </p>
      </div>

      {/* Thống kê */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {STAT_ORDER.map((code) => {
          const found = statsQ.data?.byStatus.find((s) => String(s.status) === LISTING_STATUS_KEY[code]);
          return (
            <Card key={code}>
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {LISTING_STATUS[code]}
                </div>
                <div className={`text-2xl font-semibold tabular-nums ${STAT_TONE[code]}`}>
                  {statsQ.isLoading ? "—" : (found?.count ?? 0)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bộ lọc + thao tác hàng loạt */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo tiêu đề, tên hoặc email người đăng"
            className="pl-9"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi loại tin</SelectItem>
            <SelectItem value="1">Bán</SelectItem>
            <SelectItem value="2">Cho thuê</SelectItem>
          </SelectContent>
        </Select>

        {checked.size > 0 && (
          <>
            <Button
              size="sm"
              disabled={moderate.isPending}
              onClick={() => moderate.mutate({ ids: [...checked], approve: true })}
            >
              <Check className="h-4 w-4 mr-1.5" />
              Duyệt {checked.size} tin
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={moderate.isPending}
              onClick={() => openReject(true)}
            >
              <X className="h-4 w-4 mr-1.5" />
              Từ chối {checked.size} tin
            </Button>
          </>
        )}
      </div>

      {/* Hàng đợi + khung xem trước */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr] items-start">
        <Card>
          <CardContent className="p-0">
            {queueQ.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                Không có tin nào chờ duyệt.
              </div>
            ) : (
              <ul className="divide-y">
                {rows.map((l) => (
                  <QueueRow
                    key={l.id}
                    listing={l}
                    active={selectedId === l.id}
                    checked={checked.has(l.id)}
                    onToggle={() => toggle(l.id)}
                    onSelect={() => setSelectedId(l.id)}
                  />
                ))}
              </ul>
            )}
            {totalCount > pageSize && (
              <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {firstOnPage}–{lastOnPage} / {totalCount}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={page <= 1 || queueQ.isFetching}
                    onClick={() => setPage((n) => Math.max(1, n - 1))}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={page >= totalPages || queueQ.isFetching}
                    onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <PreviewPanel
          listingId={selectedId}
          busy={moderate.isPending}
          onApprove={() => selectedId && moderate.mutate({ ids: [selectedId], approve: true })}
          onRequestChanges={() => setChangesOpen(true)}
          onReject={() => openReject(false)}
        />
      </div>

      {/* Hộp nhập lý do từ chối */}
      {/* Hộp yêu cầu chỉnh sửa */}
      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yêu cầu chủ tin chỉnh sửa</DialogTitle>
            <DialogDescription>
              Tin không bị xoá và không mang tiếng bị từ chối. Chủ tin sửa xong sẽ gửi duyệt
              lại, và thấy đúng những mục bạn chọn dưới đây.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Cần sửa những gì</Label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {(Object.keys(MODERATION_REASON) as unknown as ModerationReasonCode[]).map((k) => {
                const code = Number(k) as ModerationReasonCode;
                const chon = changeReasons.has(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleReason(code)}
                    aria-pressed={chon}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      chon
                        ? "border-primary bg-primary/5 font-medium"
                        : "hover:bg-accent"
                    }`}
                  >
                    {MODERATION_REASON[code]}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Ghi chú {changeReasons.has(99) ? "(bắt buộc khi chọn Lý do khác)" : "(không bắt buộc)"}
              </Label>
              <Textarea
                rows={3}
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Nói cụ thể để chủ tin sửa được ngay, ví dụ: thiếu ảnh phòng tắm và chưa khai giá điện."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={!guiDuocYeuCau || requestChanges.isPending}
              onClick={() => requestChanges.mutate()}
            >
              Gửi yêu cầu
            </Button>
          </DialogFooter>
          {changeReasons.size === 0 && (
            <p className="text-xs text-muted-foreground">Chọn ít nhất một mục cần sửa.</p>
          )}
          {thieuGhiChu && (
            <p className="text-xs text-destructive">Chọn "Lý do khác" thì phải ghi rõ cần sửa gì.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {rejectBulk ? `Từ chối ${checked.size} tin` : "Từ chối tin đăng"}
            </DialogTitle>
            <DialogDescription>
              Lý do được gửi qua email cho chủ tin và lưu lại trên tin. Hãy viết sao cho họ biết
              phải sửa gì.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Chọn nhanh</Label>
              <div className="flex flex-col gap-1.5">
                {REJECT_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRejectReason(t)}
                    className={`text-left text-sm rounded-md border px-3 py-2 transition-colors ${
                      rejectReason === t ? "border-primary bg-primary/5" : "hover:bg-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reject-reason">Lý do gửi cho chủ tin</Label>
              <Textarea
                id="reject-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={500}
                placeholder="Chọn một mẫu ở trên hoặc tự viết..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length < 10 || moderate.isPending}
              onClick={doReject}
            >
              Từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Backend trả status dạng chuỗi tên enum; map lại để đếm đúng ô. */
const LISTING_STATUS_KEY: Record<ListingStatusCode, string> = {
  1: "Pending",
  2: "Approved",
  3: "Rejected",
  4: "Closed",
  5: "Draft",
  6: "ChangesRequested",
};

function QueueRow({
  listing: l,
  active,
  checked,
  onToggle,
  onSelect,
}: {
  listing: AdminPendingListing;
  active: boolean;
  checked: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <li
      className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${
        active ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50 border-l-2 border-l-transparent"
      }`}
      onClick={onSelect}
    >
      <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
        <Checkbox checked={checked} onCheckedChange={onToggle} aria-label="Chọn tin" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm font-medium leading-snug line-clamp-2">{l.title}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>{formatCurrency(l.price)}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {l.district}
          </span>
          {/* Số ảnh là tiêu chí duyệt: tin không ảnh gần như luôn phải trả lại. Biểu tượng
              một mình thì kiểm duyệt viên phải đoán con số đó đếm cái gì. */}
          <span className="inline-flex items-center gap-1" title="Số ảnh">
            <ImageIcon className="h-3 w-3" />
            {l.imageCount}
            <span className="sr-only">ảnh</span>
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate">{l.ownerName}</div>
      </div>
    </li>
  );
}

/**
 * Khung xem trước — thứ thiếu hẳn ở bản cũ.
 *
 * Admin cần thấy ảnh, mô tả, chi phí và thông tin người đăng thì mới quyết định được.
 * Không có nó thì nút Duyệt chỉ là một nút bấm cho xong.
 */
function PreviewPanel({
  listingId,
  busy,
  onApprove,
  onRequestChanges,
  onReject,
}: {
  listingId: string | null;
  busy: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
}) {
  const query = useQuery({
    queryKey: ["admin-listing", listingId],
    queryFn: () => adminApi.detail(listingId!),
    enabled: !!listingId,
    retry: 1,
  });

  if (!listingId) {
    return (
      <Card>
        <CardContent className="py-24 text-center text-sm text-muted-foreground">
          Chọn một tin ở danh sách bên trái để xem nội dung.
        </CardContent>
      </Card>
    );
  }

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-destructive">
          {getErrorMessage(query.error, "Không tải được nội dung tin")}
        </CardContent>
      </Card>
    );
  }

  const d = query.data;
  const address = [d.addressDetail, d.ward, d.district, d.city].filter(Boolean).join(", ");

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        {/* Ảnh: thứ cần nhìn đầu tiên khi kiểm duyệt */}
        {d.imageUrls.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {d.imageUrls.slice(0, 6).map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Ảnh ${i + 1}`}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-md object-cover border"
                />
              </a>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-warning" />
            Tin không có ảnh nào.
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{LISTING_TYPE[d.type]}</Badge>
            <Badge variant="outline">{d.assetTypeLabel}</Badge>
            {d.unitName && <Badge variant="secondary">{d.unitName}</Badge>}
            <span className="text-xs text-muted-foreground">
              Gửi lúc {formatDateTime(d.createdAt)}
            </span>
          </div>
          <h2 className="text-lg font-semibold leading-snug">{d.title}</h2>
          <div className="text-primary font-semibold">
            {formatCurrency(d.price)}
            {d.type === 2 && d.totalMonthlyCost > d.price && (
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                · tổng cố định {formatCurrency(d.totalMonthlyCost)}/tháng
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {address || "Chưa có địa chỉ"}
          </p>
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-52 overflow-y-auto">
          {d.description}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          <Spec label="Diện tích" value={d.area ? `${d.area} m²` : null} />
          <Spec label="Phòng ngủ" value={d.bedrooms?.toString() ?? null} />
          <Spec label="Phòng tắm" value={d.bathrooms?.toString() ?? null} />
          <Spec label="Số tầng" value={d.floors?.toString() ?? null} />
          <Spec label="Hướng" value={d.houseDirection} />
          <Spec label="Pháp lý" value={d.legalStatus} />
          <Spec label="Nội thất" value={d.furnitureState} />
          <Spec label="Độ đầy đủ" value={`${d.completenessPercent}%`} />
        </div>

        {d.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {d.amenities.map((a) => (
              <Badge key={a} variant="secondary" className="font-normal text-xs">
                {AMENITIES[a as AmenityKey] ?? a}
              </Badge>
            ))}
          </div>
        )}

        {/* Người đăng — số tin của họ là tín hiệu quan trọng khi soi tin rác */}
        <div className="rounded-md border p-3 space-y-1 text-sm">
          <div className="font-medium">{d.ownerName}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {d.ownerEmail}
            </span>
            {d.ownerPhone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {d.ownerPhone}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Đã đăng tổng cộng {d.ownerListingCount} tin
            {d.ownerListingCount > 20 && (
              <span className="text-warning-foreground"> — kiểm tra kỹ, có thể đăng hàng loạt</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button disabled={busy} onClick={onApprove}>
            <Check className="h-4 w-4 mr-1.5" />
            Duyệt tin
          </Button>
          {/* Bậc trung gian. Đặt GIỮA hai nút cũ và dùng dáng outline chứ không phải
              destructive: nó không phải một phán quyết, mà là một lời nhắc việc. */}
          <Button variant="outline" disabled={busy} onClick={onRequestChanges}>
            <PenLine className="h-4 w-4 mr-1.5" />
            Yêu cầu chỉnh sửa
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onReject} className="text-destructive hover:text-destructive">
            <X className="h-4 w-4 mr-1.5" />
            Từ chối
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Spec({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5">{value || "—"}</div>
    </div>
  );
}
