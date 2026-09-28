import { Clock, Loader2, Ruler } from "lucide-react";
import { TRAVEL_MINUTES, TRAVEL_PROFILES, type TravelProfile } from "@/lib/mapboxNav";

export interface TravelMode {
  profile: TravelProfile;
  minutes: number;
}

export const DEFAULT_TRAVEL: TravelMode = { profile: "driving-traffic", minutes: 15 };

/**
 * Chuyển vùng tìm kiếm giữa "bán kính" và "thời gian di chuyển" quanh điểm đã ghim.
 *
 * Người đi thuê hỏi "đi làm mất bao lâu", không hỏi "cách bao nhiêu km theo đường chim bay":
 * 5 km bên kia sông có khi mất 40 phút, 5 km dọc đại lộ chỉ 12 phút. Vùng thời gian men theo
 * đường sá thật nên trả lời đúng câu người dùng đang hỏi.
 */
export function TravelTimeControl({
  hasCenter,
  radiusKm,
  travel,
  onTravelChange,
  loading,
}: {
  hasCenter: boolean;
  radiusKm: number;
  travel: TravelMode | null;
  onTravelChange: (t: TravelMode | null) => void;
  loading: boolean;
}) {
  if (!hasCenter) {
    return (
      <div className="map-overlay absolute bottom-3 left-3 max-w-[260px] rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
        <p className="flex items-center gap-1.5 font-medium">
          <Clock className="h-3.5 w-3.5" /> Tìm theo thời gian đi lại
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Bấm lên bản đồ chỗ bạn làm hoặc học để xem nhà trong vài phút đi lại.
        </p>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `rounded-md px-2 py-1 text-xs transition-colors ${
      active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
    }`;

  return (
    <div
      role="group"
      aria-label="Vùng tìm kiếm quanh điểm đã ghim"
      className="map-overlay absolute bottom-3 left-3 w-[min(300px,calc(100%-24px))] space-y-2 rounded-lg border bg-background/95 p-2.5 shadow-md backdrop-blur"
    >
      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5">
        <button
          type="button"
          aria-pressed={!travel}
          onClick={() => onTravelChange(null)}
          className={`${chip(!travel)} inline-flex items-center justify-center gap-1`}
        >
          <Ruler className="h-3.5 w-3.5" /> Bán kính {radiusKm} km
        </button>
        <button
          type="button"
          aria-pressed={!!travel}
          onClick={() => onTravelChange(travel ?? DEFAULT_TRAVEL)}
          className={`${chip(!!travel)} inline-flex items-center justify-center gap-1`}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          Thời gian đi
        </button>
      </div>

      {travel && (
        <>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Cách di chuyển">
            {TRAVEL_PROFILES.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={travel.profile === p.value}
                onClick={() => onTravelChange({ ...travel, profile: p.value })}
                className={chip(travel.profile === p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Số phút">
            {TRAVEL_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={travel.minutes === m}
                onClick={() => onTravelChange({ ...travel, minutes: m })}
                className={chip(travel.minutes === m)}
              >
                {m} phút
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {travel.profile === "driving-traffic"
              ? "Ước tính theo ô tô có tính kẹt xe (bản đồ chưa có chế độ xe máy). "
              : ""}
            Kéo ghim tới chỗ làm hoặc trường học để vẽ lại vùng.
          </p>
        </>
      )}
    </div>
  );
}
