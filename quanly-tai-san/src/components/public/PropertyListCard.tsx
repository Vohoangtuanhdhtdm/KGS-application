import { forwardRef, memo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatListingPrice, type PublicListingSummaryDto } from "@/lib/api/listings";
import type { CompareItem } from "@/hooks/useCompareList";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AMENITIES, ASSET_TYPE, type AmenityKey } from "@/constants/enums";
import {
  Heart,
  MapPin,
  BedDouble,
  Bath,
  Ruler,
  ImageIcon,
  Scale,
  Check,
  Box,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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
  /** Tin này đã nằm trong danh sách đã lưu của người dùng chưa. */
  saved: boolean;
  /** Bật/tắt lưu tin. Cha xử lý đăng nhập và gọi API — xem chú thích ở nút trái tim. */
  onToggleSave: (id: string) => void;

  /* Bốn thuộc tính dưới đây chỉ trang tìm kiếm cần, vì ở đó thẻ phải đồng bộ với marker
     trên bản đồ. Trang chủ không có bản đồ nên để mặc định — trước đây trang chủ tự dựng
     một thẻ tin ĐỘC LẬP chỉ vì thẻ này bắt buộc bốn thuộc tính đó, và hậu quả là mọi cải
     tiến của thẻ (tổng chi phí, nút lưu, số thẳng hàng) không hề tới được trang chủ. */
  hovered?: boolean;
  highlighted?: boolean;
  // Nhận id làm tham số thay vì đóng gói closure — để cha truyền được callback ỔN ĐỊNH
  // (useCallback deps rỗng), giúp React.memo bên dưới thực sự chặn re-render thừa khi
  // hoveredId đổi (chỉ card liên quan tới id đó mới re-render, không phải toàn danh sách).
  onHover?: (id: string) => void;
  onLeave?: (id: string) => void;

  /* So sánh tin — tuỳ chọn: chỉ những trang có gắn CompareBar mới truyền, các nơi khác
     (ví dụ thẻ trong "Tin đã lưu") giữ nguyên không có nút này. */
  compareSelected?: boolean;
  /** true khi đã chọn đủ 3 tin và tin này KHÔNG nằm trong đó — vô hiệu nút để không hứa
      suông một thao tác sẽ bị hook âm thầm bỏ qua. */
  compareFull?: boolean;
  onToggleCompare?: (item: CompareItem) => void;
  /** "Vì sao hợp" — chỉ có khi tìm qua trợ lý (xem lib/matchReasons.ts). */
  reasons?: string[];
  /** "auto" (mặc định): ngang khi đủ rộng. "vertical": luôn dọc — cho dải giới thiệu như
   *  trang chủ, nơi các thẻ đứng cạnh nhau thành hàng. */
  layout?: "auto" | "vertical";
}

/**
 * Thẻ tin TỰ ĐỔI DÁNG theo chỗ nó được đặt (container query, không theo màn hình):
 *
 *   • hẹp (< 20rem — lưới nhiều cột, trang chủ): dọc, ảnh trên chữ dưới;
 *   • đủ rộng (cột danh sách cạnh bản đồ, danh sách toàn trang, khung dưới trên điện thoại):
 *     NGANG, ảnh trái chữ phải — đọc được tiêu đề hai dòng, thấy thông số và tiện nghi, và
 *     một màn hình chứa gấp đôi số tin so với thẻ dọc phóng to.
 *
 * Một component cho mọi nơi, nên mọi cải tiến của thẻ tới được mọi trang dùng nó.
 */
export const PropertyListCard = memo(
  forwardRef<HTMLDivElement, PropertyListCardProps>(function PropertyListCard(
    {
      property: p,
      hovered = false,
      highlighted = false,
      saved,
      onToggleSave,
      onHover,
      onLeave,
      compareSelected = false,
      reasons,
      compareFull = false,
      onToggleCompare,
      layout = "auto",
    },
    ref,
  ) {
    const row = layout === "auto";
    const distanceKm = p.distanceMeters != null ? p.distanceMeters / 1000 : null;
    const images = p.imageUrls?.length ? p.imageUrls : p.thumbnailUrl ? [p.thumbnailUrl] : [];
    const typeLabel = p.assetType ? ASSET_TYPE[p.assetType as keyof typeof ASSET_TYPE] : null;

    return (
      <div
        ref={ref}
        className="@container"
        onMouseEnter={() => onHover?.(p.id)}
        onMouseLeave={() => onLeave?.(p.id)}
      >
        <Link
          to="/tin-dang/$slug"
          params={{ slug: p.slug }}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Card
            className={`group flex h-full flex-col gap-0 overflow-hidden py-0 transition-[box-shadow,transform] duration-[--dur-base] ease-[--ease-out] ${
              row ? "@xs:flex-row" : ""
            } ${
              hovered ? "shadow-[--shadow-e3] -translate-y-0.5" : "shadow-none"
            } ${highlighted ? "ring-2 ring-primary" : ""}`}
          >
            <div
              className={`relative aspect-[4/3] shrink-0 bg-muted ${
                row ? "@xs:aspect-auto @xs:min-h-[168px] @xs:w-[40%] @lg:w-[34%]" : ""
              }`}
            >
              <ImageStrip images={images} total={p.imageCount ?? images.length} title={p.title} />
              {p.hasBuildingModel && (
                <span
                  className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-card/90 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur"
                  title="Toà nhà có mô hình 3D — xem từng tầng, căn nào còn trống"
                >
                  <Box className="h-3 w-3" /> 3D
                </span>
              )}
              {/* Nút thêm vào so sánh — đối xứng với nút lưu tin, nhưng ở góc trái để
                  không tranh chỗ. Chỉ hiện khi trang cha gắn CompareBar (truyền
                  onToggleCompare); im lặng biến mất ở những nơi chưa hỗ trợ so sánh
                  thay vì hiện một nút bấm-vào-không-làm-gì. */}
              {onToggleCompare && (
                <button
                  type="button"
                  aria-label={compareSelected ? "Bỏ khỏi so sánh" : "Thêm vào so sánh"}
                  aria-pressed={compareSelected}
                  disabled={!compareSelected && compareFull}
                  title={
                    !compareSelected && compareFull
                      ? "Đã chọn đủ 3 tin để so sánh"
                      : compareSelected
                        ? "Bỏ khỏi so sánh"
                        : "Thêm vào so sánh"
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleCompare({
                      id: p.id,
                      slug: p.slug,
                      type: p.type,
                      title: p.title,
                      thumbnailUrl: p.thumbnailUrl,
                    });
                  }}
                  className={`absolute top-2 left-2 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${
                    compareSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-card/90 text-muted-foreground hover:bg-card"
                  }`}
                >
                  <Scale className="h-4 w-4" />
                </button>
              )}
              {/* Nút lưu tin — cha gọi đúng API lưu tin, và đưa người chưa đăng nhập sang
                  trang đăng nhập (một nút chỉ đổi màu rồi mất khi tải lại là nút giả). */}
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

            <div className="flex min-w-0 flex-1 flex-col gap-1 p-3.5 @xs:px-4 @xs:py-3">
              {/* Loại hình + ngày đăng chung một dòng — dòng "Đăng … trước" riêng làm thẻ
                  ngang cao thêm một nấc mà không thêm thông tin quyết định. */}
              <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate font-medium uppercase tracking-wide">
                  {typeLabel}
                  {typeLabel && p.unitName ? ` · ${p.unitName}` : ""}
                </span>
                {p.publishedAt && (
                  <span className="shrink-0">
                    {postedAgoLabel(p.publishedAt).replace("Đăng ", "")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {formatListingPrice(p.price, p.type, p.rentPaymentCycle)}
                </span>
                {/* Tổng chi phí hàng tháng — luận điểm cốt lõi của sản phẩm. Chỉ hiện khi
                    LỚN HƠN giá thuê: bằng nhau nghĩa là tin chưa khai phí nào. */}
                {p.type === 2 && p.totalMonthlyCost > p.price && (
                  <span className="rounded bg-price-soft px-1.5 py-0.5 text-xs font-medium tabular-nums text-price">
                    Tổng {formatFullVnd(p.totalMonthlyCost)}/tháng
                  </span>
                )}
              </div>
              <div className="line-clamp-2 font-medium leading-snug">{p.title}</div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {[p.district, p.city].filter(Boolean).join(", ")}
                  {distanceKm != null && ` · ${distanceKm.toFixed(1)}km`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
                {p.area != null && (
                  <Spec icon={<Ruler className="h-3.5 w-3.5" />}>{p.area} m²</Spec>
                )}
                {p.bedrooms != null && (
                  <Spec icon={<BedDouble className="h-3.5 w-3.5" />}>{p.bedrooms} PN</Spec>
                )}
                {p.bathrooms != null && (
                  <Spec icon={<Bath className="h-3.5 w-3.5" />}>{p.bathrooms} WC</Spec>
                )}
              </div>
              {/* Tiện nghi chỉ hiện khi thẻ đủ rộng — ở thẻ dọc hẹp nó đẩy thẻ cao lên mà
                  không ai đọc kịp. */}
              {p.amenities.length > 0 && (
                <div
                  className={`hidden truncate text-xs text-muted-foreground ${row ? "@md:block" : ""}`}
                >
                  {p.amenities
                    .slice(0, 4)
                    .map((a) => AMENITIES[a as AmenityKey] ?? a)
                    .join(" · ")}
                  {p.amenities.length > 4 && ` · +${p.amenities.length - 4}`}
                </div>
              )}
              {reasons && reasons.length > 0 && (
                <ul className="space-y-0.5 pt-1" aria-label="Vì sao hợp với nhu cầu của bạn">
                  {reasons.map((r) => (
                    <li key={r} className="flex items-start gap-1 text-xs text-success">
                      <Check className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="text-foreground/80">{r}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </Link>
      </div>
    );
  }),
);

function Spec({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
      {icon}
      <span className="font-medium text-foreground/80">{children}</span>
    </span>
  );
}

/**
 * Lướt ảnh ngay trên thẻ: mũi tên hiện khi rê chuột (luôn hiện trên màn cảm ứng), chấm chỉ
 * vị trí. Chỉ dựng ảnh đang xem — năm ảnh cho mỗi thẻ trong danh sách 20 tin là 100 ảnh tải
 * cùng lúc, không đáng.
 */
function ImageStrip({ images, total, title }: { images: string[]; total: number; title: string }) {
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  if (images.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
      </div>
    );
  }
  const go = (e: React.MouseEvent, d: number) => {
    e.preventDefault();
    e.stopPropagation();
    setI((v) => (v + d + images.length) % images.length);
  };
  return (
    <>
      {!loaded[i] && <Skeleton className="absolute inset-0 rounded-none" />}
      <img
        key={images[i]}
        src={images[i]}
        alt={`${title} — ảnh ${i + 1}`}
        loading="lazy"
        onLoad={() => setLoaded((m) => ({ ...m, [i]: true }))}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
          loaded[i] ? "opacity-100" : "opacity-0"
        }`}
      />
      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Ảnh trước"
            onClick={(e) => go(e, -1)}
            className="absolute left-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 shadow-sm transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Ảnh sau"
            onClick={(e) => go(e, 1)}
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 shadow-sm transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div
            className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1"
            aria-hidden="true"
          >
            {images.map((_, k) => (
              <span
                key={k}
                className={`h-1.5 w-1.5 rounded-full ${k === i ? "bg-white" : "bg-white/55"}`}
              />
            ))}
          </div>
        </>
      )}
      {total > 1 && (
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[11px] tabular-nums text-white">
          <ImageIcon className="h-3 w-3" /> {total}
        </span>
      )}
      {/* Tải trước ảnh kế để bấm "sau" không phải chờ. */}
      {images.length > 1 && (
        <link rel="prefetch" href={images[(i + 1) % images.length]} as="image" />
      )}
    </>
  );
}
