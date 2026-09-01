import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi, type MaintenanceDto, type MaintenanceInput } from "@/lib/api/assets";
import { contactsApi } from "@/lib/api/contacts";
import { toIsoUtc } from "@/lib/api/contracts";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate, formatCurrency } from "@/lib/format";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, Hammer } from "lucide-react";

export function MaintenanceTab({ assetId }: { assetId: string }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceDto | null>(null);
  const [deleting, setDeleting] = useState<MaintenanceDto | null>(null);

  const query = useQuery({
    queryKey: ["asset-maintenance", assetId],
    queryFn: () => assetsApi.maintenance.list(assetId),
    retry: 1,
  });
  const unitsQ = useQuery({
    queryKey: ["asset-units", assetId],
    queryFn: () => assetsApi.units.list(assetId),
    retry: 1,
  });
  const units = unitsQ.data ?? [];

  const del = useMutation({
    mutationFn: (id: string) => assetsApi.maintenance.remove(assetId, id),
    onSuccess: () => {
      toast.success("Đã xoá lần sửa chữa");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["asset-maintenance", assetId] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không xoá được bản ghi")),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {getErrorMessage(query.error, "Không tải được lịch sử sửa chữa")}
        </CardContent>
      </Card>
    );
  }

  const items = (query.data ?? [])
    .slice()
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const unitName = (unitId: string | null) =>
    unitId ? (units.find((u) => u.id === unitId)?.name ?? "—") : null;

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
          Thêm lần sửa chữa
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <Hammer className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            Chưa có lần sửa chữa/bảo trì nào.
            <div className="mt-3">
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Thêm lần sửa chữa
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Phòng</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead className="text-right">Chi phí</TableHead>
                  <TableHead>Nhà thầu</TableHead>
                  <TableHead></TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {unitName(m.assetUnitId) ?? "Chung"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(m.startDate)}
                      {m.completedDate ? ` → ${formatDate(m.completedDate)}` : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {m.cost != null ? formatCurrency(m.cost) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{m.vendorName ?? "—"}</TableCell>
                    <TableCell>
                      {m.completedDate === null && (
                        <Badge
                          variant="outline"
                          className="bg-warning/20 text-warning-foreground border-warning/40"
                        >
                          Đang thực hiện
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(m);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(m)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <MaintenanceFormDialog
        key={`${editing?.id ?? "new"}:${formOpen}`}
        assetId={assetId}
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        units={units.map((u) => ({ id: u.id, name: u.name }))}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá lần sửa chữa?</AlertDialogTitle>
            <AlertDialogDescription>
              Bản ghi <b>{deleting?.title}</b> sẽ bị xoá vĩnh viễn. Bút toán chi phí đã ghi vào sổ
              thu chi (nếu có) không bị xoá theo.
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

function MaintenanceFormDialog({
  assetId,
  open,
  onOpenChange,
  editing,
  units,
}: {
  assetId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: MaintenanceDto | null;
  units: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [assetUnitId, setAssetUnitId] = useState(editing?.assetUnitId ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [startDate, setStartDate] = useState(editing?.startDate?.slice(0, 10) ?? "");
  const [completedDate, setCompletedDate] = useState(editing?.completedDate?.slice(0, 10) ?? "");
  const [cost, setCost] = useState<number | null>(editing?.cost ?? null);
  const [vendorId, setVendorId] = useState(editing?.vendorId ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [recordAsExpense, setRecordAsExpense] = useState(true);

  // Nhà thầu = contact type 4 (Vendor)
  const vendorsQ = useQuery({
    queryKey: ["contacts", { type: 4, pageSize: 200 }],
    queryFn: () => contactsApi.list({ type: 4, pageSize: 200 }),
    enabled: open,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: (body: MaintenanceInput) =>
      editing
        ? assetsApi.maintenance.update(assetId, editing.id, body)
        : assetsApi.maintenance.create(assetId, body),
    onSuccess: (_data, body) => {
      toast.success(editing ? "Đã cập nhật lần sửa chữa" : "Đã thêm lần sửa chữa");
      qc.invalidateQueries({ queryKey: ["asset-maintenance", assetId] });
      // Backend tự tạo bút toán chi khi recordAsExpense + cost → sổ thu chi phải cập nhật ngay
      if (!editing && body.recordAsExpense && body.cost) {
        qc.invalidateQueries({ queryKey: ["cashflows"] });
      }
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không lưu được bản ghi")),
  });

  const submit = () => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    if (!startDate) {
      toast.error("Vui lòng chọn ngày bắt đầu");
      return;
    }
    if (completedDate && new Date(completedDate) < new Date(startDate)) {
      toast.error("Ngày hoàn thành phải sau ngày bắt đầu");
      return;
    }
    mutation.mutate({
      assetUnitId: assetUnitId || null,
      title: title.trim(),
      description: description.trim() || null,
      startDate: toIsoUtc(startDate),
      completedDate: completedDate ? toIsoUtc(completedDate) : null,
      cost,
      vendorId: vendorId || null,
      notes: notes.trim() || null,
      recordAsExpense: cost != null && cost > 0 ? recordAsExpense : false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !mutation.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa lần sửa chữa" : "Thêm lần sửa chữa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Tiêu đề *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          {units.length > 0 && (
            <div className="space-y-2">
              <Label>Phòng (tuỳ chọn)</Label>
              <Select
                value={assetUnitId || "none"}
                onValueChange={(v) => setAssetUnitId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Chung toàn tài sản</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Mô tả</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ngày bắt đầu *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ngày hoàn thành (để trống nếu đang làm)</Label>
              <Input
                type="date"
                value={completedDate}
                onChange={(e) => setCompletedDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Chi phí</Label>
              <CurrencyInput value={cost} onChange={setCost} />
            </div>
            <div className="space-y-2">
              <Label>Nhà thầu (tuỳ chọn)</Label>
              <Select
                value={vendorId || "none"}
                onValueChange={(v) => setVendorId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không chọn</SelectItem>
                  {(vendorsQ.data?.items ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!editing && cost != null && cost > 0 && (
            <div className="space-y-1.5 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="record-expense"
                  checked={recordAsExpense}
                  onCheckedChange={(v) => setRecordAsExpense(v === true)}
                />
                <Label htmlFor="record-expense" className="cursor-pointer">
                  Tự động ghi vào sổ thu chi
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Khi tick, hệ thống sẽ tự tạo một bút toán chi phí sửa chữa trong sổ thu chi của tài
                sản này.
              </p>
            </div>
          )}
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
            {mutation.isPending ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm bản ghi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
