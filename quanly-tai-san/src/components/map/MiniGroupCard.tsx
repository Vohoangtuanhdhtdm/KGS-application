import { Link } from "@tanstack/react-router";
import { formatListingPrice } from "@/lib/api/listings";
import type { PropertyMapPoint } from "./propertyMapShared";

/** Cửa sổ của viên giá gộp: các tin chung một vị trí (thường là các căn của một toà nhà). */
export function MiniGroupCard({ points }: { points: PropertyMapPoint[] }) {
  return (
    <div style={{ width: 210 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
        {points.length} tin tại cùng vị trí
      </div>
      <ul style={{ maxHeight: 220, overflowY: "auto", margin: 0, padding: 0, listStyle: "none" }}>
        {points.map((p) =>
          p.slug ? (
            <li key={p.id}>
              <Link
                to="/tin-dang/$slug"
                params={{ slug: p.slug }}
                className="flex items-baseline justify-between gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted"
              >
                <span className="truncate" title={p.title}>
                  {p.unitName ?? p.title}
                </span>
                <span className="shrink-0 font-semibold text-price">
                  {formatListingPrice(p.price, p.type, p.rentPaymentCycle ?? null)}
                </span>
              </Link>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
