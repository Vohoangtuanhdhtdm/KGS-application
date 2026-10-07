import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bath, BedDouble, ImageIcon, MapPin, Ruler } from "lucide-react";
import { LISTING_TYPE } from "@/constants/enums";
import { formatListingPrice } from "@/lib/api/listings";
import type { PropertyMapPoint } from "./propertyMapShared";

/** Nhãn loại tin dùng chung màu với viên giá trên bản đồ (xem .kgs-type-badge ở styles.css). */
export function TypeBadge({ type, className = "" }: { type: 1 | 2; className?: string }) {
  return (
    <span
      className={`kgs-type-badge ${type === 2 ? "kgs-type-badge--rent" : "kgs-type-badge--sale"} ${className}`}
    >
      {LISTING_TYPE[type]}
    </span>
  );
}

function Spec({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      {icon}
      {children}
    </span>
  );
}

/**
 * Màu chữ của các link trong thẻ đánh dấu `!`: bản Leaflet tô mọi link trong bản đồ màu xanh
 * (.leaflet-container a) với độ ưu tiên cao hơn lớp tiện ích thường.
 *
 * Thẻ xem nhanh khi bấm một viên giá: ảnh lớn, giá, tên, thông số và nút xem chi tiết —
 * đủ để quyết định có mở tin hay không mà không phải rời bản đồ.
 */
export function MiniPropertyCard({ point }: { point: PropertyMapPoint }) {
  const specs = [
    point.area != null && (
      <Spec key="area" icon={<Ruler className="h-3.5 w-3.5" />}>
        {point.area} m²
      </Spec>
    ),
    point.bedrooms != null && (
      <Spec key="bed" icon={<BedDouble className="h-3.5 w-3.5" />}>
        {point.bedrooms} PN
      </Spec>
    ),
    point.bathrooms != null && (
      <Spec key="bath" icon={<Bath className="h-3.5 w-3.5" />}>
        {point.bathrooms} WC
      </Spec>
    ),
  ].filter(Boolean);
  const place = [point.district, point.city].filter(Boolean).join(", ");

  return (
    <div className="w-[260px] text-popover-foreground">
      <Link
        to="/tin-dang/$slug"
        params={{ slug: point.slug! }}
        className="group relative block aspect-[16/10] overflow-hidden bg-muted"
        tabIndex={-1}
      >
        {point.thumbnailUrl ? (
          <img
            src={point.thumbnailUrl}
            alt={point.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        <TypeBadge type={point.type} className="absolute left-2 top-2" />
      </Link>

      <div className="space-y-1.5 p-3">
        <div className="text-base font-bold leading-tight text-price">
          {formatListingPrice(point.price, point.type, point.rentPaymentCycle ?? null)}
        </div>
        <Link
          to="/tin-dang/$slug"
          params={{ slug: point.slug! }}
          className="line-clamp-2 text-[13px] font-medium leading-snug text-popover-foreground! hover:text-primary!"
          title={point.title}
        >
          {point.unitName && <span className="font-semibold">{point.unitName} · </span>}
          {point.title}
        </Link>
        {specs.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {specs}
          </div>
        )}
        {place && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{place}</span>
          </div>
        )}
        <Link
          to="/tin-dang/$slug"
          params={{ slug: point.slug! }}
          className="mt-2.5! flex h-8 items-center justify-center gap-1 rounded-md bg-primary text-xs font-semibold text-primary-foreground! transition-colors hover:bg-primary/90"
        >
          Xem chi tiết <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
