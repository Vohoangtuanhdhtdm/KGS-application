import { Link } from "@tanstack/react-router";
import { Building2, ImageIcon } from "lucide-react";
import { formatListingPrice } from "@/lib/api/listings";
import type { PropertyMapPoint } from "./propertyMapShared";
import { TypeBadge } from "./MiniPropertyCard";

/**
 * Cửa sổ của viên giá gộp: các tin chung một vị trí (thường là các căn của một toà nhà).
 * Mỗi dòng một tin có ảnh nhỏ, tên căn, thông số và giá — rẻ nhất trước (xem groupPoints).
 */
export function MiniGroupCard({ points }: { points: PropertyMapPoint[] }) {
  const first = points[0];
  const place = [first.district, first.city].filter(Boolean).join(", ");
  return (
    <div className="w-[300px] text-popover-foreground">
      <div className="flex items-start gap-2.5 border-b px-3 pb-2.5 pt-3 pr-9">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">
            {points.length} tin tại cùng vị trí
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            từ{" "}
            <span className="font-semibold text-price">
              {formatListingPrice(first.price, first.type, first.rentPaymentCycle ?? null)}
            </span>
            {place && ` · ${place}`}
          </div>
        </div>
      </div>
      <ul className="max-h-[260px] space-y-0.5 overflow-y-auto p-1.5">
        {points.map((p) =>
          p.slug ? (
            <li key={p.id}>
              <Link
                to="/tin-dang/$slug"
                params={{ slug: p.slug }}
                className="flex items-center gap-2.5 rounded-md p-1.5 text-popover-foreground! transition-colors hover:bg-muted"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {p.thumbnailUrl ? (
                    <img
                      src={p.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium" title={p.title}>
                      {p.unitName ?? p.title}
                    </span>
                    {p.type !== first.type && <TypeBadge type={p.type} className="shrink-0" />}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[p.area != null && `${p.area} m²`, p.bedrooms != null && `${p.bedrooms} PN`]
                      .filter(Boolean)
                      .join(" · ") || (p.unitName ? p.title : "")}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs font-semibold text-price">
                  {formatListingPrice(p.price, p.type, p.rentPaymentCycle ?? null)}
                </div>
              </Link>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
