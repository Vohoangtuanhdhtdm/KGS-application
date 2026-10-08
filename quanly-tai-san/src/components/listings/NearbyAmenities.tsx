import {
  Bus,
  Footprints,
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
  walkMinutes as estimateWalkMinutes,
  type NearbyGroupKey,
  type NearbyResult,
  type WalkReach,
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

const WALK_OPTIONS = [5, 10, 15] as const;
const ZONE_COLOR = "#0d9488";

/**
 * "Quanh đây": mỗi nhóm tiện ích một dòng — điểm gần nhất, khoảng cách, phút đi bộ ước tính.
 * Bấm một dòng thì các điểm của nhóm đó hiện lên bản đồ.
 *
 * Có vùng đi bộ (Isochrone) thì thêm "chỉ số tiện ích": đi bộ X phút tới được mấy trong sáu
 * nhóm thiết yếu, và mỗi dòng ghi nhóm đó có nằm trong vùng hay không — câu hỏi kiểu "đô thị
 * 15 phút" mà khoảng cách chim bay không trả lời được.
 */
export function NearbyAmenities({
  data,
  selected,
  onSelect,
  walkMinutes,
  onWalkMinutesChange,
  walkLoading = false,
  walkError = false,
  reach = null,
}: {
  data: NearbyResult | null;
  selected: NearbyGroupKey | null;
  onSelect: (g: NearbyGroupKey | null) => void;
  /** Mức phút của vùng đi bộ đang bật; null = tắt. */
  walkMinutes?: number | null;
  onWalkMinutesChange?: (m: number | null) => void;
  walkLoading?: boolean;
  walkError?: boolean;
  reach?: WalkReach | null;
}) {
  const missing = reach ? NEARBY_GROUPS.filter((g) => reach.groups[g.key].length === 0) : [];

  return (
    <section aria-labelledby="quanh-day" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="quanh-day" className="text-sm font-medium">
          Quanh đây
        </h3>
        {onWalkMinutesChange && (
          <div
            className="flex items-center gap-1 text-xs"
            role="radiogroup"
            aria-label="Vùng đi bộ trên bản đồ"
          >
            <Footprints className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Vùng đi bộ:</span>
            {WALK_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={walkMinutes === m}
                onClick={() => onWalkMinutesChange(m)}
                className={`rounded-md border px-2 py-0.5 tabular ${
                  walkMinutes === m
                    ? "border-transparent text-white"
                    : "bg-background hover:bg-accent"
                }`}
                style={walkMinutes === m ? { background: ZONE_COLOR } : undefined}
              >
                {m} phút
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={walkMinutes == null}
              onClick={() => onWalkMinutesChange(null)}
              className={`rounded-md border px-2 py-0.5 ${
                walkMinutes == null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-accent"
              }`}
            >
              Tắt
            </button>
          </div>
        )}
      </div>

      {walkMinutes != null && (
        <WalkScore
          minutes={walkMinutes}
          reach={reach}
          loading={walkLoading || (!reach && !walkError)}
          error={walkError}
          missing={missing.map((g) => g.label)}
        />
      )}

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
              const inZone = reach?.groups[g.key] ?? null;
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
                      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{g.label}</span>
                        {/* Nhóm không có điểm nào thì dòng dưới đã nói "không có" — thêm "ngoài vùng" là thừa. */}
                        {inZone && (inZone.length > 0 || nearest) && (
                          <span
                            className="shrink-0 rounded-full px-1.5 text-[10px] font-medium"
                            style={
                              inZone.length
                                ? {
                                    background: `color-mix(in oklab, ${ZONE_COLOR} 14%, transparent)`,
                                    color: ZONE_COLOR,
                                  }
                                : undefined
                            }
                          >
                            {inZone.length
                              ? `${inZone.length} nơi trong ${reach!.minutes} phút`
                              : `ngoài ${reach!.minutes} phút`}
                          </span>
                        )}
                      </span>
                      {nearest ? (
                        <>
                          <span className="block truncate font-medium">{nearest.name}</span>
                          <span className="block text-xs text-muted-foreground tabular">
                            {formatDistance(nearest.distance)} · ~
                            {estimateWalkMinutes(nearest.distance)} phút đi bộ
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
            bay, phút đi bộ là ước tính
            {walkMinutes != null &&
              "; riêng vùng đi bộ trên bản đồ tính theo đường đi thật (Mapbox Isochrone)"}
            . Dữ liệu từ bản đồ Mapbox / OpenStreetMap, có thể thiếu những điểm chưa ai đưa lên bản
            đồ.
          </p>
        </>
      )}
    </section>
  );
}

/** Thẻ tóm tắt: đi bộ X phút tới được mấy nhóm tiện ích thiết yếu. */
function WalkScore({
  minutes,
  reach,
  loading,
  error,
  missing,
}: {
  minutes: number;
  reach: WalkReach | null;
  loading: boolean;
  error: boolean;
  missing: string[];
}) {
  if (error)
    return (
      <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
        Chưa tính được vùng {minutes} phút đi bộ lúc này.
      </p>
    );
  if (!reach || loading)
    return (
      <p className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tính vùng {minutes} phút đi bộ…
      </p>
    );
  const total = NEARBY_GROUPS.length;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border px-3 py-2"
      style={{ borderColor: `color-mix(in oklab, ${ZONE_COLOR} 35%, transparent)` }}
      aria-live="polite"
    >
      <span className="flex items-baseline gap-1">
        <strong className="text-lg leading-none tabular" style={{ color: ZONE_COLOR }}>
          {reach.reached}/{total}
        </strong>
        <span className="text-sm">nhóm tiện ích trong {minutes} phút đi bộ</span>
      </span>
      <span className="flex gap-1" aria-hidden>
        {NEARBY_GROUPS.map((g) => (
          <span
            key={g.key}
            title={g.label}
            className="h-2 w-5 rounded-full"
            style={{
              background: reach.groups[g.key].length ? ZONE_COLOR : "var(--color-muted)",
            }}
          />
        ))}
      </span>
      {missing.length > 0 && (
        <span className="w-full text-xs text-muted-foreground">
          {reach.partial ? "Chưa thấy trong phần đã quét: " : "Chưa có trong vùng: "}
          {/* Chấm phẩy: tên nhóm "Xe buýt, metro" đã có dấu phẩy. */}
          {missing.join("; ").toLowerCase()}.
        </span>
      )}
    </div>
  );
}
