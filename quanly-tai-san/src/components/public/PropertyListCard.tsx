import { forwardRef, memo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatListingPrice, type PublicListingSummaryDto } from "@/lib/api/listings";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MapPin, BedDouble, Bath, Ruler, ImageIcon } from "lucide-react";

/**
 * Tổng chi phí viết ĐỦ SỐ, không rút gọn.
 *
 * Bản đầu tôi rút gọn thành "8,0 tr" cho vừa thẻ. Nhưng tin có giá thuê 7.900.000 và tổng
 * 7.950.000 sẽ hiện thành "Tổng 8,0 tr" — nói quá 50.000đ, và đứng ngay cạnh con số
 * 7.900.000 thì người đọc tưởng phí cộng thêm tới cả trăm nghìn. Cả sản phẩm này dựng lên
 * quanh lời hứa minh bạch chi phí, nên đúng chỗ này là chỗ không được phép làm tròn.
 */
function formatFullVnd(v: number): string {
  return `${Math.round(v).toLocaleString("vi-VN")} ₫`;
}

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
  property: PublicListingSummaryDto;
  hovered: boolean;
  highlighted: boolean;
  /** Tin này đã nằm trong danh sách đã lưu của người dùng chưa. */
  saved: boolean;
  /** Bật/tắt lưu tin. Cha xử lý đăng nhập và gọi API — xem chú thích ở nút trái tim. */
  onToggleSave: (id: string) => void;
  // Nhận id làm tham số thay vì đóng gói closure — để cha truyền được callback ỔN ĐỊNH
  // (useCallback deps rỗng), giúp React.memo bên dưới thực sự chặn re-render thừa khi
  // hoveredId đổi (chỉ card liên quan tới id đó mới re-render, không phải toàn danh sách).
  onHover: (id: string) => void;
  onLeave: (id: string) => void;
}

export const PropertyListCard = memo(
  forwardRef<HTMLDivElement, PropertyListCardProps>(function PropertyListCard(
    { property: p, hovered, highlighted, saved, onToggleSave, onHover, onLeave },
    ref,
  ) {
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
            className={`overflow-hidden py-0 gap-0 h-full transition-[box-shadow,transform] duration-[--dur-base] ease-[--ease-out] ${
              hovered ? "shadow-[--shadow-e3] -translate-y-0.5" : "shadow-none"
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
              {/* Nút lưu tin.
                  Trước đây nút này chỉ đổi một biến useState trong chính thẻ — nó sáng lên
                  khi bấm rồi mất sạch khi tải lại trang, và không bao giờ xuất hiện ở mục
                  "Tin đã lưu". Một nút giả vờ chạy còn tệ hơn không có nút. Nay cha gọi
                  đúng API lưu tin, và đưa người chưa đăng nhập sang trang đăng nhập. */}
              <button
                type="button"
                aria-label={saved ? "Bỏ lưu tin" : "Lưu tin"}
                aria-pressed={saved}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleSave(p.id);
                }}
                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 backdrop-blur transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {/* key đổi theo trạng thái → remount → animation heart-pop chạy lại mỗi lần bấm */}
                <Heart
                  key={saved ? "on" : "off"}
                  className={`h-4 w-4 animate-heart-pop ${
                    saved ? "fill-destructive text-destructive" : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>
            <div className="p-4 space-y-1.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {formatListingPrice(p.price, p.type, p.rentPaymentCycle)}
                </span>
                {/* Tổng chi phí hàng tháng — luận điểm cốt lõi của sản phẩm, và nó đã nằm
                    sẵn trong dữ liệu trả về từ trước mà thẻ không hề dùng tới. Chỉ hiện khi
                    LỚN HƠN giá thuê: bằng nhau nghĩa là tin chưa khai phí nào, lúc đó lặp
                    lại con số cũ chỉ làm thẻ rối mà không thêm thông tin. */}
                {p.type === 2 && p.totalMonthlyCost > p.price && (
                  <span className="rounded bg-price-soft px-1.5 py-0.5 text-xs font-medium tabular-nums text-price">
                    Tổng {formatFullVnd(p.totalMonthlyCost)}/tháng
                  </span>
                )}
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
              {p.publishedAt && (
                <div className="text-xs text-muted-foreground/80 pt-0.5">
                  {postedAgoLabel(p.publishedAt)}
                </div>
              )}
            </div>
          </Card>
        </Link>
      </div>
    );
  }),
);
