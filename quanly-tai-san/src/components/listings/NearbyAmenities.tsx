import {
  Bus,
  GraduationCap,
  HeartPulse,
  Loader2,
  ShoppingBasket,
  Trees,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  NEARBY_GROUPS,
  walkMinutes,
  type NearbyGroupKey,
  type NearbyResult,
} from "@/lib/mapboxNearby";
import { formatDistance } from "@/lib/mapboxNav";

const ICON: Record<NearbyGroupKey, LucideIcon> = {
  market: ShoppingBasket,
  school: GraduationCap,
  health: HeartPulse,
  bus: Bus,
  park: Trees,
  food: Utensils,
};

/**
 * "Quanh đây": mỗi nhóm tiện ích một dòng — điểm gần nhất, khoảng cách, phút đi bộ ước tính.
 * Bấm một dòng thì các điểm của nhóm đó hiện lên bản đồ.
 */
export function NearbyAmenities({
  data,
  selected,
  onSelect,
}: {
  data: NearbyResult | null;
  selected: NearbyGroupKey | null;
  onSelect: (g: NearbyGroupKey | null) => void;
}) {
  return (
    <section aria-labelledby="quanh-day" className="space-y-2">
      <h3 id="quanh-day" className="text-sm font-medium">
        Quanh đây
      </h3>
      {!data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tìm tiện ích xung quanh…
        </p>
      ) : (
        <>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {NEARBY_GROUPS.map((g) => {
              const places = data.groups[g.key];
              const nearest = places[0];
              const Icon = ICON[g.key];
              const active = selected === g.key;
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    disabled={!nearest}
                    aria-pressed={active}
                    onClick={() => onSelect(active ? null : g.key)}
                    className={`flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-default ${
                      active
                        ? "border-primary bg-primary/5"
                        : "bg-background hover:bg-accent disabled:hover:bg-background"
                    }`}
                  >
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: `color-mix(in oklab, ${g.color} 14%, transparent)`,
                        color: g.color,
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted-foreground">{g.label}</span>
                      {nearest ? (
                        <>
                          <span className="block truncate font-medium">{nearest.name}</span>
                          <span className="block text-xs text-muted-foreground tabular">
                            {formatDistance(nearest.distance)} · ~{walkMinutes(nearest.distance)}{" "}
                            phút đi bộ
                            {places.length > 1 && ` · +${places.length - 1} nơi khác`}
                          </span>
                        </>
                      ) : (
                        <span className="block text-xs text-muted-foreground">
                          Không có trong {formatDistance(data.coveredMeters)} quanh nhà
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Trong khoảng {formatDistance(data.coveredMeters)} quanh nhà. Khoảng cách theo đường chim
            bay, phút đi bộ là ước tính. Dữ liệu từ bản đồ Mapbox / OpenStreetMap, có thể thiếu
            những điểm chưa ai đưa lên bản đồ.
          </p>
        </>
      )}
    </section>
  );
}
