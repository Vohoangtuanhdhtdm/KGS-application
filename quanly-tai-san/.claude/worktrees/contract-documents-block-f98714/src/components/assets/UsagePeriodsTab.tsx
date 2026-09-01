import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi, type UsagePeriodDto, type UsagePeriodInput } from "@/lib/api/assets";
import { toIsoUtc } from "@/lib/api/contracts";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import {
  OCCUPANT_TYPE,
  OCCUPANT_TYPE_CLASS,
  enumOptions,
  type OccupantTypeCode,
} from "@/constants/enums";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Plus, Pencil, Trash2, History } from "lucide-react";

export function UsagePeriodsTab({ assetId }: { assetId: string }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UsagePeriodDto | null>(null);
  const [deleting, setDeleting] = useState<UsagePeriodDto | null>(null);

  const query = useQuery({
    queryKey: ["asset-usage", assetId],
    queryFn: () => assetsApi.usagePeriods.list(assetId),
    retry: 1,
  });

  const del = useMutation({
    mutationFn: (id: string) => assetsApi.usagePeriods.remove(assetId, id),
    onSuccess: () => {
      toast.success("Đã xoá giai đoạn sử dụng");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["asset-usage", assetId] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không xoá được giai đoạn")),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {getErrorMessage(query.error, "Không tải được lịch sử sử dụng")}
        </CardContent>
      </Card>
    );
  }

  const items = (query.data ?? [])
    .slice()
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm giai đoạn
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <History className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            Chưa ghi nhận giai đoạn sử dụng nào.
            <div className="mt-3">
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Thêm giai đoạn
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="relative pl-6 space-y-4">
          {/* trục timeline dọc */}
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
          {items.map((p) => (
            <div key={p.id} className="relative">
              <div
                className={`absolute -left-6 top-4 h-3 w-3 rounded-full border-2 border-background ${
                  p.endDate === null ? "bg-success" : "bg-muted-foreground/40"
                }`}
              />
              <Card>
                <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={OCCUPANT_TYPE_CLASS[p.occupantType]}>
                        {OCCUPANT_TYPE[p.occupantType]}
                      </Badge>
                      {p.occupantName && <span className="font-medium">{p.occupantName}</span>}
                      {p.endDate === null && (
                        <Badge
                          className="bg-success/15 text-success border-success/30"
                          variant="outline"
                        >
                          Đang sử dụng
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(p.startDate)} →{" "}
                      {p.endDate === null ? "nay" : formatDate(p.endDate)}
                    </div>
                    {p.notes && (
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {p.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(p);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleting(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      <UsagePeriodFormDialog
        key={`${editing?.id ?? "new"}:${formOpen}`}
        assetId={assetId}
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá giai đoạn sử dụng?</AlertDialogTitle>
            <AlertDialogDescription>
              Giai đoạn từ {formatDate(deleting?.startDate ?? null)} sẽ bị xoá vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={del.isPending}
              onClick={(ev) => {
                ev.preventDefault();
                if (deleting) del.mutate(deleting.id);
              }}
            >
              {del.isPending ? "Đang xoá..." : "Xoá"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UsagePeriodFormDialog({
  assetId,
  open,
  onOpenChange,
  editing,
}: {
  assetId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: UsagePeriodDto | null;
}) {
  const qc = useQueryClient();
  const [occupantType, setOccupantType] = useState<OccupantTypeCode>(editing?.occupantType ?? 1);
  const [occupantName, setOccupantName] = useState(editing?.occupantName ?? "");
  const [startDate, setStartDate] = useState(editing?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(editing?.endDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const mutation = useMutation({
    mutationFn: (body: UsagePeriodInput) =>
      editing
        ? assetsApi.usagePeriods.update(assetId, editing.id, body)
        : assetsApi.usagePeriods.create(assetId, body),
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật giai đoạn" : "Đã thêm giai đoạn sử dụng");
      qc.invalidateQueries({ queryKey: ["asset-usage", assetId] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không lưu được giai đoạn")),
  });

  const submit = () => {
    if (!startDate) {
      toast.error("Vui lòng chọn ngày bắt đầu");
      return;
    }
    if (endDate && new Date(endDate) <= new Date(startDate)) {
      toast.error("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    mutation.mutate({
      occupantType,
      occupantName: occupantName.trim() || null,
      startDate: toIsoUtc(startDate),
      endDate: endDate ? toIsoUtc(endDate) : null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !mutation.isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa giai đoạn sử dụng" : "Thêm giai đoạn sử dụng"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Người sử dụng *</Label>
              <Select
                value={String(occupantType)}
                onValueChange={(v) => setOccupantType(Number(v) as OccupantTypeCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumOptions(OCCUPANT_TYPE).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tên (tuỳ chọn)</Label>
              <Input value={occupantName} onChange={(e) => setOccupantName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Từ ngày *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Đến ngày (để trống nếu đang sử dụng)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ghi chú</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Huỷ
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm giai đoạn"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
