import { useState } from "react";
import { Bookmark, Clock, Crosshair, Loader2, MapPin, Pencil, X } from "lucide-react";
import { GeocodeBox } from "@/components/map/GeocodeBox";
import type { CommutePlace } from "@/hooks/useCommutePlace";
import {
  TRAVEL_MINUTES,
  TRAVEL_PROFILES,
  profileLabel,
  type TravelProfile,
  DEFAULT_TRAVEL,
  type TravelMode,
} from "@/lib/mapboxNav";

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009];

/**
 * "Tìm nhà theo thời gian đi làm" — khung điều khiển nổi ở góc bản đồ tìm kiếm.
 *
 * Người đi thuê hỏi "đi làm mất bao lâu", không hỏi "cách bao nhiêu km theo đường chim bay":
 * 5 km bên kia sông có khi mất 40 phút, 5 km dọc đại lộ chỉ 12 phút. Vùng thời gian (Mapbox
 * Isochrone) men theo đường sá thật nên trả lời đúng câu người dùng đang hỏi.
 *
 * Bản đầu chỉ có hai nút "Bán kính / Thời gian đi" và một dòng gợi ý "bấm lên bản đồ" — người
 * dùng không biết phải bắt đầu từ đâu, không biết cái ghim là gì. Nay đi theo từng bước:
 *   thu gọn  →  (1) chọn chỗ làm/học  →  (2) cách đi + số phút  →  tóm tắt một dòng
 */
export function TravelTimeControl({
  intent,
  onIntentChange,
  hasCenter,
  centerLabel,
  proximity,
  travel,
  onTravelChange,
  loading,
  savedPlace,
  onUseSavedPlace,
  onUseMyLocation,
  locating,
  onGeocode,
  canSaveCenter,
  onSaveCenter,
}: {
  /** Người dùng đã mở luồng này (bấm ghim lên bản đồ lúc đó sẽ là điểm xuất phát). */
  intent: boolean;
  onIntentChange: (v: boolean) => void;
  hasCenter: boolean;
  centerLabel: string;
  proximity: [number, number] | null;
  travel: TravelMode | null;
  onTravelChange: (t: TravelMode | null) => void;
  loading: boolean;
  savedPlace: CommutePlace | null;
  onUseSavedPlace: () => void;
  onUseMyLocation: () => void;
  locating: boolean;
  /** Kết quả tìm địa chỉ: chỉ đưa camera tới, không đặt ghim (điều khoản geocoding miễn phí). */
  onGeocode: (lat: number, lng: number) => void;
  canSaveCenter: boolean;
  onSaveCenter: () => void;
}) {
  const [editing, setEditing] = useState(true);
  const card =
    "map-overlay absolute bottom-3 left-3 w-[min(320px,calc(100%-24px))] rounded-lg border bg-background/95 shadow-md backdrop-blur";
  const chip = (active: boolean) =>
    `rounded-md px-2 py-1 text-xs transition-colors ${
      active ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-accent"
    }`;

  // ---- Thu gọn: một nút mời ----
  if (!intent && !travel) {
    return (
      <button
        type="button"
        onClick={() => {
          onIntentChange(true);
          setEditing(true);
          // Đã có ghim (đang tìm theo bán kính) thì bật luôn — không bắt chọn lại điểm.
          if (hasCenter) onTravelChange(DEFAULT_TRAVEL);
        }}
        className="map-overlay absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border bg-background/95 px-3 py-1.5 text-sm font-medium shadow-md backdrop-blur hover:bg-accent"
      >
        <Clock className="h-4 w-4 text-primary" />
        Tìm nhà theo thời gian đi làm
      </button>
    );
  }

  const close = () => {
    onTravelChange(null);
    onIntentChange(false);
  };

  // ---- Bước 1: chọn chỗ làm / học ----
  if (!hasCenter || !travel) {
    return (
      <div className={`${card} space-y-2.5 p-3`} role="group" aria-label="Chọn chỗ làm hoặc học">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">
            <span className="mr-1 text-primary">1.</span>Bạn làm hoặc học ở đâu?
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng"
            className="rounded p-0.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {savedPlace && (
            <button
              type="button"
              onClick={onUseSavedPlace}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
            >
              <Bookmark className="h-3.5 w-3.5 text-primary" /> {savedPlace.label} đã lưu
            </button>
          )}
          <button
            type="button"
            onClick={onUseMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5" />
            )}
            Vị trí hiện tại
          </button>
        </div>
        <GeocodeBox
          floating={false}
          proximity={proximity ?? DEFAULT_CENTER}
          onSelect={onGeocode}
          placeholder="Gõ địa chỉ để đưa bản đồ tới đó…"
        />
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Rồi bấm lên bản đồ đúng chỗ đó để đặt ghim.
        </p>
      </div>
    );
  }

  // ---- Bước 2 / tóm tắt ----
  const summary = (
    <p className="min-w-0 flex-1 text-sm leading-snug">
      <Clock className="mr-1 inline h-4 w-4 align-[-3px] text-primary" />
      Nhà đi tới <strong>{centerLabel}</strong> trong{" "}
      <strong className="tabular">{travel.minutes} phút</strong> bằng {profileLabel(travel.profile)}
      {loading && <Loader2 className="ml-1 inline h-3.5 w-3.5 animate-spin align-[-2px]" />}
    </p>
  );

  return (
    <div className={`${card} p-3`} role="group" aria-label="Tìm nhà theo thời gian đi lại">
      <div className="flex items-start gap-2">
        {summary}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Đổi cách đi hoặc số phút"
            className="rounded p-0.5 text-muted-foreground hover:bg-accent"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Tắt tìm theo thời gian đi"
          className="rounded p-0.5 text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {editing && (
        <div className="mt-2.5 space-y-2 border-t pt-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            <span className="mr-1 text-primary">2.</span>Đi bằng gì, tối đa bao lâu?
          </p>
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
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Số phút tối đa">
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
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-muted-foreground">
            <li>
              Vùng tô trên bản đồ là nơi đi tới được trong thời gian đó; danh sách chỉ còn nhà trong
              vùng.
            </li>
            <li>Bấm vào giá một căn để xem thời gian đi chính xác. Kéo ghim để đổi điểm.</li>
            {travel.profile === "driving-traffic" && (
              <li>Xe máy được ước tính theo ô tô có tính kẹt xe (bản đồ chưa có chế độ xe máy).</li>
            )}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {canSaveCenter ? (
              <button
                type="button"
                onClick={onSaveCenter}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Bookmark className="h-3.5 w-3.5" /> Lưu điểm này làm chỗ hay đến
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
