import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listingsApi, formatListingPrice } from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { PublicHeader } from "@/components/public/PublicHeader";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { inquiriesApi, savedListingsApi } from "@/lib/api/engagement";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogDescription, DialogFooter, DialogHeader } from "@/components/ui/dialog";

export const Route = createFileRoute("/tin-dang/$slug")({
  head: () => ({ meta: [{ title: "Chi tiết tin đăng — Marketplace" }] }),
  component: PublicListingDetailPage,
});

function PublicListingDetailPage() {
  const { slug } = Route.useParams();
  const query = useQuery({
    queryKey: ["public-listing", slug],
    queryFn: () => listingsApi.detail(slug),
    retry: 1,
  });

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
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tin-dang">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Về danh sách
          </Link>
        </Button>

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
              <h1 className="text-2xl font-semibold">{p.title}</h1>
              <div className="text-2xl font-semibold text-primary">
                {formatListingPrice(p.price, p.type, p.rentPaymentCycle)}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" />
                {address || "—"}
              </p>
            </div>

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
          </div>

          {/* Card liên hệ — sticky bên phải desktop */}
          <div className="hidden lg:block sticky top-20">
            <ContactCard ownerName={p.ownerName} ownerPhone={p.ownerPhone} onCopy={copyPhone}>
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
          <Button variant="outline" size="icon" onClick={copyPhone} aria-label="Sao chép số">
            <Copy className="h-4 w-4" />
          </Button>
          <Button asChild>
            <a href={`tel:${p.ownerPhone}`}>
              <Phone className="h-4 w-4 mr-1.5" />
              Gọi {p.ownerPhone}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContactCard({
  ownerName,
  ownerPhone,
  onCopy,
  children,
}: {
  ownerName: string;
  ownerPhone: string;
  onCopy: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div>
          <div className="text-xs text-muted-foreground">Chủ tài sản</div>
          <div className="text-lg font-semibold mt-0.5">{ownerName}</div>
        </div>
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

function Gallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (images.length === 0) {
    return (
      <div className="h-80 rounded-lg bg-muted flex items-center justify-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
      </div>
    );
  }

  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  return (
    <div className="space-y-2">
      <div className="relative h-80 rounded-lg overflow-hidden bg-muted">
        <img
          src={images[index]}
          alt={`${title} — ảnh ${index + 1}`}
          className="w-full h-full object-cover cursor-zoom-in"
          onClick={() => setLightbox(true)}
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
              onClick={prev}
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
              onClick={next}
              aria-label="Ảnh sau"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
              {index + 1}/{images.length}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              className={`h-16 w-24 shrink-0 rounded-md overflow-hidden border-2 ${
                i === index ? "border-primary" : "border-transparent opacity-70"
              }`}
              onClick={() => setIndex(i)}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={lightbox} onOpenChange={setLightbox}>
        <DialogContent className="max-w-5xl p-2">
          <DialogTitle className="sr-only">Ảnh phóng to</DialogTitle>
          <img
            src={images[index]}
            alt={`${title} — phóng to`}
            className="max-h-[80vh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
