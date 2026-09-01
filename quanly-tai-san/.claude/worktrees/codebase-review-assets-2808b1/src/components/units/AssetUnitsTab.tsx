import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { assetsApi, type AssetUnit, type UnitInput } from "@/lib/api/assets";
import { UNIT_STATUS, UNIT_STATUS_CLASS, enumOptions, type UnitStatusCode } from "@/constants/enums";
import { getErrorMessage } from "@/lib/api/errors";
import { ApiError } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Home } from "lucide-react";

export function AssetUnitsTab({ assetId }: { assetId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AssetUnit | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AssetUnit | null>(null);
  const [removeErr, setRemoveErr] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["asset-units", assetId],
    queryFn: () => assetsApi.units.list(assetId),
  });

  const create = useMutation({
    mutationFn: (body: UnitInput) => assetsApi.units.create(assetId, body),
    onSuccess: () => {
      toast.success("Đã thêm phòng/tầng");
      qc.invalidateQueries({ queryKey: ["asset-units", assetId] });
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      setOpenForm(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không thêm được phòng")),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UnitInput }) => assetsApi.units.update(assetId, id, body),
    onSuccess: () => {
      toast.success("Đã cập nhật");
      qc.invalidateQueries({ queryKey: ["asset-units", assetId] });
      setOpenForm(false);
      setEditing(null);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không cập nhật được")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => assetsApi.units.remove(assetId, id),
    onSuccess: () => {
      toast.success("Đã xoá");
      qc.invalidateQueries({ queryKey: ["asset-units", assetId] });
      qc.invalidateQueries({ queryKey: ["asset", assetId] });
      setRemoveTarget(null);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setRemoveErr(getErrorMessage(err));
      } else {
        toast.error(getErrorMessage(err, "Không xoá được"));
        setRemoveTarget(null);
      }
    },
  });

  const openCreate = () => { setEditing(null); setOpenForm(true); };
  const openEdit = (u: AssetUnit) => { setEditing(u); setOpenForm(true); };

  if (query.isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;

  const units = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{units.length} phòng/tầng</p>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Thêm phòng</Button>
      </div>

      {units.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Home className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Tài sản này chưa chia tầng/phòng.</p>
          <p className="text-xs text-muted-foreground mt-1">Thêm phòng nếu bạn cho thuê lẻ từng phần.</p>
          <Button className="mt-4" size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" />Thêm phòng đầu tiên</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {units.map((u) => (
            <Card key={u.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{u.name}</span>
                    <Badge variant="outline" className={UNIT_STATUS_CLASS[u.status]}>{UNIT_STATUS[u.status]}</Badge>
                    {u.floorNumber != null && <Badge variant="secondary" className="text-xs">Tầng {u.floorNumber}</Badge>}
                    {u.area != null && <span className="text-xs text-muted-foreground">{u.area} m²</span>}
                  </div>
                  {u.notes && <p className="text-xs text-muted-foreground mt-1">{u.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setRemoveErr(null); setRemoveTarget(u); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UnitFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        initial={editing}
        submitting={create.isPending || update.isPending}
        onSubmit={(body) => editing ? update.mutate({ id: editing.id, body }) : create.mutate(body)}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(v) => { if (!v) { setRemoveTarget(null); setRemoveErr(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá phòng?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeErr ? <span className="text-destructive">{removeErr}</span> : <>Phòng <b>{removeTarget?.name}</b> sẽ bị xoá.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (removeTarget) remove.mutate(removeTarget.id); }}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >{remove.isPending ? "Đang xoá..." : "Xoá"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UnitFormDialog({
  open, onOpenChange, initial, onSubmit, submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: AssetUnit | null;
  onSubmit: (b: UnitInput) => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [floor, setFloor] = useState<string>(initial?.floorNumber?.toString() ?? "");
  const [area, setArea] = useState<string>(initial?.area?.toString() ?? "");
  const [status, setStatus] = useState<UnitStatusCode>(initial?.status ?? 1);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Reset when opening
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(initial?.name ?? "");
      setFloor(initial?.floorNumber?.toString() ?? "");
      setArea(initial?.area?.toString() ?? "");
      setStatus(initial?.status ?? 1);
      setNotes(initial?.notes ?? "");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Sửa phòng/tầng" : "Thêm phòng/tầng"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Tên *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Phòng 101" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Tầng số</Label><Input inputMode="numeric" value={floor} onChange={(e) => setFloor(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Diện tích (m²)</Label><Input inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} /></div>
          </div>
          {initial && (
            <div className="space-y-1.5"><Label>Trạng thái</Label>
              <Select value={String(status)} onValueChange={(v) => setStatus(Number(v) as UnitStatusCode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{enumOptions(UNIT_STATUS).map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label>Ghi chú</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Huỷ</Button>
          <Button
            onClick={() => {
              if (!name.trim()) { toast.error("Vui lòng nhập tên"); return; }
              onSubmit({
                name: name.trim(),
                floorNumber: floor === "" ? null : Number(floor),
                area: area === "" ? null : Number(area),
                notes: notes.trim() || null,
              });
            }}
            disabled={submitting}
          >{submitting ? "Đang lưu..." : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
