import { forwardRef, memo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatListingPrice, type PublicPropertySummaryDto } from "@/lib/api/properties";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MapPin, BedDouble, Bath, Ruler, ImageIcon, CheckCircle2 } from "lucide-react";

/** "Đăng 2 ngày trước" — chỉ hiện khi có createdAt (field còn cần backend xác nhận). */
function postedAgoLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Đăng hôm nay";
  if (days === 1) return "Đăng 1 ngày trước";
  if (days < 30) return `Đăng ${days} ngày trước`;
  const months = Math.floor(days / 30);
  return `Đăng ${months} tháng trước`;
}

interface PropertyListCardProps {
  property: PublicPropertySummaryDto;
  hovered: boolean;
  highlighted: boolean;
  // Nhận id làm tham số thay vì đóng gói closure — để cha truyền được callback ỔN ĐỊNH
  // (useCallback deps rỗng), giúp React.memo bên dưới thực sự chặn re-render thừa khi
  // hoveredId đổi (chỉ card liên quan tới id đó mới re-render, không phải toàn danh sách).
  onHover: (id: string) => void;
  onLeave: (id: string) => void;
}

export const PropertyListCard = memo(
  forwardRef<HTMLDivElement, PropertyListCardProps>(function PropertyListCard(
    { property: p, hovered, highlighted, onHover, onLeave },
    ref,
  ) {
    const [favorited, setFavorited] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    const distanceKm = p.distanceMeters != null ? p.distanceMeters / 1000 : null;

    return (
      <div ref={ref} onMouseEnter={() => onHover(p.id)} onMouseLeave={() => onLeave(p.id)}>
        <Link
          to="/tin-dang/$slug"
          params={{ slug: p.slug }}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Card
            className={`overflow-hidden py-0 gap-0 h-full transition-all duration-150 ${
              hovered ? "shadow-lg -translate-y-0.5" : "shadow-sm"
            } ${highlighted ? "ring-2 ring-primary" : ""}`}
          >
            <div className="relative aspect-[4/3] bg-muted">
              {p.thumbnailUrl ? (
                <>
                  {/* Placeholder xám trong lúc ảnh tải, tránh giật layout */}
                  {!imgLoaded && <Skeleton className="absolute inset-0 rounded-none" />}
                  <img
                    src={p.thumbnailUrl}
                    alt={p.title}
                    loading="lazy"
                    onLoad={() => setImgLoaded(true)}
                    className={`w-full h-full object-cover transition-opacity duration-200 ${
                      imgLoaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
              <button
                type="button"
                aria-label={favorited ? "Bỏ yêu thích" : "Yêu thích"}
                aria-pressed={favorited}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFavorited((f) => !f);
                }}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {/* key đổi theo favorited → remount → animation heart-pop tự chạy lại mỗi lần bấm */}
                <Heart
                  key={favorited ? "on" : "off"}
                  className={`h-4 w-4 animate-heart-pop ${
                    favorited ? "fill-destructive text-destructive" : "text-muted-foreground"
                  }`}
                />
              </button>
              <Badge className="absolute top-2 left-2 bg-success/90 hover:bg-success/90 text-success-foreground gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Đã duyệt
              </Badge>
            </div>
            <div className="p-4 space-y-1.5">
              <div className="text-lg font-bold text-foreground">
                {formatListingPrice(p.price, p.type, p.rentPaymentCycle)}
              </div>
              <div className="font-medium line-clamp-1">{p.title}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {[p.district, p.city].filter(Boolean).join(", ")}
                  {distanceKm != null && ` · ${distanceKm.toFixed(1)}km`}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                {p.bedrooms != null && (
                  <span className="flex items-center gap-1">
                    <BedDouble className="h-3.5 w-3.5" />
                    {p.bedrooms} PN
                  </span>
                )}
                {p.bathrooms != null && (
                  <span className="flex items-center gap-1">
                    <Bath className="h-3.5 w-3.5" />
                    {p.bathrooms} WC
                  </span>
                )}
                {p.area != null && (
                  <span className="flex items-center gap-1">
                    <Ruler className="h-3.5 w-3.5" />
                    {p.area}m²
                  </span>
                )}
              </div>
              {p.createdAt && (
                <div className="text-xs text-muted-foreground/80 pt-0.5">
                  {postedAgoLabel(p.createdAt)}
                </div>
              )}
            </div>
          </Card>
        </Link>
      </div>
    );
  }),
);
