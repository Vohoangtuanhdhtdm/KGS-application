import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listingsApi, formatListingPrice, type PublicListingDetailDto } from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { formatCurrency, formatDate } from "@/lib/format";
import { AMENITIES, WATER_PRICING, type AmenityKey } from "@/constants/enums";
import { PublicHeader } from "@/components/public/PublicHeader";
import { BackButton } from "@/components/public/BackButton";
import { ListingShareActions } from "@/components/public/ListingShareActions";
import { RelatedListings } from "@/components/public/RelatedListings";
import { MarketTrendCard } from "@/components/public/MarketTrendCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListingLocationMap } from "@/components/listings/ListingLocationMap";
import { ListingBuilding3D } from "@/components/building/ListingBuilding3D";
import { KeyFacts } from "@/components/listing-detail/KeyFacts";
import { SectionNav, type SectionLink } from "@/components/listing-detail/SectionNav";
import { AmenityGrid } from "@/components/listing-detail/AmenityGrid";
import { ExpandableText } from "@/components/listing-detail/ExpandableText";
import { buildingModelApi } from "@/lib/api/buildingModel";
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
  Box,
  MessageCircleReply,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { inquiriesApi, savedListingsApi } from "@/lib/api/engagement";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogDescription, DialogFooter, DialogHeader } from "@/components/ui/dialog";

export const Route = createFileRoute("/tin-dang/$slug")({
  // ?xem3d=1 — mở sẵn hộp thoại toà nhà 3D (đi tới từ khối toà nhà trên bản đồ tìm kiếm).
  validateSearch: (s: Record<string, unknown>): { xem3d?: 1 } =>
    s.xem3d === 1 || s.xem3d === "1" ? { xem3d: 1 } : {},
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
  const autoOpen3D = Route.useSearch().xem3d === 1;

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
  // Cùng khoá truy vấn với ListingBuilding3D nên chỉ một lượt gọi — dùng để gắn nhãn "Xem
  // được 3D" ngay cạnh tiêu đề.
  const buildingQ = useQuery({
    queryKey: ["listing-building", slug],
    queryFn: () => buildingModelApi.forListing(slug),
    staleTime: 60_000,
    retry: 0,
  });
  const building = buildingQ.data ?? null;

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
  // Địa chỉ sau sắp xếp 2025 (bỏ cấp quận): "123 Nguyễn Văn Linh, Phường Tân Hưng, TP.HCM".
  const newAddress = p.newWard
    ? [p.addressDetail, p.newWard, p.newProvince].filter(Boolean).join(", ")
    : null;

  const copyPhone = async () => {
    if (!p.ownerPhone) return;
    try {
      await navigator.clipboard.writeText(p.ownerPhone);
      toast.success("Đã sao chép số điện thoại");
    } catch {
      toast.error("Không sao chép được — hãy copy thủ công.");
    }
  };

  const hasMap = p.latitude != null && p.longitude != null;
  const sections: SectionLink[] = [
    { id: "tong-quan", label: "Tổng quan" },
    ...(p.type === 2 ? [{ id: "chi-phi", label: "Chi phí & điều kiện" }] : []),
    ...(p.amenities.length > 0 ? [{ id: "tien-nghi", label: "Tiện nghi" }] : []),
    ...(hasMap
      ? [
          { id: "vi-tri", label: "Vị trí" },
          { id: "toa-nha-3d", label: building ? "Toà nhà 3D" : "Xem 3D" },
        ]
      : []),
    { id: "thi-truong", label: "Giá khu vực" },
  ];

  const compareItem = {
    id: p.id,
    slug: p.slug,
    type: p.type,
    title: p.title,
    thumbnailUrl: p.imageUrls[0] ?? null,
  };

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-10">
      <PublicHeader />
      <div className="mx-auto max-w-[1200px] space-y-5 px-4 pt-4 lg:px-6">
        {/* Dòng điều hướng + chia sẻ/so sánh/báo sai — tách khỏi khối giá để khối giá chỉ còn
            đúng việc của nó. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav
            aria-label="Đường dẫn"
            className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
          >
            <BackButton />
            <span className="hidden truncate sm:inline">
              {p.type === 1 ? "Bán" : "Cho thuê"} · {p.assetTypeLabel} · {p.district}
            </span>
          </nav>
          <ListingShareActions slug={p.slug} title={p.title} compareItem={compareItem} />
        </div>

        {/* Ảnh tràn cả bề ngang nội dung — ảnh là thứ quyết định người ta đọc tiếp hay đóng tab. */}
        <Gallery images={p.imageUrls} title={p.title} />

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            {/* ---- Tiêu đề: thứ đầu tiên đọc sau ảnh ---- */}
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{p.type === 1 ? "Bán" : "Cho thuê"}</Badge>
                <Badge variant="outline">{p.assetTypeLabel}</Badge>
                {p.unitName && <Badge variant="outline">{p.unitName}</Badge>}
                {building && (
                  <a href="#toa-nha-3d">
                    <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                      <Box className="h-3 w-3" /> Xem được 3D
                    </Badge>
                  </a>
                )}
                <span className="text-xs text-muted-foreground">
                  Đăng {formatDate(p.publishedAt)} · {p.viewCount} lượt xem
                </span>
              </div>
              <h1 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
                {p.title}
              </h1>
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {newAddress ?? (address || "—")}
                  {hasMap && (
                    <a href="#vi-tri" className="ml-2 font-medium text-primary hover:underline">
                      Xem bản đồ
                    </a>
                  )}
                  {newAddress && (
                    <span className="mt-0.5 block text-xs">
                      {p.newAddressApprox ? "Phường mới ước đoán · " : ""}Địa chỉ cũ: {address}
                      {p.newWardCode && (
                        <Link
                          to="/tin-dang"
                          search={{ phuong: p.newWardCode, type: p.type }}
                          className="ml-2 font-medium text-primary hover:underline"
                        >
                          Tin khác ở {p.newWard}
                        </Link>
                      )}
                    </span>
                  )}
                </span>
              </p>
              {/* Giá trên điện thoại — trên máy tính giá nằm ở thẻ quyết định bên phải. */}
              <div className="lg:hidden">
                <PriceBlock listing={p} />
              </div>
            </header>

            <KeyFacts listing={p} />

            <SectionNav sections={sections} />

            <Section id="tong-quan" title="Giới thiệu">
              {p.description ? (
                <ExpandableText text={p.description} />
              ) : (
                <p className="text-sm text-muted-foreground">Người đăng chưa viết mô tả.</p>
              )}
            </Section>

            {p.type === 2 && (
              <Section id="chi-phi" title="Chi phí & điều kiện thuê">
                <TermsCard listing={p} />
              </Section>
            )}

            {p.amenities.length > 0 && (
              <Section id="tien-nghi" title="Tiện nghi">
                <AmenityGrid amenities={p.amenities} />
              </Section>
            )}

            {hasMap && (
              <>
                <Section id="vi-tri" title="Vị trí & đi lại">
                  <ListingLocationMap
                    listingId={p.id}
                    title={p.title}
                    lat={p.latitude!}
                    lng={p.longitude!}
                  />
                </Section>
                <section id="toa-nha-3d" className="scroll-mt-28">
                  <ListingBuilding3D
                    slug={p.slug}
                    lat={p.latitude!}
                    lng={p.longitude!}
                    houseDirection={p.houseDirection}
                    autoOpen={autoOpen3D}
                  />
                </section>
              </>
            )}

            <section id="thi-truong" className="scroll-mt-28">
              <MarketTrendCard city={p.city} district={p.district} />
            </section>
          </div>

          {/* ---- Thẻ quyết định: dính theo khi cuộn (máy tính) ---- */}
          <aside className="hidden lg:sticky lg:top-20 lg:block">
            <DecisionCard listing={p} onCopy={copyPhone} />
          </aside>
        </div>

        <div className="border-t pt-8">
          <RelatedListings slug={p.slug} ownerName={p.ownerName} ownerId={p.ownerId} />
        </div>
      </div>

      {/* ---- Điện thoại: giá + hành động luôn trong tầm tay ---- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {/* Dạng gọn ("4,7 triệu/tháng"): thanh đáy hẹp, giá đầy đủ đã có ở đầu trang. */}
            <div className="truncate text-base font-bold tabular-nums text-price">
              {formatCurrency(p.price, { compact: true })}
              {p.type === 2 && <span className="text-sm font-medium">/tháng</span>}
            </div>
            <div className="truncate text-xs text-muted-foreground">{p.ownerName}</div>
          </div>
          <EngagementActions listingId={p.id} slug={p.slug} variant="bar" />
          {p.ownerPhone && (
            <Button asChild>
              <a href={`tel:${p.ownerPhone}`}>
                <Phone className="mr-1.5 h-4 w-4" />
                Gọi
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Một mục của trang chi tiết: tiêu đề + nội dung, ngăn cách bằng đường kẻ thay vì thẻ —
 *  tám thẻ xếp chồng làm trang trông như một biểu mẫu. */
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-4 border-t pt-6 first-of-type:border-t-0">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Giá + những con số đi kèm giúp so sánh: tổng chi phí cố định (thuê), giá/m² (bán). */
function PriceBlock({ listing: p }: { listing: PublicListingDetailDto }) {
  const perM2 = p.type === 1 && p.area ? p.price / p.area : null;
  const extra = p.type === 2 && p.totalMonthlyCost > p.price;
  return (
    <div className="space-y-1">
      <div className="text-3xl font-bold leading-none tabular-nums text-price">
        {formatListingPrice(p.price, p.type, p.rentPaymentCycle)}
      </div>
      {extra && (
        <div className="text-sm">
          Tổng cố định{" "}
          <span className="font-semibold tabular-nums">{formatCurrency(p.totalMonthlyCost)}</span>
          <span className="text-muted-foreground">/tháng</span>
        </div>
      )}
      {perM2 != null && (
        <div className="text-sm text-muted-foreground">
          ≈ {formatCurrency(perM2, { compact: true })}/m²
        </div>
      )}
      {p.type === 2 && p.terms.depositMonths != null && (
        <div className="text-sm text-muted-foreground">Cọc {p.terms.depositMonths} tháng</div>
      )}
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

function responseLabel(p: PublicListingDetailDto): string | null {
  const received = p.ownerInquiriesReceived ?? 0;
  if (received === 0) return null;
  const answered = p.ownerInquiriesAnswered ?? 0;
  const h = p.ownerMedianResponseHours;
  const time =
    h == null
      ? ""
      : h < 1
        ? " · thường trong 1 giờ"
        : h < 24
          ? ` · thường trong ~${Math.round(h)} giờ`
          : ` · thường trong ~${Math.round(h / 24)} ngày`;
  return `Đã trả lời ${answered}/${received} yêu cầu${time}`;
}

/**
 * Thẻ quyết định bên phải: giá → hành động → người đăng.
 *
 * Hồ sơ người đăng nằm ngay đây vì người tìm nhà quyết định có nhấc máy hay không dựa trên
 * việc họ tin ai ở đầu dây bên kia — "tham gia 8 tháng, 5 tin, thường trả lời trong 3 giờ"
 * nói được điều đó, và cũng làm tài khoản mở hôm qua để đăng tin ma dễ nhận ra.
 */
function DecisionCard({
  listing: p,
  onCopy,
}: {
  listing: PublicListingDetailDto;
  onCopy: () => void;
}) {
  const reply = responseLabel(p);
  return (
    <Card className="shadow-[--shadow-e2]">
      <CardContent className="space-y-4 p-5">
        <PriceBlock listing={p} />

        {/* Không có số thì KHÔNG dựng nút "Gọi": nút gọi bấm vào không quay được số còn tệ
            hơn là không có nút. */}
        <div className="space-y-2">
          {p.ownerPhone ? (
            <div className="flex gap-2">
              <Button className="h-11 flex-1 text-base" asChild>
                <a href={`tel:${p.ownerPhone}`}>
                  <Phone className="mr-2 h-4.5 w-4.5" />
                  {p.ownerPhone}
                </a>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11"
                onClick={onCopy}
                aria-label="Sao chép số"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
              Người đăng chưa để lại số điện thoại. Hãy gửi yêu cầu xem nhà — họ nhận được thông tin
              liên hệ của bạn.
            </p>
          )}
          <EngagementActions listingId={p.id} slug={p.slug} />
        </div>

        <div className="flex items-center gap-3 border-t pt-4">
          <Avatar className="h-11 w-11">
            {p.ownerAvatarUrl && <AvatarImage src={p.ownerAvatarUrl} alt={p.ownerName} />}
            <AvatarFallback>{p.ownerName.trim().charAt(0).toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            {p.ownerId ? (
              <Link
                to="/nguoi-dang/$id"
                params={{ id: p.ownerId }}
                className="block truncate font-semibold hover:underline"
              >
                {p.ownerName}
              </Link>
            ) : (
              <div className="truncate font-semibold">{p.ownerName}</div>
            )}
            <div className="text-xs text-muted-foreground">
              {membershipLabel(p.ownerJoinedAt)} · {p.ownerActiveListingCount} tin đang đăng
            </div>
          </div>
        </div>
        {reply && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageCircleReply className="h-3.5 w-3.5 shrink-0" /> {reply}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Hai hành động của phía CẦU: lưu tin để xem lại, và gửi yêu cầu xem nhà.
 * Đây là chỗ marketplace nối vào nghiệp vụ — yêu cầu gửi từ đây sẽ xuất hiện trong
 * hộp thư của chủ nhà, nơi họ chuyển thành đối tác rồi ký hợp đồng.
 */
function EngagementActions({
  listingId,
  slug,
  variant = "card",
}: {
  listingId: string;
  slug: string;
  /** "bar": chỉ nút "Xem nhà" — cho thanh dưới cùng trên điện thoại. */
  variant?: "card" | "bar";
}) {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [viewingAt, setViewingAt] = useState("");

  const save = useMutation({
    mutationFn: () =>
      saved ? savedListingsApi.unsave(listingId) : savedListingsApi.save(listingId),
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
    if (variant === "bar")
      return (
        <Button variant="outline" asChild>
          <Link to="/login">Xem nhà</Link>
        </Button>
      );
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
      {variant === "bar" ? (
        <Button variant="outline" onClick={() => setAskOpen(true)}>
          <Send className="mr-1.5 h-4 w-4" />
          Xem nhà
        </Button>
      ) : (
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
      )}

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
    khoanCoDinh.length > 0 ||
    theoMucDung.length > 0 ||
    dieuKienHien.length > 0 ||
    shownRules.length > 0;

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
              {theoMucDung.join(" · ")} — hai khoản này tính theo mức dùng nên không cộng thành một
              con số cố định được.
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
      <div className="flex aspect-[21/9] items-center justify-center rounded-xl bg-muted">
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
        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted sm:aspect-[21/9]">
          {anhLon}
        </div>
      ) : (
        // Khung 2:1 trên màn rộng (4:3 trên điện thoại): ảnh đủ lớn để thuyết phục mà không đẩy
        // tiêu đề, giá và thông số xuống quá nửa màn hình đầu.
        <div className="relative grid aspect-[4/3] grid-cols-2 gap-2 sm:aspect-[2/1]">
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
