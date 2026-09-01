import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi, type SaleListingDto, type SaleListingUpdateInput } from "@/lib/api/assets";
import { contactsApi } from "@/lib/api/contacts";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate, formatCurrency } from "@/lib/format";
import {
  SALE_LISTING_STATUS,
  SALE_LISTING_STATUS_CLASS,
  type SaleListingStatusCode,
} from "@/constants/enums";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tag, Pencil, Trash2, Send, CheckCheck, Loader2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MarketplacePublishCard } from "./MarketplacePublishCard";

export function SaleListingTab({ assetId }: { assetId: string }) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["asset-sale-listing", assetId],
    queryFn: () => assetsApi.saleListing.get(assetId),
    retry: 1,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {getErrorMessage(query.error, "Không tải được thông tin rao bán")}
        </CardContent>
      </Card>
    );
  }

  const listing = query.data ?? null;
  return (
    <div className="space-y-4">
      {/* Hành động chính: đăng tin công khai lên marketplace */}
      <MarketplacePublishCard assetId={assetId} />

      {/* Sổ nội bộ theo dõi gửi môi giới — thu gọn mặc định nếu chưa có dữ liệu */}
      <Collapsible defaultOpen={!!listing} className="rounded-lg border bg-card">
        <CollapsibleTrigger className="group w-full flex items-center justify-between gap-3 p-4 text-left">
          <div>
            <div className="text-base font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Theo dõi gửi môi giới (chỉ nội bộ)
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Không hiển thị công khai — chỉ bạn xem được.
            </p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 pt-0 space-y-4">
          {!listing ? (
            <CreateListingCard assetId={assetId} />
          ) : (
            <ListingDetail
              assetId={assetId}
              listing={listing}
              qcInvalidate={() => {
                qc.invalidateQueries({ queryKey: ["asset-sale-listing", assetId] });
              }}
            />
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ------------------------------------------------------------- Tạo tin rao bán

function CreateListingCard({ assetId }: { assetId: string }) {
  const qc = useQueryClient();
  const [askingPrice, setAskingPrice] = useState<number | null>(null);
  const [agreementNotes, setAgreementNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      assetsApi.saleListing.create(assetId, {
        askingPrice: askingPrice ?? 0,
        agreementNotes: agreementNotes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Đã bắt đầu theo dõi gửi môi giới");
      qc.invalidateQueries({ queryKey: ["asset-sale-listing", assetId] });
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["sale-listings"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không lưu được")),
  });

  return (
    <div className="space-y-3 max-w-md">
      <p className="text-sm text-muted-foreground">
        Ghi lại giá bạn đã báo và bắt đầu theo dõi việc gửi tài sản cho các môi giới quen.
      </p>
      <div className="space-y-2">
        <Label>Giá đã báo (VNĐ) *</Label>
        <CurrencyInput value={askingPrice} onChange={setAskingPrice} />
      </div>
      <div className="space-y-2">
        <Label>Ghi chú thoả thuận</Label>
        <Textarea
          rows={3}
          value={agreementNotes}
          onChange={(e) => setAgreementNotes(e.target.value)}
          placeholder="Điều kiện bán, hoa hồng môi giới..."
        />
      </div>
      <Button
        onClick={() => {
          if (!askingPrice || askingPrice <= 0) {
            toast.error("Vui lòng nhập giá hợp lệ");
            return;
          }
          create.mutate();
        }}
        disabled={create.isPending}
      >
        {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        {create.isPending ? "Đang lưu..." : "Bắt đầu theo dõi"}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------ Chi tiết tin rao

function ListingDetail({
  assetId,
  listing,
  qcInvalidate,
}: {
  assetId: string;
  listing: SaleListingDto;
  qcInvalidate: () => void;
}) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [brokerOpen, setBrokerOpen] = useState(false);
  const [soldOpen, setSoldOpen] = useState(false);
  const [removingBroker, setRemovingBroker] = useState<string | null>(null);

  const removeBroker = useMutation({
    mutationFn: (brokerId: string) => assetsApi.saleListing.removeBroker(assetId, brokerId),
    onSuccess: () => {
      toast.success("Đã bỏ môi giới khỏi tin rao");
      setRemovingBroker(null);
      qcInvalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không bỏ được môi giới")),
  });

  const markSold = useMutation({
    mutationFn: () => assetsApi.saleListing.markSold(assetId),
    onSuccess: () => {
      toast.success("Đã đánh dấu tài sản đã bán");
      setSoldOpen(false);
      qcInvalidate();
      // asset.status cũng đổi sang "Đã bán" → header trang chi tiết + danh sách phải cập nhật
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["sale-listings"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không đánh dấu được đã bán")),
  });

  const sold = listing.status === 3;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-semibold">{formatCurrency(listing.askingPrice)}</span>
              <Badge variant="outline" className={SALE_LISTING_STATUS_CLASS[listing.status]}>
                {SALE_LISTING_STATUS[listing.status]}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Đăng ngày {formatDate(listing.listedAt)}
            </div>
            {listing.agreementNotes && (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {listing.agreementNotes}
              </div>
            )}
          </div>
          {!sold && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1.5" />
                Sửa tin
              </Button>
              <Button size="sm" onClick={() => setSoldOpen(true)}>
                <CheckCheck className="h-4 w-4 mr-1.5" />
                Đánh dấu đã bán
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Môi giới đã gửi ({listing.brokers.length})</CardTitle>
          {!sold && (
            <Button size="sm" variant="outline" onClick={() => setBrokerOpen(true)}>
              <Send className="h-4 w-4 mr-1.5" />
              Gửi cho môi giới
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {listing.brokers.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Chưa gửi tin cho môi giới nào.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên môi giới</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Ngày gửi</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listing.brokers.map((b) => (
                  <TableRow key={b.brokerId}>
                    <TableCell className="font-medium">{b.brokerName}</TableCell>
                    <TableCell className="text-sm">{b.phone ?? "—"}</TableCell>
                    <TableCell className="text-sm">{formatDate(b.sentAt)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {b.notes}
                    </TableCell>
                    <TableCell>
                      {!sold && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRemovingBroker(b.brokerId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditListingDialog
        key={`edit:${editOpen}`}
        assetId={assetId}
        listing={listing}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <AddBrokerDialog
        key={`broker:${brokerOpen}`}
        assetId={assetId}
        existingBrokerIds={listing.brokers.map((b) => b.brokerId)}
        open={brokerOpen}
        onOpenChange={setBrokerOpen}
      />

      {/* Xác nhận đánh dấu đã bán */}
      <AlertDialog open={soldOpen} onOpenChange={(v) => !markSold.isPending && setSoldOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đánh dấu đã bán?</AlertDialogTitle>
            <AlertDialogDescription>
              Thao tác này không thể hoàn tác. Tài sản sẽ chuyển sang trạng thái <b>Đã bán</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markSold.isPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={markSold.isPending}
              onClick={(ev) => {
                ev.preventDefault();
                markSold.mutate();
              }}
            >
              {markSold.isPending ? "Đang xử lý..." : "Xác nhận đã bán"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Xác nhận bỏ môi giới */}
      <AlertDialog open={!!removingBroker} onOpenChange={(v) => !v && setRemovingBroker(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ môi giới khỏi tin rao?</AlertDialogTitle>
            <AlertDialogDescription>
              Môi giới{" "}
              <b>{listing.brokers.find((b) => b.brokerId === removingBroker)?.brokerName ?? ""}</b>{" "}
              sẽ bị xoá khỏi danh sách đã gửi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeBroker.isPending}
              onClick={(ev) => {
                ev.preventDefault();
                if (removingBroker) removeBroker.mutate(removingBroker);
              }}
            >
              {removeBroker.isPending ? "Đang xoá..." : "Bỏ môi giới"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ------------------------------------------------------------------- Sửa tin

function EditListingDialog({
  assetId,
  listing,
  open,
  onOpenChange,
}: {
  assetId: string;
  listing: SaleListingDto;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [askingPrice, setAskingPrice] = useState<number | null>(listing.askingPrice);
  const [status, setStatus] = useState<SaleListingStatusCode>(listing.status);
  const [agreementNotes, setAgreementNotes] = useState(listing.agreementNotes ?? "");

  const update = useMutation({
    mutationFn: (body: SaleListingUpdateInput) => assetsApi.saleListing.update(assetId, body),
    onSuccess: () => {
      toast.success("Đã cập nhật tin rao bán");
      qc.invalidateQueries({ queryKey: ["asset-sale-listing", assetId] });
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không cập nhật được tin rao")),
  });

  // "Đã bán" (3) không cho chọn thủ công — chỉ qua nút Đánh dấu đã bán
  const statusOptions: SaleListingStatusCode[] = [1, 2, 4];

  return (
    <Dialog open={open} onOpenChange={(v) => !update.isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa tin rao bán</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Giá rao (VNĐ) *</Label>
            <CurrencyInput value={askingPrice} onChange={setAskingPrice} />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select
              value={String(status)}
              onValueChange={(v) => setStatus(Number(v) as SaleListingStatusCode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {SALE_LISTING_STATUS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ghi chú thoả thuận</Label>
            <Textarea
              rows={3}
              value={agreementNotes}
              onChange={(e) => setAgreementNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Huỷ
          </Button>
          <Button
            onClick={() => {
              if (!askingPrice || askingPrice <= 0) {
                toast.error("Vui lòng nhập giá rao hợp lệ");
                return;
              }
              update.mutate({
                askingPrice,
                status,
                agreementNotes: agreementNotes.trim() || null,
              });
            }}
            disabled={update.isPending}
          >
            {update.isPending ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------- Gửi cho môi giới

function AddBrokerDialog({
  assetId,
  existingBrokerIds,
  open,
  onOpenChange,
}: {
  assetId: string;
  existingBrokerIds: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [brokerId, setBrokerId] = useState("");
  const [notes, setNotes] = useState("");

  // Môi giới = contact type 3 (Broker)
  const brokersQ = useQuery({
    queryKey: ["contacts", { type: 3, pageSize: 200 }],
    queryFn: () => contactsApi.list({ type: 3, pageSize: 200 }),
    enabled: open,
    retry: 1,
  });
  const options = (brokersQ.data?.items ?? []).filter((c) => !existingBrokerIds.includes(c.id));

  const add = useMutation({
    mutationFn: () =>
      assetsApi.saleListing.addBroker(assetId, { brokerId, notes: notes.trim() || null }),
    onSuccess: () => {
      toast.success("Đã gửi tin cho môi giới");
      qc.invalidateQueries({ queryKey: ["asset-sale-listing", assetId] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không gửi được cho môi giới")),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !add.isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gửi tin cho môi giới</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Môi giới *</Label>
            <Select value={brokerId} onValueChange={setBrokerId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn môi giới từ sổ đối tác" />
              </SelectTrigger>
              <SelectContent>
                {options.length === 0 && (
                  <div className="py-3 px-2 text-sm text-muted-foreground">
                    Không còn môi giới nào trong sổ đối tác để gửi.
                  </div>
                )}
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fullName}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={add.isPending}>
            Huỷ
          </Button>
          <Button
            onClick={() => {
              if (!brokerId) {
                toast.error("Vui lòng chọn môi giới");
                return;
              }
              add.mutate();
            }}
            disabled={add.isPending}
          >
            {add.isPending ? "Đang gửi..." : "Gửi tin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
