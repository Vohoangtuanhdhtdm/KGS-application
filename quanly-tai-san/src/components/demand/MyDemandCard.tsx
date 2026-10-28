import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Handshake, Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LISTING_TYPE } from "@/constants/enums";
import { getErrorMessage } from "@/lib/api/errors";
import { savedSearchesApi, type SavedSearchDto } from "@/lib/api/savedSearches";
import { daysUntil, formatCurrency } from "@/lib/format";
import { demandState } from "@/lib/demandState";
import { toastIfPendingReview } from "./demandToast";

const KEY = ["saved-searches"];

/** "Cho thuê · Quận Bình Thạnh · dưới 5 triệu · 2 người". */
function summary(s: SavedSearchDto) {
  const c = s.criteria;
  const parts: string[] = [];
  if (c.type === 1 || c.type === 2) parts.push(LISTING_TYPE[c.type]);
  const place = c.district ?? c.city;
  if (place) parts.push(place);
  const max = c.priceMax ?? c.totalCostMax;
  if (c.priceMin && max)
    parts.push(
      `${formatCurrency(c.priceMin, { compact: true })}–${formatCurrency(max, { compact: true })}`,
    );
  else if (max) parts.push(`dưới ${formatCurrency(max, { compact: true })}`);
  else if (c.priceMin) parts.push(`từ ${formatCurrency(c.priceMin, { compact: true })}`);
  if (c.occupants) parts.push(`${c.occupants} người`);
  if (c.petsAllowed) parts.push("có thú cưng");
  return parts.join(" · ");
}

/** Một nhu cầu (bộ lọc đã lưu) trên trang "Nhu cầu của tôi". */
export function MyDemandCard({ search }: { search: SavedSearchDto }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(search.demandNote ?? "");
  const state = demandState(search);
  const daysLeft = search.discoverableUntil ? daysUntil(search.discoverableUntil) : null;

  const done = (msg: string) => () => {
    qc.invalidateQueries({ queryKey: KEY });
    toast.success(msg);
  };
  const fail = (fallback: string) => (e: unknown) => toast.error(getErrorMessage(e, fallback));

  const renew = useMutation({
    mutationFn: () => savedSearchesApi.renew(search.id),
    onSuccess: (s) => {
      if (toastIfPendingReview(s)) return void qc.invalidateQueries({ queryKey: KEY });
      done("Đã gia hạn thêm 30 ngày.")();
    },
    onError: fail("Chưa gia hạn được"),
  });
  const setOpen = useMutation({
    mutationFn: (enabled: boolean) =>
      savedSearchesApi.setDiscoverable(search.id, enabled, note.trim() || null),
    onSuccess: (s) => {
      setEditing(false);
      if (toastIfPendingReview(s)) return void qc.invalidateQueries({ queryKey: KEY });
      done(
        s.discoverableByOwners
          ? "Đã mở cho chủ nhà phù hợp mời bạn."
          : "Đã tắt — chủ nhà không còn thấy nhu cầu này.",
      )();
    },
    onError: fail("Chưa đổi được"),
  });
  const remove = useMutation({
    mutationFn: () => savedSearchesApi.remove(search.id),
    onSuccess: done("Đã xoá nhu cầu."),
    onError: fail("Chưa xoá được"),
  });
  const busy = renew.isPending || setOpen.isPending || remove.isPending;

  return (
    <Card className={state === "open" ? "border-primary/40" : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{search.name}</p>
            <p className="text-sm text-muted-foreground">{summary(search)}</p>
          </div>
          {state === "open" ? (
            <Badge className="gap-1">
              <Handshake className="h-3 w-3" /> Đang mở cho chủ nhà
              {daysLeft !== null && ` · còn ${Math.max(daysLeft, 0)} ngày`}
            </Badge>
          ) : state === "pending" ? (
            <Badge
              variant="outline"
              className="border-amber-500/50 text-amber-700 dark:text-amber-400"
            >
              Chờ duyệt
            </Badge>
          ) : state === "rejected" ? (
            <Badge variant="outline" className="border-destructive/50 text-destructive">
              Bị từ chối
            </Badge>
          ) : state === "expired" ? (
            <Badge
              variant="outline"
              className="border-amber-500/50 text-amber-700 dark:text-amber-400"
            >
              Đã hết hạn
            </Badge>
          ) : (
            <Badge variant="secondary">Chỉ nhận báo tin mới</Badge>
          )}
        </div>

        {(state === "pending" || state === "rejected") && (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              state === "pending"
                ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {state === "pending"
              ? `Chủ nhà chưa thấy nhu cầu này cho tới khi được duyệt. Lý do cần kiểm tra: ${search.demandReviewReason ?? "—"}.`
              : `Lý do: ${search.demandReviewReason ?? "—"}. Sửa lời nhắn rồi gửi lại để được duyệt.`}
          </p>
        )}

        <Link
          to="/tin-dang"
          search={{ bo_loc: search.id }}
          className="flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
        >
          <Users className="h-4 w-4" />
          {search.matchingListings > 0
            ? `Đang khớp ${search.matchingListings} căn của ${search.matchingOwners} chủ nhà`
            : "Chưa có căn nào khớp — chủ nhà đăng sau vẫn mời được bạn"}
        </Link>

        {search.demandNote && !editing && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">“{search.demandNote}”</p>
        )}
        {editing && (
          <div className="space-y-2">
            <Textarea
              rows={3}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Lời nhắn cho chủ nhà"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => setOpen.mutate(true)}>
                Lưu lời nhắn
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Huỷ
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {(state === "expired" || (state === "open" && daysLeft !== null && daysLeft <= 7)) && (
            <Button size="sm" disabled={busy} onClick={() => renew.mutate()}>
              {renew.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="mr-1.5 h-4 w-4" />
              )}
              Gia hạn 30 ngày
            </Button>
          )}
          {state === "open" || state === "pending" || state === "rejected" ? (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                {state === "rejected" ? "Sửa lời nhắn và gửi lại" : "Sửa lời nhắn"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setOpen.mutate(false)}
              >
                Tắt
              </Button>
            </>
          ) : (
            state === "alerts" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen.mutate(true)}
              >
                <Handshake className="mr-1.5 h-4 w-4" /> Mở cho chủ nhà mời
              </Button>
            )
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-muted-foreground"
                disabled={busy}
                aria-label="Xoá nhu cầu"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xoá nhu cầu “{search.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  Chủ nhà sẽ không mời được bạn theo nhu cầu này nữa, và bạn không nhận báo tin mới
                  của nó. Lời mời đã nhận vẫn giữ nguyên.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Giữ lại</AlertDialogCancel>
                <AlertDialogAction onClick={() => remove.mutate()}>Xoá</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
