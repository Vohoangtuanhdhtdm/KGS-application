import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi, type EquipmentDto, type EquipmentInput } from "@/lib/api/assets";
import { getErrorMessage } from "@/lib/api/errors";
import {
  EQUIPMENT_CONDITION,
  EQUIPMENT_CONDITION_CLASS,
  EQUIPMENT_SOURCE,
  enumOptions,
  type EquipmentConditionCode,
  type EquipmentSourceCode,
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
import { Plus, Pencil, Trash2, Wrench } from "lucide-react";

export function EquipmentTab({ assetId }: { assetId: string }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentDto | null>(null);
  const [deleting, setDeleting] = useState<EquipmentDto | null>(null);

  const query = useQuery({
    queryKey: ["asset-equipment", assetId],
    queryFn: () => assetsApi.equipment.list(assetId),
    retry: 1,
  });
  const unitsQ = useQuery({
    queryKey: ["asset-units", assetId],
    queryFn: () => assetsApi.units.list(assetId),
    retry: 1,
  });
  const units = unitsQ.data ?? [];

  const del = useMutation({
    mutationFn: (id: string) => assetsApi.equipment.remove(assetId, id),
    onSuccess: () => {
      toast.success("Đã xoá thiết bị");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["asset-equipment", assetId] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không xoá được thiết bị")),
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
          {getErrorMessage(query.error, "Không tải được danh sách thiết bị")}
        </CardContent>
      </Card>
    );
  }

  const items = query.data ?? [];
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
          Thêm thiết bị
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <Wrench className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            Chưa có thiết bị nào được ghi nhận.
            <div className="mt-3">
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Thêm thiết bị
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
                  <TableHead>Tên thiết bị</TableHead>
                  <TableHead>Phòng</TableHead>
                  <TableHead className="text-center">Số lượng</TableHead>
                  <TableHead>Tình trạng</TableHead>
                  <TableHead>Nguồn gốc</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {unitName(e.assetUnitId) ?? "Chung"}
                    </TableCell>
                    <TableCell className="text-center">{e.quantity}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={EQUIPMENT_CONDITION_CLASS[e.condition]}>
                        {EQUIPMENT_CONDITION[e.condition]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{EQUIPMENT_SOURCE[e.source]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {e.notes}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(e);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleting(e)}>
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

      <EquipmentFormDialog
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
            <AlertDialogTitle>Xoá thiết bị?</AlertDialogTitle>
            <AlertDialogDescription>
              Thiết bị <b>{deleting?.name}</b> sẽ bị xoá vĩnh viễn.
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

function EquipmentFormDialog({
  assetId,
  open,
  onOpenChange,
  editing,
  units,
}: {
  assetId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: EquipmentDto | null;
  units: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(editing?.name ?? "");
  const [assetUnitId, setAssetUnitId] = useState(editing?.assetUnitId ?? "");
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [condition, setCondition] = useState<EquipmentConditionCode>(editing?.condition ?? 2);
  const [source, setSource] = useState<EquipmentSourceCode>(editing?.source ?? 3);
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const mutation = useMutation({
    mutationFn: (body: EquipmentInput) =>
      editing
        ? assetsApi.equipment.update(assetId, editing.id, body)
        : assetsApi.equipment.create(assetId, body),
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật thiết bị" : "Đã thêm thiết bị");
      qc.invalidateQueries({ queryKey: ["asset-equipment", assetId] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không lưu được thiết bị")),
  });

  const submit = () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên thiết bị");
      return;
    }
    if (!quantity || quantity < 1) {
      toast.error("Số lượng phải từ 1 trở lên");
      return;
    }
    mutation.mutate({
      assetUnitId: assetUnitId || null,
      name: name.trim(),
      quantity,
      condition,
      source,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !mutation.isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa thiết bị" : "Thêm thiết bị"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Tên thiết bị *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Số lượng *</Label>
              <Input
                type="number"
                min={1}
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
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
                    <SelectItem value="none">Dùng chung</SelectItem>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tình trạng</Label>
              <Select
                value={String(condition)}
                onValueChange={(v) => setCondition(Number(v) as EquipmentConditionCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumOptions(EQUIPMENT_CONDITION).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nguồn gốc</Label>
              <Select
                value={String(source)}
                onValueChange={(v) => setSource(Number(v) as EquipmentSourceCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumOptions(EQUIPMENT_SOURCE).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {mutation.isPending ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm thiết bị"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
