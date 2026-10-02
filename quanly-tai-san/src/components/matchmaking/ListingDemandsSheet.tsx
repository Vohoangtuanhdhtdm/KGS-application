import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, Loader2, Send, ShieldCheck, UserRound, X } from "lucide-react";
import { matchmakingApi, type AnonymousDemand } from "@/lib/api/matchmaking";
import { getErrorMessage } from "@/lib/api/errors";
import { describeDemand } from "@/lib/demandSummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const MESSAGE_MAX = 500;

function since(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "hôm nay";
  if (days === 1) return "hôm qua";
  if (days < 30) return `${days} ngày trước`;
  return `${Math.floor(days / 30)} tháng trước`;
}

/**
 * Chủ tin xem những người đang tìm đúng loại nhà mình có, và mời họ xem nhà.
 *
 * Người tìm hiện ra ẨN DANH: chỉ có tiêu chí và lời nhắn họ tự viết. Không tên, không số
 * điện thoại, không vị trí điểm họ ghim. Danh tính chỉ đến tay chủ tin khi người tìm nhận
 * lời — lúc đó lời mời thành một yêu cầu xem nhà bình thường ở trang Yêu cầu.
 */
export function ListingDemandsSheet({
  listing,
  open,
  onOpenChange,
}: {
  listing: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const key = ["listing-demands", listing.id];
  const q = useQuery({
    queryKey: key,
    queryFn: () => matchmakingApi.demands(listing.id),
    enabled: open,
  });
  const [composing, setComposing] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const invite = useMutation({
    mutationFn: (demandId: string) =>
      matchmakingApi.invite(listing.id, demandId, message.trim() || null),
    onSuccess: (updated) => {
      qc.setQueryData<AnonymousDemand[]>(key, (old) =>
        old?.map((d) => (d.demandId === updated.demandId ? updated : d)),
      );
      setComposing(null);
      setMessage("");
      toast.success("Đã gửi lời mời", {
        description:
          "Họ nhận lời thì yêu cầu xem nhà sẽ hiện ở trang Yêu cầu, kèm thông tin liên hệ.",
      });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không gửi được lời mời")),
  });

  const rows = q.data ?? [];
  const waiting = rows.filter((d) => d.invitationStatus == null).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Người đang tìm nhà như tin này</SheetTitle>
          <SheetDescription className="line-clamp-2">{listing.title}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Đây là những người đã cho phép chủ nhà phù hợp mời họ. Bạn chỉ thấy nhu cầu, không thấy
            danh tính. Họ <strong>nhận lời</strong> thì yêu cầu xem nhà kèm số điện thoại sẽ đến
            trang Yêu cầu của bạn.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {q.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
          ) : q.isError ? (
            <p className="text-sm text-destructive">
              {getErrorMessage(q.error, "Không tải được danh sách")}
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Hiện chưa có ai đang tìm nhà khớp tin này.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {rows.length} người đang tìm · {waiting} người chưa được mời
              </p>
              {rows.map((d) => (
                <article key={d.demandId} className="space-y-2.5 rounded-lg border p-3">
                  <header className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      {d.alias}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      đang tìm từ {since(d.activeSince)}
                    </span>
                  </header>

                  <ul className="flex flex-wrap gap-1" aria-label="Nhu cầu">
                    {describeDemand(d.criteria, d.centerDistanceMeters).map((t) => (
                      <li key={t}>
                        <Badge variant="secondary" className="font-normal">
                          {t}
                        </Badge>
                      </li>
                    ))}
                  </ul>

                  {d.note && (
                    <blockquote className="border-l-2 pl-2.5 text-sm italic text-muted-foreground">
                      “{d.note}”
                    </blockquote>
                  )}

                  {d.invitationStatus != null ? (
                    <InvitationState demand={d} />
                  ) : composing === d.demandId ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={3}
                        value={message}
                        maxLength={MESSAGE_MAX}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Lời nhắn (không bắt buộc), ví dụ: Phòng còn trống từ đầu tháng, chiều nào bạn tiện xem nhà?"
                        aria-label="Lời nhắn kèm lời mời"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setComposing(null)}>
                          Huỷ
                        </Button>
                        <Button
                          size="sm"
                          disabled={invite.isPending}
                          onClick={() => invite.mutate(d.demandId)}
                        >
                          {invite.isPending ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Gửi lời mời
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setComposing(d.demandId);
                        setMessage("");
                      }}
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" /> Mời xem nhà
                    </Button>
                  )}
                </article>
              ))}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InvitationState({ demand: d }: { demand: AnonymousDemand }) {
  if (d.invitationStatus === 2)
    return (
      <p className="flex items-center gap-1.5 text-sm text-success">
        <Check className="h-4 w-4" /> Đã nhận lời — xem yêu cầu ở trang Yêu cầu
      </p>
    );
  if (d.invitationStatus === 3)
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <X className="h-4 w-4" /> Đã từ chối lời mời
      </p>
    );
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      {d.invitationExpired
        ? "Lời mời đã hết hạn"
        : `Đã mời ${since(d.invitedAt!)}, đang chờ trả lời`}
    </p>
  );
}
