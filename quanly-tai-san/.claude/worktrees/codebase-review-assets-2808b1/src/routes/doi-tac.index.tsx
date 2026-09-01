import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { contactsApi, type ContactFilters, type ContactInput, type ContactParty } from "@/lib/api/contacts";
import { CONTACT_TYPE, enumOptions, type ContactTypeCode } from "@/constants/enums";
import { ContactTypeBadgeCode } from "@/components/EnumBadge";
import { getErrorMessage } from "@/lib/api/errors";
import { ApiError } from "@/lib/auth/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Phone, Mail, Pencil, Trash2, Users, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/doi-tac/")({
  head: () => ({ meta: [{ title: "Sổ đối tác — Quản Lý Tài Sản" }] }),
  component: Contacts,
});

function Contacts() {
  const qc = useQueryClient();
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<ContactTypeCode | "">("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<ContactParty | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<ContactParty | null>(null);
  const [delError, setDelError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setKeyword(keywordInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [keywordInput]);

  const filters: ContactFilters = { keyword, type, page, pageSize: 20 };
  const query = useQuery({
    queryKey: ["contacts", filters],
    queryFn: () => contactsApi.list(filters),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => contactsApi.remove(id),
    onSuccess: () => {
      toast.success("Đã xoá đối tác");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setDeleting(null);
      setDelError(null);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) setDelError(getErrorMessage(err));
      else { toast.error(getErrorMessage(err, "Không xoá được")); setDeleting(null); }
    },
  });

  const data = query.data;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sổ đối tác</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? `${data.totalCount} liên hệ` : "Đang tải..."} · Người thuê, chủ nhà, môi giới, nhà thầu.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />Thêm liên hệ</Button>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Tìm theo tên, SĐT, email..." className="pl-9" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} />
          </div>
          <Select value={type === "" ? "all" : String(type)} onValueChange={(v) => { setType(v === "all" ? "" : Number(v) as ContactTypeCode); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Loại đối tác" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả loại</SelectItem>
              {enumOptions(CONTACT_TYPE).map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : query.isError ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-destructive">{getErrorMessage(query.error, "Không tải được danh sách")}</p>
              <Button variant="outline" size="sm" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4 mr-1.5" />Thử lại</Button>
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="p-16 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/60" />
              <h3 className="mt-4 font-semibold">Sổ đối tác trống</h3>
              <p className="text-sm text-muted-foreground mt-1">Thêm người thuê/chủ nhà để tạo hợp đồng.</p>
              <Button className="mt-5" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1.5" />Thêm liên hệ</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead><TableHead>Loại</TableHead>
                  <TableHead>SĐT</TableHead><TableHead>Email</TableHead>
                  <TableHead>Ghi chú</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.items.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.fullName}</TableCell>
                    <TableCell><ContactTypeBadgeCode code={c.type} /></TableCell>
                    <TableCell>{c.phone ? <a href={`tel:${c.phone}`} className="text-sm flex items-center gap-1.5 hover:text-primary"><Phone className="h-3 w-3" />{c.phone}</a> : "—"}</TableCell>
                    <TableCell className="text-sm">{c.email ? <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-primary"><Mail className="h-3 w-3" />{c.email}</a> : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{c.notes ?? ""}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setDelError(null); setDeleting(c); }}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</Button>
          <span className="text-sm text-muted-foreground px-3">Trang {page}/{data.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Sau</Button>
        </div>
      )}

      <ContactDialog open={open} onOpenChange={setOpen} editing={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(v) => { if (!removeMut.isPending) { if (!v) { setDeleting(null); setDelError(null); } } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá đối tác?</AlertDialogTitle>
            <AlertDialogDescription>
              {delError ? <span className="text-destructive">{delError}</span> : <>Xoá <b>{deleting?.fullName}</b>?</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMut.isPending}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleting) removeMut.mutate(deleting.id); }}
              disabled={removeMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >{removeMut.isPending ? "Đang xoá..." : "Xoá"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ContactDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: ContactParty | null }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [type, setType] = useState<ContactTypeCode>(1);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setFullName(editing?.fullName ?? "");
      setType(editing?.type ?? 1);
      setPhone(editing?.phone ?? "");
      setEmail(editing?.email ?? "");
      setIdNumber(editing?.idNumber ?? "");
      setNotes(editing?.notes ?? "");
    }
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: (body: ContactInput) =>
      editing ? contactsApi.update(editing.id, body) : contactsApi.create(body),
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật" : "Đã thêm liên hệ");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không lưu được")),
  });

  const submit = () => {
    if (!fullName.trim()) { toast.error("Vui lòng nhập họ tên"); return; }
    mutation.mutate({
      type,
      fullName: fullName.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      idNumber: idNumber.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Sửa liên hệ" : "Thêm liên hệ"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Họ tên *</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Loại</Label>
            <Select value={String(type)} onValueChange={(v) => setType(Number(v) as ContactTypeCode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{enumOptions(CONTACT_TYPE).map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>SĐT</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>CMND/CCCD</Label><Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} /></div>
          <div className="space-y-2"><Label>Ghi chú</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Huỷ</Button>
          <Button onClick={submit} disabled={mutation.isPending}>{mutation.isPending ? "Đang lưu..." : "Lưu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
