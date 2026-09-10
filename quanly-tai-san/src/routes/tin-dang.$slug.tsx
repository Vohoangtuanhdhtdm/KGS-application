import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listingsApi,
  formatListingPrice,
  type PublicListingDetailDto,
} from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { formatCurrency, formatDate } from "@/lib/format";
import { AMENITIES, WATER_PRICING, type AmenityKey } from "@/constants/enums";
import { PublicHeader } from "@/components/public/PublicHeader";
import { BackButton } from "@/components/public/BackButton";
import { ListingShareActions } from "@/components/public/ListingShareActions";
import { RelatedListings } from "@/components/public/RelatedListings";
import { MarketTrendCard } from "@/components/public/MarketTrendCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClientMap } from "@/components/map/ClientMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Copy,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Heart,
  Send,
  CalendarDays,
  Building2,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { inquiriesApi, savedListingsApi } from "@/lib/api/engagement";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogDescription, DialogFooter, DialogHeader } from "@/components/ui/dialog";

export const Route = createFileRoute("/tin-dang/$slug")({
  // Nap tin ngay tren may chu de the OG duoc dung SAN trong HTML tra ve.
  //
  // Day la diem mau chot cua nut "chia se": Zalo, Messenger va Facebook doc the meta
  // bang bot, va bot khong chay JavaScript. Neu cho toi luc component fetch xong moi co
  // tieu de va anh thi moi lien ket duoc chia se deu hien ra mot o trong tron — dung
  // luc no can thuyet phuc nguoi nhan bam vao nhat.
  loader: async ({ params }) => {
    try {
      return await listingsApi.detail(params.slug);
    } catch {
      // KHONG de loi nay lam hong ca trang. Trong moi truong dev, may chu SSR (Node) goi
      // API qua HTTPS chung chi tu ky va se bi tu choi o tang TLS — trinh duyet thi bam
      // qua duoc, Node thi khong. Tra null de component tu tai lai o phia client; chi mat
      // the OG, ma bot thi khong doc trang dev.
      return null;
    }
  },

  head: ({ loaderData: p }) => {
    if (!p) return { meta: [{ title: "Chi tiết tin đăng — KGS" }] };

    const title = `${p.title} — ${p.district}, ${p.city}`;
    const description =
      p.description?.trim().slice(0, 200) ||
      `${formatListingPrice(p.price, p.type, p.rentPaymentCycle)} tại ${p.district}, ${p.city}.`;

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      // Thẻ tóm tắt ảnh lớn: tin nhà đất sống nhờ ảnh, một ô xem trước bé xíu thì
      // không hơn gì một dòng link trần.
      { name: "twitter:card", content: p.imageUrls.length > 0 ? "summary_large_image" : "summary" },
    ];

    if (p.imageUrls.length > 0) meta.push({ property: "og:image", content: p.imageUrls[0] });

    return { meta };
  },

  component: PublicListingDetailPage,
});

function PublicListingDetailPage() {
  const { slug } = Route.useParams();
  const seed = Route.useLoaderData();

  const query = useQuery({
    queryKey: ["public-listing", slug],
    queryFn: () => listingsApi.detail(slug),
    // Loader chay tren may chu da lay du lieu roi — dung lai lam gia tri ban dau thay vi
    // goi lan hai. Goi lan hai khong chi thua mot vong mang: endpoint chi tiet tang luot
    // xem, nen moi lan mo trang se dem thanh hai luot.
    //
    // Loader that bai (vd chung chi tu ky trong dev) thi seed la null va query chay binh
    // thuong — trang van dung, chi khong co the OG.
    initialData: seed ?? undefined,
    staleTime: seed ? 60_000 : 0,
    retry: 1,
  });

  /**
   * Khi loader trên máy chủ không lấy được tin, `head` trả về tiêu đề chung "Chi tiết tin
   * đăng" và nó ĐỨNG NGUYÊN như vậy kể cả sau khi phía client tải xong — thẻ trình duyệt,
   * lịch sử và dấu trang đều ghi cùng một dòng cho mọi tin. Ở đây cập nhật lại tiêu đề
   * theo dữ liệu thật ngay khi có.
   *
   * Chỉ chạm vào document.title khi loader KHÔNG có dữ liệu; nếu loader chạy được thì
   * HeadContent đã đặt đúng rồi, và ghi đè thêm một lần nữa chỉ tạo cơ hội lệch nhau.
   */
  const resolvedTitle = query.data
    ? `${query.data.title} — ${query.data.district}, ${query.data.city}`
    : null;
  useEffect(() => {
    if (seed || !resolvedTitle) return;
    document.title = resolvedTitle;
  }, [seed, resolvedTitle]);

  if (query.isLoading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <PublicHeader />
        <div className="mx-auto max-w-[1200px] p-4 lg:p-6 space-y-4">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="min-h-screen bg-muted/20">
        <PublicHeader />
        <div className="mx-auto max-w-[600px] p-6">
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-sm text-destructive">
                {getErrorMessage(query.error, "Không tìm thấy tin đăng hoặc tin chưa được duyệt.")}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/tin-dang">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Về danh sách tin đăng
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const p = query.data;
  const address = [p.addressDetail, p.ward, p.district, p.city].filter(Boolean).join(", ");

  const copyPhone = async () => {
    if (!p.ownerPhone) return;
    try {
      await navigator.clipboard.writeText(p.ownerPhone);
      toast.success("Đã sao chép số điện thoại");
    } catch {
      toast.error("Không sao chép được — hãy copy thủ công.");
    }
  };

  const specs: [string, string | null][] = [
    ["Diện tích", p.area != null ? `${p.area} m²` : null],
    ["Mặt tiền", p.frontage != null ? `${p.frontage} m` : null],
    ["Số tầng", p.floors != null ? String(p.floors) : null],
    ["Phòng ngủ", p.bedrooms != null ? String(p.bedrooms) : null],
    ["Phòng tắm", p.bathrooms != null ? String(p.bathrooms) : null],
    ["Hướng nhà", p.houseDirection],
    ["Pháp lý", p.legalStatus],
    ["Nội thất", p.furnitureState],
    ["Loại BĐS", p.assetTypeLabel],
  ];

  return (
    <div className="min-h-screen bg-muted/20 pb-24 lg:pb-6">
      <PublicHeader />
      <div className="mx-auto max-w-[1200px] p-4 lg:p-6 space-y-4">
        <BackButton />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <div className="lg:col-span-2 space-y-4">
            <Gallery images={p.imageUrls} title={p.title} />

            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge>{p.type === 1 ? "Bán" : "Cho thuê"}</Badge>
                <span className="text-xs text-muted-foreground">
                  Đăng ngày {formatDate(p.publishedAt)}
                </span>
              </div>
              {/* GIÁ là neo thị giác, không phải tiêu đề.
                  Trước đây cả hai cùng text-2xl font-semibold nên mắt không biết bám vào
                  đâu — trong khi thứ quyết định người ta đọc tiếp hay đóng tab là con số.
                  Dòng "Tổng cố định ..." trước nằm ở đây cũng đã bỏ: nó lặp lại đúng thứ
                  khối bóc tách chi phí bên dưới nói kỹ hơn. */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="text-3xl font-bold tabular-nums leading-none text-price">
                    {formatListingPrice(p.price, p.type, p.rentPaymentCycle)}
                  </div>
                  <h1 className="text-lg font-medium leading-snug text-foreground">{p.title}</h1>
                </div>
                <ListingShareActions slug={p.slug} title={p.title} />
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {address || "—"}
              </p>
            </div>

            {p.type === 2 && <TermsCard listing={p} />}

            {p.amenities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tiện nghi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {p.amenities.map((a) => (
                      <Badge key={a} variant="secondary" className="font-normal">
                        {AMENITIES[a as AmenityKey] ?? a}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thông số</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  {specs
                    .filter(([, v]) => v)
                    .map(([label, v]) => (
                      <div key={label}>
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="font-medium mt-0.5">{v}</div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {p.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Mô tả</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* giữ nguyên xuống dòng người dùng đã nhập */}
                  <p className="text-sm whitespace-pre-wrap">{p.description}</p>
                </CardContent>
              </Card>
            )}

            {p.latitude != null && p.longitude != null && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Vị trí</CardTitle>
                </CardHeader>
                <CardContent>
                  <ClientMap
                    center={[p.latitude, p.longitude]}
                    zoom={15}
                    height={280}
                    markers={[{ id: p.id, lat: p.latitude, lng: p.longitude, title: p.title }]}
                  />
                </CardContent>
              </Card>
            )}

            <MarketTrendCard city={p.city} district={p.district} />

            <RelatedListings slug={p.slug} ownerName={p.ownerName} />
          </div>

          {/* Card liên hệ — sticky bên phải desktop */}
          <div className="hidden lg:block sticky top-20">
            <ContactCard
              ownerName={p.ownerName}
              ownerPhone={p.ownerPhone}
              avatarUrl={p.ownerAvatarUrl}
              joinedAt={p.ownerJoinedAt}
              activeListingCount={p.ownerActiveListingCount}
              onCopy={copyPhone}
            >
              <EngagementActions listingId={p.id} slug={p.slug} />
            </ContactCard>
          </div>
        </div>
      </div>

      {/* Card liên hệ — cố định dưới cùng trên mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t bg-card p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Liên hệ</div>
            <div className="text-sm font-medium truncate">{p.ownerName}</div>
          </div>
          {p.ownerPhone ? (
            <>
              <Button variant="outline" size="icon" onClick={copyPhone} aria-label="Sao chép số">
                <Copy className="h-4 w-4" />
              </Button>
              <Button asChild>
                <a href={`tel:${p.ownerPhone}`}>
                  <Phone className="h-4 w-4 mr-1.5" />
                  Gọi {p.ownerPhone}
                </a>
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground text-right">
              Chưa có số điện thoại —<br />
              gửi yêu cầu xem nhà ở trên
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Số tháng/năm kể từ khi người đăng tạo tài khoản, viết cho người đọc chứ không phải ngày. */
function membershipLabel(iso: string): string {
  const months = Math.floor((Date.now() - new Date(iso).getTime()) / (30 * 86_400_000));
  if (months < 1) return "Mới tham gia";
  if (months < 12) return `Tham gia ${months} tháng`;
  const years = Math.floor(months / 12);
  return `Tham gia ${years} năm`;
}

function ContactCard({
  ownerName,
  ownerPhone,
  avatarUrl,
  joinedAt,
  activeListingCount,
  onCopy,
  children,
}: {
  ownerName: string;
  ownerPhone: string | null;
  avatarUrl: string | null;
  joinedAt: string;
  activeListingCount: number;
  onCopy: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        {/* Hồ sơ người đăng. Người tìm nhà quyết định có nhấc máy hay không dựa trên việc
            họ tin ai đang ở đầu dây bên kia — một cái tên trần trụi không nói được gì,
            còn "tham gia 8 tháng, đang có 5 tin" thì nói được, và nó cũng làm tài khoản
            mở hôm qua để đăng tin ma trở nên dễ nhận ra. */}
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={ownerName} />}
            <AvatarFallback>{ownerName.trim().charAt(0).toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Chủ tài sản</div>
            <div className="text-base font-semibold truncate">{ownerName}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {membershipLabel(joinedAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            {activeListingCount} tin đang đăng
          </span>
        </div>
        {/* Không có số thì KHÔNG dựng nút "Gọi". Một nút gọi bấm vào không quay được số
            còn tệ hơn là không có nút: người tìm nhà bấm, máy không phản ứng, và họ kết
            luận sản phẩm hỏng thay vì hiểu rằng người đăng chưa để lại số. */}
        {ownerPhone ? (
          <>
            <Button className="w-full text-base h-11" asChild>
              <a href={`tel:${ownerPhone}`}>
                <Phone className="h-4.5 w-4.5 mr-2" />
                Gọi {ownerPhone}
              </a>
            </Button>
            <Button variant="outline" className="w-full" onClick={onCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Sao chép số điện thoại
            </Button>
          </>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
            Người đăng chưa để lại số điện thoại. Hãy gửi yêu cầu xem nhà bên dưới — họ sẽ
            nhận được thông tin liên hệ của bạn.
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Hai hành động của phía CẦU: lưu tin để xem lại, và gửi yêu cầu xem nhà.
 * Đây là chỗ marketplace nối vào nghiệp vụ — yêu cầu gửi từ đây sẽ xuất hiện trong
 * hộp thư của chủ nhà, nơi họ chuyển thành đối tác rồi ký hợp đồng.
 */
function EngagementActions({ listingId, slug }: { listingId: string; slug: string }) {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [viewingAt, setViewingAt] = useState("");

  const save = useMutation({
    mutationFn: () => (saved ? savedListingsApi.unsave(listingId) : savedListingsApi.save(listingId)),
    onSuccess: () => {
      setSaved((v) => !v);
      qc.invalidateQueries({ queryKey: ["saved-listings"] });
      toast.success(saved ? "Đã bỏ lưu tin" : "Đã lưu tin");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không lưu được tin")),
  });

  const ask = useMutation({
    mutationFn: () =>
      inquiriesApi.create(slug, {
        message: message.trim() || null,
        preferredViewingAt: viewingAt ? new Date(viewingAt).toISOString() : null,
      }),
    onSuccess: () => {
      setAskOpen(false);
      setMessage("");
      setViewingAt("");
      qc.invalidateQueries({ queryKey: ["inquiries", "sent"] });
      toast.success("Đã gửi yêu cầu", {
        description: "Chủ nhà sẽ thấy yêu cầu của bạn trong hộp thư.",
      });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không gửi được yêu cầu")),
  });

  if (!isAuthenticated) {
    return (
      <div className="pt-1 text-center text-xs text-muted-foreground">
        <Link to="/login" className="text-primary hover:underline">
          Đăng nhập
        </Link>{" "}
        để lưu tin và gửi yêu cầu xem nhà.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>
          <Heart className={`h-4 w-4 mr-1.5 ${saved ? "fill-current text-primary" : ""}`} />
          {saved ? "Đã lưu" : "Lưu tin"}
        </Button>
        <Button variant="secondary" onClick={() => setAskOpen(true)}>
          <Send className="h-4 w-4 mr-1.5" />
          Xem nhà
        </Button>
      </div>

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gửi yêu cầu xem nhà</DialogTitle>
            <DialogDescription>
              Chủ nhà nhận được yêu cầu kèm tên và số điện thoại trong hồ sơ của bạn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="inquiry-message">Lời nhắn</Label>
              <Textarea
                id="inquiry-message"
                rows={4}
                placeholder="Ví dụ: Tôi muốn xem phòng vào cuối tuần, cho hỏi còn trống không ạ?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inquiry-time">Thời gian muốn xem (không bắt buộc)</Label>
              <Input
                id="inquiry-time"
                type="datetime-local"
                value={viewingAt}
                onChange={(e) => setViewingAt(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAskOpen(false)}>
              Huỷ
            </Button>
            <Button disabled={ask.isPending} onClick={() => ask.mutate()}>
              {ask.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Chi phí và điều kiện thuê — theo nghiên cứu, đây là thứ người thuê hỏi TRƯỚC khi
 * quyết định đi xem, và là thứ phần lớn tin đăng trên thị trường không nói ra.
 * Đặt ngay dưới giá, trên cả phần thông số kỹ thuật.
 */
function TermsCard({ listing: p }: { listing: PublicListingDetailDto }) {
  const t = p.terms;
  const money = (v: number | null) => (v == null ? null : formatCurrency(v));

  /* Bóc tách chi phí — điểm nhấn ký tên của sản phẩm.
     Bản trước đổ cả chín mục vào một lưới ô ngang hàng nhau: tiền cọc, điện, nước, phí dịch
     vụ, gửi xe, internet, ngày dọn vào, thuê tối thiểu, số người. Đó là một bảng thông số,
     và nó KHÔNG diễn đạt được điều duy nhất làm KGS khác các sàn khác — rằng giá thuê cộng
     các khoản cố định mới ra con số người thuê thực sự trả mỗi tháng.
     Ở đây viết ra đúng phép cộng đó. Điện và nước tách xuống dưới vì chúng tính theo mức
     dùng, cộng vào một con số cố định là nói sai. */
  const khoanCoDinh: [string, number][] = [
    ["Phí dịch vụ", t.serviceFee ?? 0],
    ["Gửi xe", t.parkingFee ?? 0],
    ["Internet", t.internetFee ?? 0],
  ].filter(([, v]) => (v as number) > 0) as [string, number][];

  const theoMucDung: string[] = [];
  if (t.electricityPrice != null)
    theoMucDung.push(`điện ${formatCurrency(t.electricityPrice)}/kWh`);
  if (t.waterPrice != null)
    theoMucDung.push(
      `nước ${formatCurrency(t.waterPrice)}${t.waterPricing === 1 ? "/m³" : "/người/tháng"}`,
    );

  const dieuKien: [string, string | null][] = [
    ["Tiền cọc", t.depositMonths != null ? `${t.depositMonths} tháng` : null],
    ["Dọn vào từ", t.availableFrom ? formatDate(t.availableFrom) : null],
    ["Thuê tối thiểu", t.minLeaseMonths != null ? `${t.minLeaseMonths} tháng` : null],
    ["Ở tối đa", t.maxOccupants != null ? `${t.maxOccupants} người` : null],
  ];

  const rules: [string, boolean | null][] = [
    ["Nuôi thú cưng", t.petsAllowed],
    ["Giờ giấc tự do", t.curfewFree],
    ["Ở chung chủ", t.sharedWithOwner],
    ["Được nấu ăn", t.cookingAllowed],
  ];

  const dieuKienHien = dieuKien.filter(([, v]) => v);
  const shownRules = rules.filter(([, v]) => v !== null);
  const coGiDeHien =
    khoanCoDinh.length > 0 || theoMucDung.length > 0 || dieuKienHien.length > 0 || shownRules.length > 0;

  if (!coGiDeHien) {
    return (
      <Card>
        <CardContent className="py-5 text-sm text-muted-foreground">
          Chủ tin chưa khai chi phí và điều kiện thuê. Hãy hỏi trực tiếp trước khi đi xem.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Khối phép cộng. Dùng viền màu giá + nền chìm để nó KHÁC mọi thẻ khác trên trang —
          đây là chỗ đáng nhìn nhất, nên nó phải trông khác. */}
      <Card className="border-price/30 bg-price-soft/40 shadow-[--shadow-e2]">
        <CardContent className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-price">
            Mỗi tháng bạn trả
          </p>

          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">Giá thuê</dt>
              <dd className="tabular-nums font-medium">{formatCurrency(p.price)}</dd>
            </div>
            {khoanCoDinh.map(([nhan, v]) => (
              <div key={nhan} className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">+ {nhan}</dt>
                <dd className="tabular-nums font-medium">{formatCurrency(v)}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-price/25 pt-3">
            <span className="font-semibold">Tổng cố định</span>
            <span className="text-xl font-bold tabular-nums text-price">
              {formatCurrency(p.totalMonthlyCost)}
            </span>
          </div>

          {theoMucDung.length > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Chưa gồm</span>{" "}
              {theoMucDung.join(" · ")} — hai khoản này tính theo mức dùng nên không cộng
              thành một con số cố định được.
            </p>
          )}
          {theoMucDung.length === 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Chủ tin chưa khai giá điện và nước. Nên hỏi trước khi đi xem.
            </p>
          )}
        </CardContent>
      </Card>

      {(dieuKienHien.length > 0 || shownRules.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Điều kiện thuê</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dieuKienHien.length > 0 && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
                {dieuKienHien.map(([label, v]) => (
                  <div key={label}>
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-0.5 font-medium tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
            )}
            {shownRules.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {shownRules.map(([label, v]) => (
                  <Badge
                    key={label}
                    variant="outline"
                    className={
                      v
                        ? "border-price/30 bg-price-soft text-price font-normal"
                        : "bg-muted text-muted-foreground font-normal"
                    }
                  >
                    {v ? "✓" : "✕"} {label}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Gallery ảnh.
 *
 * Bản trước là MỘT ảnh cao 320px kèm một dải thumbnail nhỏ bên dưới — trên một sàn bất động
 * sản, nơi ảnh là thứ quyết định người ta bấm vào hay bỏ qua, đó là cách dùng chỗ tệ nhất:
 * ảnh chính vẫn nhỏ, mà các ảnh còn lại thì bé tới mức không xem được gì.
 *
 * Bản này dựng lưới khảm: một ảnh lớn chiếm nửa trái, tối đa bốn ảnh nhỏ xếp lưới bên phải,
 * và một nút "Xem tất cả N ảnh". Lưới chỉ dựng khi có từ 3 ảnh — ít hơn thì khảm trông
 * khuyết, nên rơi về một ảnh lớn tràn chiều ngang.
 */
function Gallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const moAnh = (i: number) => {
    setIndex(i);
    setLightbox(true);
  };

  // Điều hướng bằng bàn phím trong lightbox. Không có nó thì người dùng bàn phím mở được
  // ảnh nhưng không đi tiếp được, và phải Esc ra rồi bấm chuột vào ảnh kế.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, images.length]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-muted">
        <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
      </div>
    );
  }

  const anhLon = (
    <button
      type="button"
      onClick={() => moAnh(0)}
      className="group relative h-full w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img
        src={images[0]}
        alt={`${title} — ảnh 1`}
        className="h-full w-full cursor-zoom-in object-cover transition-transform duration-500 group-hover:scale-[1.02]"
      />
    </button>
  );

  return (
    <div>
      {images.length < 3 ? (
        <div className="aspect-[16/9] overflow-hidden rounded-xl bg-muted">{anhLon}</div>
      ) : (
        <div className="relative grid aspect-[16/9] grid-cols-2 gap-2">
          {anhLon}
          {/* Lưới phải TỰ THÍCH ỨNG theo số ảnh còn lại.
              Bản đầu tôi cố định 2x2 rồi lấp chỗ thiếu bằng ô xám — mà ô xám trong lưới
              khảm trông y hệt ảnh hỏng, đúng thứ đang muốn tránh. Có 1-2 ảnh phụ thì xếp
              một cột; từ 3 ảnh trở lên mới dùng 2x2. Không bao giờ có ô trống. */}
          <div
            className={`grid gap-2 ${
              images.length - 1 <= 2 ? "grid-cols-1" : "grid-cols-2 grid-rows-2"
            }`}
          >
            {images.slice(1, 5).map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => moAnh(i + 1)}
                className="group relative overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={url}
                  alt={`${title} — ảnh ${i + 2}`}
                  className="h-full w-full cursor-zoom-in object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="absolute bottom-3 right-3 bg-card shadow-[--shadow-e2]"
            onClick={() => moAnh(0)}
          >
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
            Xem tất cả {images.length} ảnh
          </Button>
        </div>
      )}

      <Dialog open={lightbox} onOpenChange={setLightbox}>
        <DialogContent className="max-w-6xl p-2">
          <DialogTitle className="sr-only">
            {title} — ảnh {index + 1} trên {images.length}
          </DialogTitle>
          <div className="relative">
            <img
              src={images[index]}
              alt={`${title} — ảnh ${index + 1}`}
              className="max-h-[82vh] w-full object-contain"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
                  aria-label="Ảnh trước"
                  className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i + 1) % images.length)}
                  aria-label="Ảnh sau"
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs tabular-nums text-white">
                  {index + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
