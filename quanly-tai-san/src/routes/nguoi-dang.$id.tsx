import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Home,
  MessageCircleReply,
  Phone,
  ShieldQuestion,
} from "lucide-react";
import { ownersApi } from "@/lib/api/listings";
import { ApiError } from "@/lib/auth/types";
import { getErrorMessage } from "@/lib/api/errors";
import { CompactCard } from "@/components/public/RelatedListings";
import { PublicHeader } from "@/components/public/PublicHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/nguoi-dang/$id")({
  head: () => ({ meta: [{ title: "Hồ sơ người đăng — KGS" }] }),
  component: () => (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <OwnerProfilePage />
    </div>
  ),
});

/** "3 tháng", "1 năm 2 tháng" — thời gian đã tham gia, thứ người tìm nhà dùng để đánh giá
 *  một tài khoản mới tạo hôm qua khác một tài khoản đã đăng tin hai năm. */
function since(iso: string): string {
  const months = Math.max(
    0,
    (new Date().getFullYear() - new Date(iso).getFullYear()) * 12 +
      (new Date().getMonth() - new Date(iso).getMonth()),
  );
  if (months < 1) return "chưa tới 1 tháng";
  if (months < 12) return `${months} tháng`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} năm ${m} tháng` : `${y} năm`;
}

function responseText(hours: number | null): string | null {
  if (hours == null) return null;
  if (hours < 1) return "thường trả lời trong vòng 1 giờ";
  if (hours < 24) return `thường trả lời trong khoảng ${Math.round(hours)} giờ`;
  return `thường trả lời trong khoảng ${Math.round(hours / 24)} ngày`;
}

/**
 * Hồ sơ công khai của người đăng.
 *
 * Chỉ hiện những gì hệ thống THẬT SỰ kiểm chứng được. Không có nhãn "đã xác minh danh tính"
 * vì KGS không kiểm tra giấy tờ — gắn nhãn đó là cho người tìm nhà một sự yên tâm giả, đúng
 * thứ kẻ lừa đảo cần. Không lộ email; số điện thoại đã có ở từng tin đăng.
 */
function OwnerProfilePage() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["owner-profile", id],
    queryFn: () => ownersApi.profile(id),
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 1,
  });

  if (q.isLoading)
    return (
      <div className="mx-auto max-w-[1100px] space-y-4 p-4 lg:p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (q.error)
    return (
      <div className="mx-auto max-w-[1100px] p-4 lg:p-6">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {q.error instanceof ApiError && q.error.status === 404
              ? "Không tìm thấy người đăng này, hoặc tài khoản đã ngừng hoạt động."
              : getErrorMessage(q.error)}
          </CardContent>
        </Card>
      </div>
    );

  const p = q.data!;
  const reply = responseText(p.medianResponseHours);

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-4 lg:p-6">
      <Card>
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          <Avatar className="h-20 w-20 text-2xl">
            {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt={p.name} />}
            <AvatarFallback>{p.name.trim().charAt(0).toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-semibold">{p.name}</h1>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" /> Tham gia KGS {since(p.joinedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.emailVerified && (
                <Badge
                  variant="outline"
                  className="gap-1 border-success/30 bg-success/15 text-success"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Email đã xác thực
                </Badge>
              )}
              {p.hasPhone && (
                <Badge variant="outline" className="gap-1">
                  <Phone className="h-3.5 w-3.5" /> Có số điện thoại liên hệ
                </Badge>
              )}
            </div>
            {p.bio && <p className="whitespace-pre-wrap text-sm">{p.bio}</p>}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat icon={Home} value={String(p.activeListingCount)} label="tin đang đăng" />
              <Stat
                icon={Home}
                value={String(p.publishedListingCount)}
                label="tin từng được duyệt"
              />
              <Stat
                icon={MessageCircleReply}
                value={
                  p.inquiriesReceived > 0 ? `${p.inquiriesAnswered}/${p.inquiriesReceived}` : "—"
                }
                label={
                  p.inquiriesReceived > 0
                    ? `yêu cầu xem nhà đã trả lời (180 ngày)${reply ? ` · ${reply}` : ""}`
                    : "chưa nhận yêu cầu xem nhà nào"
                }
              />
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              KGS xác thực email và lưu số điện thoại, nhưng không kiểm tra giấy tờ tuỳ thân. Luôn
              xem nhà trực tiếp trước khi đặt cọc.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tin đang đăng ({p.listings.length})</h2>
        {p.listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Người này hiện không có tin nào đang hiển thị.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {p.listings.map((l) => (
              <CompactCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Home; value: string; label: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
        <Icon className="h-4 w-4 text-muted-foreground" /> {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
