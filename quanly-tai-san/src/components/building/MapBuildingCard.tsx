import { Link } from "@tanstack/react-router";
import { ArrowRight, Box } from "lucide-react";
import { formatListingPrice } from "@/lib/api/listings";
import type { MapBuilding } from "@/lib/api/buildingModel";

/** Cửa sổ khi bấm vào khối toà nhà 3D trên bản đồ tìm kiếm: toà nhà còn bao nhiêu căn trống,
 *  vài tin rẻ nhất, và lối vào khám phá Toà nhà → Tầng → Căn. */
export function MapBuildingCard({ b }: { b: MapBuilding }) {
  const first = b.listings[0];
  return (
    <div className="space-y-2 text-sm">
      <div>
        <div className="flex items-center gap-1 font-semibold">
          <Box className="h-3.5 w-3.5 shrink-0" /> {b.address}
        </div>
        <div className="text-xs text-muted-foreground">
          {b.floors} tầng
          {b.unitCount > 0 && ` · ${b.vacantCount}/${b.unitCount} căn trống`} · {b.listingCount} tin
        </div>
      </div>
      <ul className="space-y-1">
        {b.listings.map((l) => (
          <li key={l.slug}>
            <Link
              to="/tin-dang/$slug"
              params={{ slug: l.slug }}
              className="flex items-baseline justify-between gap-2 rounded px-1 py-0.5 hover:bg-muted"
            >
              <span className="truncate">{l.unitName ?? l.title}</span>
              <span className="shrink-0 text-xs font-semibold text-price">
                {formatListingPrice(l.price, l.type, l.rentPaymentCycle)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {b.listingCount > b.listings.length && (
        <div className="text-xs text-muted-foreground">
          và {b.listingCount - b.listings.length} tin khác trong toà nhà
        </div>
      )}
      {first && (
        <Link
          to="/tin-dang/$slug"
          params={{ slug: first.slug }}
          search={{ xem3d: 1 }}
          className="flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Xem toà nhà 3D <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
