import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listingsApi, formatListingPrice, type OwnerListingDto } from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { LISTING_TYPE, LISTING_STATUS, LISTING_STATUS_CLASS } from "@/constants/enums";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowUp,
  Eye,
  Megaphone,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/tin-cua-toi")({
  head: () => ({ meta: [{ title: "Tin đăng của tôi — Quản Lý Tài Sản" }] }),
  component: MyListingsPage,
});

/** `embedded` = đang render bên trong FeatureSheet: bỏ padding/tiêu đề trùng lặp. */
/**
 * Thanh độ đầy đủ dữ kiện.
 *
 * Đây là động lực thay cho việc bắt buộc nhập: tin khai đủ cọc, điện nước, nội quy thì lọt
 * được vào các bộ lọc mà người thuê dùng — và sắp tới là vào cả điều kiện tìm kiếm của
 * AI Agent. Tin bỏ trống sẽ bị loại khỏi mọi truy vấn có ràng buộc, dù thực tế có phù hợp.
 */
function Completeness({ percent }: { percent: number }) {
  const tone =
    percent >= 80 ? "bg-success" : percent >= 50 ? "bg-warning" : "bg-destructive";

  return (
    <div className="flex items-center gap-2 min-w-[112px]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
        {percent}%
      </span>
    </div>
  );
}

export function MyListingsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const refresh = () => qc.invalidateQueries({ queryKey: ["my-listings"] });

  const bump = useMutation({
    mutationFn: (id: string) => listingsApi.bump(id),
    onSuccess: () => {
      refresh();
      toast.success("Đã đẩy tin lên đầu danh sách");
    },
    // Lỗi hay gặp nhất ở đây là chưa hết 24 giờ chờ — backend trả nguyên câu giải
    // thích kèm thời gian còn lại, nên hiện thẳng nó ra.
    onError: (e) => toast.error(getErrorMessage(e, "Không đẩy được tin")),
  });

  const close = useMutation({
    mutationFn: (id: string) => listingsApi.close(id),
    onSuccess: () => {
      refresh();
      toast.success("Đã đóng tin", { description: "Bạn có thể mở lại bất cứ lúc nào." });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không đóng được tin")),
  });

  const reopen = useMutation({
    mutationFn: (id: string) => listingsApi.reopen(id),
    onSuccess: (l) => {
      refresh();
      toast.success("Đã mở lại", { description: "Tin về bản nháp — kiểm tra giá rồi gửi duyệt lại." });
      navigate({ to: "/dang-tin", search: { id: l.id } });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không mở lại được tin")),
  });

  const removeDraft = useMutation({
    mutationFn: (id: string) => listingsApi.deleteDraft(id),
    onSuccess: () => {
      refresh();
      toast.success("Đã xoá bản nháp");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không xoá được bản nháp")),
  });

  const busy = bump.isPending || close.isPending || reopen.isPending || removeDraft.isPending;

  const query = useQuery({
    queryKey: ["my-listings"],
    queryFn: () => listingsApi.mine(),
    retry: 1,
  });

  const rows = query.data ?? [];

  const openListing = (l: OwnerListingDto) => {
    // Chỉ tin đã duyệt mới có trang công khai; tin khác không điều hướng
    if (l.status === 2 && l.slug) navigate({ to: "/tin-dang/$slug", params: { slug: l.slug } });
  };

  return (
    <div className={embedded ? "space-y-5" : "p-6 space-y-5 max-w-[1200px]"}>
      <div>
        {!embedded && <h1 className="text-2xl font-semibold tracking-tight">Tin đăng của tôi</h1>}
        <p className="text-sm text-muted-foreground mt-1">
          Theo dõi trạng thái duyệt và lượt xem các tin đăng bạn đã gửi lên marketplace.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="py-10 text-center text-sm text-destructive">
              {getErrorMessage(query.error, "Không tải được danh sách tin đăng")}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground space-y-3">
              <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p>Bạn chưa đăng tin nào.</p>
              <Button asChild>
                <Link to="/dang-tin">Đăng tin đầu tiên</Link>
              </Button>
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Giá</TableHead>
                    <TableHead className="text-center">Lượt xem</TableHead>
                    <TableHead>Độ đầy đủ</TableHead>
                    <TableHead>Ngày đăng</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => {
                    const approved = l.status === 2;
                    const row = (
                      <TableRow
                        key={l.id}
                        className={approved ? "cursor-pointer" : "cursor-default"}
                        onClick={() => openListing(l)}
                      >
                        <TableCell className="font-medium">{l.title}</TableCell>
                        <TableCell className="text-sm">{LISTING_TYPE[l.type]}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={LISTING_STATUS_CLASS[l.status]}>
                            {LISTING_STATUS[l.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatListingPrice(l.price, l.type, l.rentPaymentCycle)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                            <Eye className="h-3.5 w-3.5" />
                            {l.viewCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Completeness percent={l.completenessPercent} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(l.createdAt)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <RowActions
                            listing={l}
                            busy={busy}
                            onEdit={() => navigate({ to: "/dang-tin", search: { id: l.id } })}
                            onBump={() => bump.mutate(l.id)}
                            onClose={() => close.mutate(l.id)}
                            onReopen={() => reopen.mutate(l.id)}
                            onDelete={() => removeDraft.mutate(l.id)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                    // Tin chờ duyệt: tooltip giải thích chưa hiển thị công khai
                    return l.status === 1 ? (
                      <Tooltip key={l.id}>
                        <TooltipTrigger asChild>{row}</TooltipTrigger>
                        <TooltipContent>Đang chờ duyệt, chưa hiển thị công khai.</TooltipContent>
                      </Tooltip>
                    ) : (
                      row
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Thao tác theo trạng thái tin. Chỉ hiện những việc THỰC SỰ làm được ở trạng thái đó —
 * hiện nút rồi báo lỗi khi bấm là cách nhanh nhất làm người dùng mất tin tưởng.
 *
 *   Nháp        → sửa, xoá
 *   Chờ duyệt   → sửa (sẽ duyệt lại)
 *   Đang hiển thị → sửa, đẩy tin, đóng
 *   Bị từ chối  → sửa rồi gửi lại
 *   Đã đóng     → mở lại
 */
function RowActions({
  listing: l,
  busy,
  onEdit,
  onBump,
  onClose,
  onReopen,
  onDelete,
}: {
  listing: OwnerListingDto;
  busy: boolean;
  onEdit: () => void;
  onBump: () => void;
  onClose: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const editable = l.status !== 4;   // mọi trạng thái trừ Đã đóng

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={busy} aria-label="Thao tác">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {editable && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            {l.status === 3 ? "Sửa và gửi lại" : "Sửa tin"}
          </DropdownMenuItem>
        )}
        {l.status === 2 && (
          <DropdownMenuItem onClick={onBump}>
            <ArrowUp className="h-4 w-4 mr-2" />
            Đẩy lên đầu
          </DropdownMenuItem>
        )}
        {l.status === 2 && (
          <DropdownMenuItem onClick={onClose}>
            <XCircle className="h-4 w-4 mr-2" />
            Đóng tin
          </DropdownMenuItem>
        )}
        {l.status === 4 && (
          <DropdownMenuItem onClick={onReopen}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Mở lại
          </DropdownMenuItem>
        )}
        {l.status === 5 && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Xoá bản nháp
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
