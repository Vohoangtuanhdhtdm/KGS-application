import { useEffect, useMemo, useRef } from "react";
import { Pause, Play, Plane, Sun, SunDim } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  azimuthName,
  describeFacadeSun,
  facadeSun,
  formatClock,
  seasonDays,
  sunPosition,
  vnTime,
  SUN_MAX,
  SUN_MIN,
  type SunState,
} from "@/lib/sun";

/**
 * Thanh dưới cảnh 3D: mô phỏng nắng theo giờ (kéo thanh hoặc bấm chạy để xem bóng đổ dịch dần
 * từ sáng tới chiều), phân tích nắng rọi vào mặt tiền theo hướng nhà, và nút bay quanh toà nhà.
 */
export function SunTourBar({
  sun,
  onSunChange,
  lat,
  lng,
  houseDirection,
  facadeAzimuth,
  touring,
  onTour,
}: {
  sun: SunState;
  onSunChange: (s: SunState) => void;
  lat: number;
  lng: number;
  houseDirection: string | null;
  facadeAzimuth: number | null;
  touring: boolean;
  onTour: () => void;
}) {
  const days = useMemo(() => seasonDays(), []);
  const day = days.find((d) => d.key === sun.dayKey) ?? days[0];
  const pos = sunPosition(vnTime(day.date, sun.minutes), lat, lng);

  // Chạy giờ: 6:00 → 18:00 trong ~12 giây, mỗi khung hình nhích vài phút.
  const latest = useRef(sun);
  latest.current = sun;
  useEffect(() => {
    if (!sun.playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const s = latest.current;
      const next = s.minutes + ((now - last) / 1000) * 60; // 1 giây thật = 1 giờ mô phỏng
      last = now;
      if (next >= 18 * 60) {
        onSunChange({ ...s, minutes: 18 * 60, playing: false });
        return;
      }
      onSunChange({ ...s, minutes: next });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sun.playing]);

  const facade = useMemo(
    () =>
      facadeAzimuth != null
        ? days.map((d) => ({
            ...d,
            text: describeFacadeSun(facadeSun(facadeAzimuth, d.date, lat, lng)),
          }))
        : null,
    [days, facadeAzimuth, lat, lng],
  );

  const chip = (active: boolean) =>
    `rounded-md border px-2 py-0.5 text-xs ${
      active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
    }`;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={sun.on ? "default" : "outline"}
          aria-pressed={sun.on}
          onClick={() => onSunChange({ ...sun, on: !sun.on, playing: false })}
        >
          <Sun className="mr-1.5 h-4 w-4" /> Nắng &amp; bóng đổ
        </Button>
        <Button size="sm" variant="outline" onClick={onTour} disabled={touring}>
          <Plane className="mr-1.5 h-4 w-4" />
          {touring ? "Đang bay… chạm bản đồ để dừng" : "Bay quanh toà nhà"}
        </Button>
        {sun.on && (
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {pos.altitude > 0 ? (
              <>
                Mặt trời ở hướng {azimuthName(pos.azimuth)}, cao {Math.round(pos.altitude)}°
              </>
            ) : (
              <span className="inline-flex items-center gap-1">
                <SunDim className="h-3.5 w-3.5" /> Mặt trời đã lặn
              </span>
            )}
          </span>
        )}
      </div>

      {sun.on && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Ngày">
            {days.map((d) => (
              <button
                key={d.key}
                type="button"
                role="radio"
                aria-checked={sun.dayKey === d.key}
                onClick={() => onSunChange({ ...sun, dayKey: d.key })}
                className={chip(sun.dayKey === d.key)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0"
              aria-label={sun.playing ? "Dừng chạy giờ" : "Chạy giờ từ sáng tới chiều"}
              onClick={() =>
                onSunChange({
                  ...sun,
                  playing: !sun.playing,
                  minutes: !sun.playing && sun.minutes >= 18 * 60 ? 6 * 60 : sun.minutes,
                })
              }
            >
              {sun.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <input
              type="range"
              min={SUN_MIN}
              max={SUN_MAX}
              step={10}
              value={Math.round(sun.minutes)}
              onChange={(e) => onSunChange({ ...sun, minutes: +e.target.value, playing: false })}
              aria-label="Giờ trong ngày"
              aria-valuetext={formatClock(sun.minutes)}
              className="h-2 flex-1 cursor-pointer accent-primary"
            />
            <span className="w-12 text-right font-semibold tabular">
              {formatClock(sun.minutes)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Bóng đổ tính theo vị trí mặt trời thật ở toạ độ này (giờ Việt Nam). Nhà xung quanh lấy
            từ dữ liệu bản đồ nên có nơi thiếu — xem như mô phỏng minh hoạ.
          </p>
        </div>
      )}

      {facade && houseDirection && (
        <div className="border-t pt-2.5">
          <p className="font-medium">Mặt tiền hướng {houseDirection} — nắng rọi thẳng vào nhà:</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {facade.map((d) => (
              <li key={d.key} className="flex gap-2">
                <span className="w-28 shrink-0 text-muted-foreground">{d.label}</span>
                <span className="tabular">{d.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
