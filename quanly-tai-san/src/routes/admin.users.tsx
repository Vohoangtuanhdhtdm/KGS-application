import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Flag,
  ListChecks,
  Loader2,
  Lock,
  LockOpen,
  MoreHorizontal,
  Search,
  ShieldCheck,
  ShieldMinus,
  UserRound,
  Users,
} from "lucide-react";
import { AdminRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/lib/auth/AuthContext";
import { adminManageApi, type AdminUserRow } from "@/lib/api/admin";
import { formatListingPrice } from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { LISTING_STATUS, LISTING_STATUS_CLASS } from "@/constants/enums";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/users")({
  validateSearch: (s: Record<string, unknown>): { focus?: string } =>
    typeof s.focus === "string" ? { focus: s.focus } : {},
  head: () => ({ meta: [{ title: "Người dùng — KGS" }] }),
  component: () => (
    <AdminRoute>
      <UsersPage />
    </AdminRoute>
  ),
});

const PAGE_SIZE = 20;

const FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "violations", label: "Có vi phạm đã xác nhận" },
  { value: "locked", label: "Đang bị khoá" },
  { value: "admin", label: "Quản trị viên" },
] as const;

type Dialogs =
  | { kind: "lock"; user: AdminUserRow }
  | { kind: "unlock"; user: AdminUserRow }
  | { kind: "role"; user: AdminUserRow; grant: boolean }
  | null;

function UsersPage() {
  const { focus } = Route.useSearch();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialogs>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => setPage(1), [q, filter, sort]);

  const params = { q, filter, sort, page, pageSize: PAGE_SIZE };
  const query = useQuery({
    queryKey: ["admin-users", params],
    queryFn: () => adminManageApi.users(params),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;
  const openDetail = (id: string | undefined) =>
    navigate({ to: "/admin/users", search: id ? { focus: id } : {}, replace: true });

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Users className="h-5 w-5 text-muted-foreground" /> Người dùng
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Xem ai đăng gì và vi phạm bao nhiêu lần; khoá tài khoản lừa đảo (gỡ luôn tin của họ), cấp
          hoặc thu quyền quản trị.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tên, email, số điện thoại…"
            className="pl-8"
          />
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-md border p-0.5">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? "default" : "ghost"}
              className="h-8 rounded-sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Mới tham gia</SelectItem>
            <SelectItem value="listings">Nhiều tin nhất</SelectItem>
            <SelectItem value="violations">Nhiều vi phạm nhất</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người dùng</TableHead>
              <TableHead>Tham gia</TableHead>
              <TableHead className="text-right">Tin đăng</TableHead>
              <TableHead className="text-center">Vi phạm</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Không có người dùng nào khớp.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((u) => {
              const self = u.id === me?.userId;
              return (
                <TableRow key={u.id} className="cursor-pointer" onClick={() => openDetail(u.id)}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium">
                      {u.name || "(chưa đặt tên)"}
                      {u.isAdmin && (
                        <Badge variant="secondary" className="gap-1 px-1.5 text-[11px]">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </Badge>
                      )}
                      {self && <span className="text-xs text-muted-foreground">(bạn)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.email}
                      {u.phone ? ` · ${u.phone}` : ""}
                      {!u.emailConfirmed && " · chưa xác thực email"}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {u.liveListingCount}
                    <span className="text-muted-foreground">/{u.listingCount}</span>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {u.confirmedViolations > 0 && (
                      <Badge variant="destructive" className="mr-1">
                        {u.confirmedViolations}
                      </Badge>
                    )}
                    {u.pendingReports > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Flag className="h-3 w-3" />
                        {u.pendingReports} chờ
                      </span>
                    )}
                    {u.confirmedViolations === 0 && u.pendingReports === 0 && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <LockState u={u} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <UserActions
                      u={u}
                      self={self}
                      onDetail={() => openDetail(u.id)}
                      onDialog={setDialog}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {data && data.totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.totalCount} người dùng · trang {page}/{pages}
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

      <UserDetailSheet
        userId={focus}
        selfId={me?.userId}
        onClose={() => openDetail(undefined)}
        onDialog={setDialog}
      />
      {dialog?.kind === "lock" && (
        <LockDialog key={dialog.user.id} user={dialog.user} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "unlock" && (
        <UnlockDialog key={dialog.user.id} user={dialog.user} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "role" && (
        <RoleDialog
          key={dialog.user.id}
          user={dialog.user}
          grant={dialog.grant}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function LockState({ u }: { u: AdminUserRow }) {
  if (!u.isLocked)
    return (
      <Badge variant="outline" className="border-success/30 bg-success/15 text-success">
        Hoạt động
      </Badge>
    );
  const forever = !u.lockedUntil || new Date(u.lockedUntil).getFullYear() > 9000;
  return (
    <div>
      <Badge variant="destructive" className="gap-1">
        <Lock className="h-3 w-3" />{" "}
        {forever ? "Khoá vô thời hạn" : `Khoá tới ${formatDate(u.lockedUntil!)}`}
      </Badge>
      {u.lockReason && (
        <div
          className="mt-0.5 max-w-[220px] truncate text-xs text-muted-foreground"
          title={u.lockReason}
        >
          {u.lockReason}
        </div>
      )}
    </div>
  );
}

function UserActions({
  u,
  self,
  onDetail,
  onDialog,
}: {
  u: AdminUserRow;
  self: boolean;
  onDetail: () => void;
  onDialog: (d: Dialogs) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Thao tác">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDetail}>
          <UserRound className="mr-2 h-4 w-4" /> Xem chi tiết
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/all-listings" search={{ ownerId: u.id, ownerName: u.name }}>
            <ListChecks className="mr-2 h-4 w-4" /> Xem mọi tin của người này
          </Link>
        </DropdownMenuItem>
        {!self && (
          <>
            <DropdownMenuSeparator />
            {u.isLocked ? (
              <DropdownMenuItem onClick={() => onDialog({ kind: "unlock", user: u })}>
                <LockOpen className="mr-2 h-4 w-4" /> Mở khoá
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={u.isAdmin}
                className="text-destructive"
                onClick={() => onDialog({ kind: "lock", user: u })}
              >
                <Lock className="mr-2 h-4 w-4" /> Khoá tài khoản
                {u.isAdmin ? " (thu quyền Admin trước)" : ""}
              </DropdownMenuItem>
            )}
            {u.isAdmin ? (
              <DropdownMenuItem onClick={() => onDialog({ kind: "role", user: u, grant: false })}>
                <ShieldMinus className="mr-2 h-4 w-4" /> Thu quyền Admin
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={u.isLocked}
                onClick={() => onDialog({ kind: "role", user: u, grant: true })}
              >
                <ShieldCheck className="mr-2 h-4 w-4" /> Cấp quyền Admin
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserDetailSheet({
  userId,
  selfId,
  onClose,
  onDialog,
}: {
  userId: string | undefined;
  selfId: string | undefined;
  onClose: () => void;
  onDialog: (d: Dialogs) => void;
}) {
  const q = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => adminManageApi.user(userId!),
    enabled: !!userId,
  });
  const d = q.data;
  return (
    <Sheet open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{d?.user.name ?? "Người dùng"}</SheetTitle>
          <SheetDescription>{d?.user.email}</SheetDescription>
        </SheetHeader>
        {q.isLoading && <Skeleton className="mt-4 h-40 w-full" />}
        {q.error && <p className="mt-4 text-sm text-destructive">{getErrorMessage(q.error)}</p>}
        {d && (
          <div className="mt-4 space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Tham gia" value={formatDate(d.user.createdAt)} />
              <Stat label="Điện thoại" value={d.user.phone ?? "—"} />
              <Stat
                label="Tin đang hiển thị"
                value={`${d.user.liveListingCount}/${d.user.listingCount}`}
              />
              <Stat
                label="Vi phạm đã xác nhận"
                value={`${d.user.confirmedViolations}${d.user.pendingReports ? ` · ${d.user.pendingReports} báo đang chờ` : ""}`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LockState u={d.user} />
              {d.user.isAdmin && (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Quản trị viên
                </Badge>
              )}
            </div>
            {d.user.isLocked && d.lockedAt && (
              <p className="text-xs text-muted-foreground">
                Khoá lúc {formatDateTime(d.lockedAt)}
                {d.lockedByName ? ` bởi ${d.lockedByName}` : ""}.
              </p>
            )}
            {d.user.id !== selfId && (
              <div className="flex flex-wrap gap-2">
                {d.user.isLocked ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDialog({ kind: "unlock", user: d.user })}
                  >
                    <LockOpen className="mr-1.5 h-4 w-4" /> Mở khoá
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={d.user.isAdmin}
                    onClick={() => onDialog({ kind: "lock", user: d.user })}
                  >
                    <Lock className="mr-1.5 h-4 w-4" /> Khoá tài khoản
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <Link
                    to="/admin/all-listings"
                    search={{ ownerId: d.user.id, ownerName: d.user.name }}
                  >
                    <ListChecks className="mr-1.5 h-4 w-4" /> Quản lý tin
                  </Link>
                </Button>
              </div>
            )}

            <div>
              <div className="mb-1.5 font-medium">Tin đăng gần đây ({d.listings.length})</div>
              {d.listings.length === 0 ? (
                <p className="text-muted-foreground">Chưa đăng tin nào.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {d.listings.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate">{l.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatListingPrice(l.price, l.type, l.rentPaymentCycle)} · {l.district}
                          {l.pendingReports > 0 && ` · ${l.pendingReports} báo vi phạm`}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 ${LISTING_STATUS_CLASS[l.status]}`}
                      >
                        {LISTING_STATUS[l.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function useAfterAction(onClose: () => void) {
  const qc = useQueryClient();
  return (msg: string) => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-user"] });
    qc.invalidateQueries({ queryKey: ["admin-all-listings"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    toast.success(msg);
    onClose();
  };
}

const DURATIONS = [
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "forever", label: "Vô thời hạn" },
];

function LockDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("30");
  const [hide, setHide] = useState(true);
  const done = useAfterAction(onClose);
  const m = useMutation({
    mutationFn: () =>
      adminManageApi.lock(
        user.id,
        reason.trim(),
        duration === "forever" ? null : Number(duration),
        hide,
      ),
    onSuccess: (r) => done(r.message),
    onError: (e) => toast.error(getErrorMessage(e, "Không khoá được tài khoản")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Khoá tài khoản {user.name}</DialogTitle>
          <DialogDescription>
            Người này bị đăng xuất khỏi mọi thiết bị ngay lập tức. Khi đăng nhập lại, họ thấy lý do
            và thời hạn khoá.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="lock-reason">Lý do (người bị khoá sẽ đọc được)</Label>
          <Textarea
            id="lock-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: đăng tin phòng không có thật, nhận cọc rồi không giao phòng."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Thời hạn</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            checked={hide}
            onCheckedChange={(v) => setHide(v === true)}
            className="mt-0.5"
          />
          <span>
            Gỡ luôn tin đang hiển thị và đang chờ duyệt ({user.liveListingCount} tin đang hiển thị)
            <span className="block text-xs text-muted-foreground">
              Mở khoá sau này sẽ khôi phục đúng những tin này.
            </span>
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 5 || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Khoá tài khoản
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnlockDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [restore, setRestore] = useState(true);
  const done = useAfterAction(onClose);
  const m = useMutation({
    mutationFn: () => adminManageApi.unlock(user.id, restore),
    onSuccess: (r) => done(r.message),
    onError: (e) => toast.error(getErrorMessage(e, "Không mở khoá được")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mở khoá {user.name}</DialogTitle>
          <DialogDescription>
            {user.lockReason
              ? `Lý do khoá trước đó: ${user.lockReason}`
              : "Người này đăng nhập lại được ngay."}
          </DialogDescription>
        </DialogHeader>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            checked={restore}
            onCheckedChange={(v) => setRestore(v === true)}
            className="mt-0.5"
          />
          <span>
            Khôi phục các tin đã bị gỡ lúc khoá
            <span className="block text-xs text-muted-foreground">
              Tin đang hiển thị lúc đó hiện lại; tin còn chờ duyệt quay về hàng đợi duyệt. Tin bị gỡ
              vì lý do khác giữ nguyên.
            </span>
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Mở khoá
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleDialog({
  user,
  grant,
  onClose,
}: {
  user: AdminUserRow;
  grant: boolean;
  onClose: () => void;
}) {
  const done = useAfterAction(onClose);
  const m = useMutation({
    mutationFn: () => adminManageApi.setAdmin(user.id, grant),
    onSuccess: (r) => done(r.message),
    onError: (e) => toast.error(getErrorMessage(e, "Không đổi được quyền")),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{grant ? "Cấp quyền quản trị" : "Thu quyền quản trị"}</DialogTitle>
          <DialogDescription>
            {grant
              ? `${user.name} sẽ duyệt tin, xử lý báo vi phạm, gỡ tin và khoá tài khoản được như bạn.`
              : `${user.name} mất quyền vào khu quản trị ngay, kể cả phiên đang mở.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            variant={grant ? "default" : "destructive"}
            disabled={m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {grant ? "Cấp quyền" : "Thu quyền"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
