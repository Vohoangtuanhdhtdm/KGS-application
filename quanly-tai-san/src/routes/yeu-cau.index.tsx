import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  INQUIRY_STATUS,
  INQUIRY_STATUS_CLASS,
  inquiriesApi,
  type InquiryStatusCode,
  type ReceivedInquiryDto,
} from "@/lib/api/engagement";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarClock, Inbox, Mail, Phone, Send, UserPlus } from "lucide-react";

export const Route = createFileRoute("/yeu-cau/")({
  head: () => ({ meta: [{ title: "Yêu cầu xem nhà — Quản Lý Tài Sản" }] }),
  component: InquiriesPage,
});

/** `embedded` = đang render bên trong FeatureSheet: bỏ padding/tiêu đề trùng lặp. */
export function InquiriesPage({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <div className={embedded ? "space-y-5" : "p-6 space-y-5 max-w-[1000px]"}>
      <div>
        {!embedded && <h1 className="text-2xl font-semibold tracking-tight">Yêu cầu xem nhà</h1>}
        <p className="text-sm text-muted-foreground mt-1">
          Nơi marketplace nối vào nghiệp vụ cho thuê: duyệt yêu cầu, chuyển người hỏi thành đối tác,
          rồi ký hợp đồng mà không phải nhập lại thông tin.
        </p>
      </div>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Nhận được</TabsTrigger>
          <TabsTrigger value="sent">Đã gửi</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="pt-4">
          <ReceivedList />
        </TabsContent>
        <TabsContent value="sent" className="pt-4">
          <SentList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReceivedList() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["inquiries", "received"],
    queryFn: () => inquiriesApi.received(),
    retry: 1,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["inquiries", "received"] });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InquiryStatusCode }) =>
      inquiriesApi.updateStatus(id, status),
    onSuccess: () => {
      invalidate();
      toast.success("Đã cập nhật trạng thái");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không cập nhật được trạng thái")),
  });

  const convert = useMutation({
    mutationFn: (id: string) => inquiriesApi.convert(id),
    onSuccess: (res) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`Đã tạo đối tác "${res.contactFullName}"`, {
        description: "Mở màn hình tạo hợp đồng với đối tác này?",
        action: {
          label: "Tạo hợp đồng",
          onClick: () =>
            navigate({ to: "/hop-dong/moi", search: { counterpartyId: res.contactPartyId } }),
        },
      });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không chuyển được thành khách thuê")),
  });

  const rows = query.data ?? [];

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {getErrorMessage(query.error, "Không tải được danh sách yêu cầu")}
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center text-sm text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          Chưa có ai gửi yêu cầu xem nhà. Yêu cầu sẽ xuất hiện ở đây khi có người quan tâm tin đăng
          của bạn.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((q) => (
        <InquiryCard
          key={q.id}
          inquiry={q}
          busy={setStatus.isPending || convert.isPending}
          onStatus={(status) => setStatus.mutate({ id: q.id, status })}
          onConvert={() => convert.mutate(q.id)}
        />
      ))}
    </div>
  );
}

function InquiryCard({
  inquiry: q,
  busy,
  onStatus,
  onConvert,
}: {
  inquiry: ReceivedInquiryDto;
  busy: boolean;
  onStatus: (status: InquiryStatusCode) => void;
  onConvert: () => void;
}) {
  const converted = q.convertedContactPartyId !== null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-medium">{q.fromUserName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
              {q.fromUserPhone && (
                <a href={`tel:${q.fromUserPhone}`} className="inline-flex items-center gap-1 hover:underline">
                  <Phone className="h-3 w-3" />
                  {q.fromUserPhone}
                </a>
              )}
              {q.fromUserEmail && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {q.fromUserEmail}
                </span>
              )}
            </p>
          </div>
          <Badge variant="outline" className={INQUIRY_STATUS_CLASS[q.status]}>
            {INQUIRY_STATUS[q.status]}
          </Badge>
        </div>

        <p className="text-sm">
          Hỏi về{" "}
          <Link
            to="/tin-dang/$slug"
            params={{ slug: q.propertySlug }}
            className="text-primary hover:underline"
          >
            {q.propertyTitle}
          </Link>
        </p>

        {q.message && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 whitespace-pre-wrap">
            {q.message}
          </p>
        )}

        {q.preferredViewingAt && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            Muốn xem nhà: {formatDateTime(q.preferredViewingAt)}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          {!converted && q.status !== 5 && (
            <>
              {q.status === 1 && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus(2)}>
                  Đã liên hệ
                </Button>
              )}
              {q.status === 2 && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus(3)}>
                  Đã dẫn xem nhà
                </Button>
              )}
              <Button size="sm" disabled={busy} onClick={onConvert}>
                <UserPlus className="h-4 w-4 mr-1.5" />
                Chuyển thành khách thuê
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onStatus(5)}>
                Đóng
              </Button>
            </>
          )}
          {converted && (
            <Link
              to="/hop-dong/moi"
              search={{ counterpartyId: q.convertedContactPartyId! }}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <UserPlus className="h-4 w-4" />
              Tạo hợp đồng với khách này
            </Link>
          )}
        </div>

        <p className="text-xs text-muted-foreground">Gửi lúc {formatDateTime(q.createdAt)}</p>
      </CardContent>
    </Card>
  );
}

function SentList() {
  const query = useQuery({
    queryKey: ["inquiries", "sent"],
    queryFn: () => inquiriesApi.sent(),
    retry: 1,
  });

  const rows = query.data ?? [];

  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {getErrorMessage(query.error, "Không tải được danh sách yêu cầu đã gửi")}
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center text-sm text-muted-foreground">
          <Send className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p>Bạn chưa gửi yêu cầu xem nhà nào.</p>
          <Link to="/tin-dang" className="text-primary hover:underline mt-2 inline-block">
            Tìm bất động sản cho thuê
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((q) => (
        <Card key={q.id}>
          <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 space-y-1">
              <Link
                to="/tin-dang/$slug"
                params={{ slug: q.propertySlug }}
                className="font-medium hover:underline"
              >
                {q.propertyTitle}
              </Link>
              {q.message && (
                <p className="text-sm text-muted-foreground line-clamp-2">{q.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Gửi lúc {formatDateTime(q.createdAt)}</p>
            </div>
            <Badge variant="outline" className={INQUIRY_STATUS_CLASS[q.status]}>
              {INQUIRY_STATUS[q.status]}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
