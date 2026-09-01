import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { remindersApi, type ReminderDto, type ReminderFilters } from "@/lib/api/reminders";
import { assetsApi } from "@/lib/api/assets";
import { toIsoUtc } from "@/lib/api/contracts";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import {
  REMINDER_TYPE,
  REMINDER_TYPE_CLASS,
  RECURRENCE_CYCLE,
  enumOptions,
  type RecurrenceCycleCode,
  type ReminderTypeCode,
} from "@/constants/enums";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Plus, Trash2, Bell } from "lucide-react";

export const Route = createFileRoute("/nhac-lich/")({
  head: () => ({ meta: [{ title: "Nhắc lịch — Quản Lý Tài Sản" }] }),
  component: RemindersPage,
});

type ActiveFilter = "all" | "on" | "off";

function RemindersPage() {
  const qc = useQueryClient();
  const [fActive, setFActive] = useState<ActiveFilter>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<ReminderDto | null>(null);

  const filters: ReminderFilters = {
    isActive: fActive === "all" ? "" : fActive === "on",
    page,
    pageSize: 20,
  };
  const query = useQuery({
    queryKey: ["reminders", filters],
    queryFn: () => remindersApi.list(filters),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  // Toggle bật/tắt inline — PUT ngay khi click với dữ liệu hiện tại của dòng
  const toggle = useMutation({
    mutationFn: (r: ReminderDto) =>
      remindersApi.update(r.id, {
        title: r.title,
        dueDate: r.dueDate,
        cycle: r.cycle,
        notifyDaysBefore: r.notifyDaysBefore,
        isActive: !r.isActive,
      }),
    onSuccess: (_d, r) => {
      toast.success(r.isActive ? "Đã tắt nhắc lịch" : "Đã bật nhắc lịch");
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không cập nhật được nhắc lịch")),
  });

  const del = useMutation({
    mutationFn: (id: string) => remindersApi.remove(id),
    onSuccess: () => {
      toast.success("Đã xoá nhắc lịch");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không xoá được nhắc lịch")),
  });

  const data = query.data;
  const rows = data?.items ?? [];

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nhắc lịch</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Danh sách nhắc nhở cho thu chi, bảo dưỡng, thuế, hợp đồng.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm nhắc lịch
        </Button>
      </div>

      <Tabs
        value={fActive}
        onValueChange={(v) => {
          setFActive(v as ActiveFilter);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="on">Đang bật</TabsTrigger>
          <TabsTrigger value="off">Đã tắt</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="py-10 text-center text-sm text-destructive">
              {getErrorMessage(query.error, "Không tải được danh sách nhắc lịch")}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              Chưa có nhắc lịch nào.
              <div className="mt-3">
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Thêm nhắc lịch
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Tài sản</TableHead>
                  <TableHead>Ngày đến hạn</TableHead>
                  <TableHead>Chu kỳ</TableHead>
                  <TableHead>Báo trước</TableHead>
                  <TableHead className="text-center">Bật</TableHead>
                  <TableHead className="w-14"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={r.isActive ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={REMINDER_TYPE_CLASS[r.type]}>
                        {REMINDER_TYPE[r.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.assetName ?? "—"}
                    </TableCell>
                    <TableCell>{formatDate(r.dueDate)}</TableCell>
                    <TableCell className="text-sm">{RECURRENCE_CYCLE[r.cycle]}</TableCell>
                    <TableCell className="text-sm">{r.notifyDaysBefore} ngày</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={r.isActive}
                        disabled={toggle.isPending}
                        onCheckedChange={() => toggle.mutate(r)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Trang trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {data.page}/{data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Trang sau
          </Button>
        </div>
      )}

      <CreateReminderDialog
        key={String(createOpen)}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá nhắc lịch?</AlertDialogTitle>
            <AlertDialogDescription>
              Nhắc lịch <b>{deleting?.title}</b> sẽ bị xoá vĩnh viễn.
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

function CreateReminderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<ReminderTypeCode>(1);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [cycle, setCycle] = useState<RecurrenceCycleCode>(0);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(3);
  const [assetId, setAssetId] = useState("");

  const assetsQ = useQuery({
    queryKey: ["assets", { pageSize: 200 }],
    queryFn: () => assetsApi.list({ pageSize: 200 }),
    enabled: open,
    staleTime: 60_000,
    retry: 1,
  });

  const create = useMutation({
    mutationFn: () =>
      remindersApi.create({
        assetId: assetId || null,
        type,
        title: title.trim(),
        dueDate: toIsoUtc(dueDate),
        cycle,
        notifyDaysBefore,
      }),
    onSuccess: () => {
      toast.success("Đã tạo nhắc lịch");
      qc.invalidateQueries({ queryKey: ["reminders"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Không tạo được nhắc lịch")),
  });

  const submit = () => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    if (!dueDate) {
      toast.error("Vui lòng chọn ngày đến hạn");
      return;
    }
    if (notifyDaysBefore < 0) {
      toast.error("Số ngày báo trước không hợp lệ");
      return;
    }
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !create.isPending && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm nhắc lịch</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Loại *</Label>
              <Select
                value={String(type)}
                onValueChange={(v) => setType(Number(v) as ReminderTypeCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumOptions(REMINDER_TYPE).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ngày đến hạn *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tiêu đề *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Thu tiền thuê nhà phố Quận 7"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Chu kỳ lặp</Label>
              <Select
                value={String(cycle)}
                onValueChange={(v) => setCycle(Number(v) as RecurrenceCycleCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {enumOptions(RECURRENCE_CYCLE).map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Báo trước (ngày)</Label>
              <Input
                type="number"
                min={0}
                value={notifyDaysBefore}
                onChange={(e) => setNotifyDaysBefore(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tài sản liên quan (tuỳ chọn)</Label>
            <Select
              value={assetId || "none"}
              onValueChange={(v) => setAssetId(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Không gắn tài sản</SelectItem>
                {(assetsQ.data?.items ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Đang tạo..." : "Tạo nhắc lịch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
