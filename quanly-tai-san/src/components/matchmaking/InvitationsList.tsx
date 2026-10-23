import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Flag, Gift, Handshake, ImageIcon, Loader2, X } from "lucide-react";
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
import { INVITATIONS_KEY, matchmakingApi, type SeekerInvitation } from "@/lib/api/matchmaking";
import { formatListingPrice, listingsApi } from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

/**
 * Hộp lời mời xem nhà của người tìm — phía nhận của ghép đôi hai chiều.
 *
 * Nhận lời = gửi một yêu cầu xem nhà bình thường cho chủ tin (kèm thông tin liên hệ của
 * mình). Từ chối thì chủ tin chỉ biết "đã từ chối", không biết gì thêm.
 */
export function InvitationsList() {
  const q = useQuery({
    queryKey: INVITATIONS_KEY,
    queryFn: matchmakingApi.myInvitations,
    retry: 1,
  });

  if (q.isLoading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  if (q.isError)
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          {getErrorMessage(q.error, "Không tải được lời mời")}
        </CardContent>
      </Card>
    );

  const rows = q.data ?? [];
  if (rows.length === 0)
    return (
      <Card>
        <CardContent className="space-y-2 py-12 text-center text-sm text-muted-foreground">
          <Handshake className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p>Chưa có lời mời nào.</p>
          <p className="mx-auto max-w-md">
            Đăng một nhu cầu — chủ nhà có căn khớp sẽ mời bạn xem nhà, không cần bạn đi hỏi từng
            tin.
          </p>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-3">
      {rows.map((inv) => (
        <InvitationCard key={inv.id} inv={inv} />
      ))}
    </div>
  );
}

/**
 * Ưu đãi riêng chủ nhà hứa trong lời mời: đặt giá niêm yết cạnh giá cho riêng người này. Nhận lời
 * thì ưu đãi được ghi cứng vào yêu cầu xem nhà. Ưu đãi sai sự thật báo qua đúng luồng báo vi phạm
 * tin (lý do "Thông tin sai").
 */
function OfferBox({ inv }: { inv: SeekerInvitation }) {
  const report = useMutation({
    mutationFn: () =>
      listingsApi.report(
        inv.listingSlug,
        2,
        `Ưu đãi trong lời mời xem nhà không đúng sự thật: ${[
          inv.offerPrice != null ? `giá ưu đãi ${formatCurrency(inv.offerPrice)}` : null,
          inv.offerNote,
        ]
          .filter(Boolean)
          .join(" · ")}`,
      ),
    onSuccess: () => toast.success("Đã gửi báo cáo. Quản trị viên sẽ xem xét tin này."),
    onError: (e) => toast.error(getErrorMessage(e, "Chưa gửi được báo cáo")),
  });

  return (
    <div className="space-y-1.5 rounded-md border border-primary/40 bg-primary/[0.05] p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-primary">
        <Gift className="h-4 w-4" /> Ưu đãi riêng cho bạn
      </p>
      {inv.offerPrice != null && (
        <p>
          Giá đang đăng{" "}
          <span className="text-muted-foreground line-through">
            {formatListingPrice(inv.price, inv.type, inv.rentPaymentCycle)}
          </span>{" "}
          → giá cho bạn{" "}
          <span className="font-semibold">
            {formatListingPrice(inv.offerPrice, inv.type, inv.rentPaymentCycle)}
          </span>
        </p>
      )}
      {inv.offerNote && <p>{inv.offerNote}</p>}
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">
          Nhận lời thì ưu đãi này được ghi vào yêu cầu xem nhà, cả hai bên cùng thấy.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
              disabled={report.isPending || report.isSuccess}
            >
              <Flag className="mr-1 h-3 w-3" />
              {report.isSuccess ? "Đã báo" : "Báo ưu đãi sai"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Báo ưu đãi không đúng sự thật?</AlertDialogTitle>
              <AlertDialogDescription>
                Quản trị viên sẽ kiểm tra tin này. Chủ nhà không biết ai đã báo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Thôi</AlertDialogCancel>
              <AlertDialogAction onClick={() => report.mutate()}>Gửi báo cáo</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function InvitationCard({ inv }: { inv: SeekerInvitation }) {
  const qc = useQueryClient();
  const [accepting, setAccepting] = useState(false);
  const [message, setMessage] = useState("");
  const [when, setWhen] = useState("");

  const respond = useMutation({
    mutationFn: (accept: boolean) =>
      matchmakingApi.respond(
        inv.id,
        accept,
        accept ? message.trim() || null : null,
        accept && when ? new Date(when).toISOString() : null,
      ),
    onSuccess: (updated) => {
      qc.setQueryData<SeekerInvitation[]>(INVITATIONS_KEY, (old) =>
        old?.map((x) => (x.id === updated.id ? updated : x)),
      );
      qc.invalidateQueries({ queryKey: ["inquiries", "sent"] });
      setAccepting(false);
      toast.success(
        updated.status === 2 ? "Đã nhận lời — chủ nhà sẽ liên hệ với bạn" : "Đã từ chối lời mời",
      );
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không gửi được câu trả lời")),
  });

  const pending = inv.status === 1 && !inv.expired;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex gap-3">
          <Link
            to="/tin-dang/$slug"
            params={{ slug: inv.listingSlug }}
            className="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-muted"
          >
            {inv.thumbnailUrl ? (
              <img src={inv.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-muted-foreground/50">
                <ImageIcon className="h-6 w-6" />
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge inv={inv} />
              <span className="text-xs text-muted-foreground">{formatDateTime(inv.createdAt)}</span>
            </div>
            <Link
              to="/tin-dang/$slug"
              params={{ slug: inv.listingSlug }}
              className="line-clamp-2 text-sm font-medium hover:underline"
            >
              {inv.listingTitle}
            </Link>
            <p className="text-sm">
              <span className="font-semibold">
                {formatListingPrice(inv.price, inv.type, inv.rentPaymentCycle)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                · {inv.district}, {inv.city}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <p>
            <strong>{inv.ownerName}</strong> mời bạn xem nhà
            {inv.demandName && (
              <span className="text-muted-foreground">
                {" "}
                vì tin này khớp nhu cầu “{inv.demandName}”
              </span>
            )}
            .
          </p>
          {inv.message && <p className="mt-1 italic text-muted-foreground">“{inv.message}”</p>}
        </div>

        {(inv.offerPrice != null || inv.offerNote) && <OfferBox inv={inv} />}

        {pending && !accepting && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className="mr-auto text-xs text-muted-foreground">
              Chủ nhà chưa biết bạn là ai — nhận lời thì họ mới thấy tên và số điện thoại của bạn.
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={respond.isPending}
              onClick={() => respond.mutate(false)}
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Từ chối
            </Button>
            <Button size="sm" onClick={() => setAccepting(true)}>
              <Check className="mr-1.5 h-3.5 w-3.5" /> Nhận lời
            </Button>
          </div>
        )}

        {pending && accepting && (
          <div className="space-y-2 border-t pt-3">
            <div className="space-y-1.5">
              <Label htmlFor={`when-${inv.id}`}>Bạn muốn xem nhà lúc nào? (không bắt buộc)</Label>
              <Input
                id={`when-${inv.id}`}
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
            <Textarea
              rows={2}
              maxLength={900}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Lời nhắn cho chủ nhà (không bắt buộc)"
              aria-label="Lời nhắn cho chủ nhà"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAccepting(false)}>
                Huỷ
              </Button>
              <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate(true)}>
                {respond.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Gửi và nhận lời
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ inv }: { inv: SeekerInvitation }) {
  if (inv.status === 2) return <Badge className="bg-success text-white">Đã nhận lời</Badge>;
  if (inv.status === 3) return <Badge variant="secondary">Đã từ chối</Badge>;
  if (inv.expired) return <Badge variant="outline">Đã hết hạn</Badge>;
  return <Badge>Lời mời mới</Badge>;
}
