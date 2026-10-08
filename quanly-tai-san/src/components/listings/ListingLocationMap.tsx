import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Crosshair, Loader2, MapPinned, X } from "lucide-react";
import { ClientMap } from "@/components/map/ClientMap";
import { Button } from "@/components/ui/button";
import { useCommutePlace } from "@/hooks/useCommutePlace";
import { useGeolocationOnDemand } from "@/hooks/useGeolocationOnDemand";
import type { MapEngine } from "@/lib/mapEngine";
import {
  TRAVEL_PROFILES,
  fetchIsochrone,
  fetchRoute,
  formatDistance,
  formatDuration,
  profileLabel,
} from "@/lib/mapboxNav";
import {
  NEARBY_GROUPS,
  buildNearby,
  collectFromMap,
  fetchTilequery,
  walkMinutes,
  walkReach,
  type NearbyGroupKey,
} from "@/lib/mapboxNearby";
import { NearbyAmenities } from "./NearbyAmenities";

/** Tối đa bấy nhiêu điểm của một nhóm được ghim lên bản đồ — nhiều hơn thì rối mắt. */
const NEARBY_ON_MAP = 8;

const PLACE_COLOR = "#16a34a";
const LABELS = ["Chỗ làm", "Trường học", "Nhà người thân"] as const;
/** Mặc định 10 phút: ~800 m, nằm gọn trong phạm vi quét tiện ích (1 km). */
const DEFAULT_WALK_MINUTES = 10;

/**
 * Bản đồ vị trí ở trang chi tiết tin, kèm "đi tới chỗ bạn hay đến mất bao lâu".
 *
 * Mapbox Directions chỉ được dùng khi bản đồ chạy GL (điều khoản: kết quả phải vẽ trên bản đồ
 * Mapbox). Trên bản Leaflet dự phòng, phần này ẩn hẳn — chỉ còn bản đồ vị trí như trước.
 */
export function ListingLocationMap({
  listingId,
  title,
  lat,
  lng,
}: {
  listingId: string;
  title: string;
  lat: number;
  lng: number;
}) {
  const [engine, setEngine] = useState<MapEngine | null>(null);
  const { place, profile, setPlace, setProfile } = useCommutePlace();
  const [picking, setPicking] = useState(false);
  const [label, setLabel] = useState<string>(LABELS[0]);
  const geo = useGeolocationOnDemand();

  // GPS về thì dùng luôn làm chỗ hay đến.
  useEffect(() => {
    if (!picking || geo.requestId === 0) return;
    if (geo.status === "granted" && geo.position) {
      setPlace({ ...geo.position, label });
      setPicking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.requestId]);

  const gl = engine === "gl";
  const routeQ = useQuery({
    queryKey: ["route", lat, lng, place?.lat, place?.lng, profile],
    queryFn: ({ signal }) => fetchRoute({ lat, lng }, place!, profile, signal),
    enabled: gl && !!place && !picking,
    // Cùng hai điểm, cùng cách đi thì trong một phiên coi như không đổi: mở lại tin này
    // không tốn thêm lượt gọi.
    staleTime: Infinity,
    retry: 1,
  });
  const route = gl && place && !picking ? (routeQ.data ?? null) : null;

  // Tiện ích xung quanh — gộp Tilequery (đủ sát nhà) với tile bản đồ đã tải (phủ rộng), xem
  // lib/mapboxNearby.ts. Chỉ trên GL: đây là dữ liệu của bản đồ Mapbox.
  const [fromMap, setFromMap] = useState<ReturnType<typeof collectFromMap> | null>(null);
  const tqQ = useQuery({
    queryKey: ["tilequery", lat.toFixed(5), lng.toFixed(5)],
    queryFn: ({ signal }) => fetchTilequery({ lat, lng }, signal),
    enabled: gl,
    staleTime: Infinity,
    retry: 1,
  });
  // Tilequery hỏng thì vẫn hiện phần lấy từ tile — thiếu vài điểm sát nhà còn hơn không có gì.
  const tqDone = tqQ.isSuccess || tqQ.isError;
  const nearby = useMemo(
    () =>
      fromMap && tqDone
        ? buildNearby([fromMap.candidates, tqQ.data ?? []], fromMap.coveredMeters)
        : null,
    [fromMap, tqDone, tqQ.data],
  );
  // Vùng đi bộ X phút quanh nhà (Isochrone) — một lượt gọi mỗi tin × mỗi mức phút, nhớ trong
  // phiên. Đổi mức phút là thao tác của người dùng; tắt thì không gọi gì.
  const [walkMinutesSel, setWalkMinutesSel] = useState<number | null>(DEFAULT_WALK_MINUTES);
  const walkQ = useQuery({
    queryKey: ["isochrone", "walking", lat.toFixed(5), lng.toFixed(5), walkMinutesSel],
    queryFn: ({ signal }) => fetchIsochrone({ lat, lng }, "walking", walkMinutesSel!, signal),
    enabled: gl && walkMinutesSel != null,
    staleTime: Infinity,
    retry: 1,
  });
  const walkArea = gl && walkMinutesSel != null ? (walkQ.data ?? null) : null;
  const reach = useMemo(
    () =>
      nearby && walkArea && walkMinutesSel != null
        ? walkReach(nearby, walkArea.ring, walkArea.boundingRadiusMeters, walkMinutesSel)
        : null,
    [nearby, walkArea, walkMinutesSel],
  );

  const [nearbyGroup, setNearbyGroup] = useState<NearbyGroupKey | null>(null);
  const groupMeta = NEARBY_GROUPS.find((g) => g.key === nearbyGroup);
  const groupPlaces =
    gl && nearbyGroup && nearby ? nearby.groups[nearbyGroup].slice(0, NEARBY_ON_MAP) : [];

  const markers = [
    { id: listingId, lat, lng, title },
    ...(gl && place && !picking
      ? [{ id: "commute", lat: place.lat, lng: place.lng, title: place.label, color: PLACE_COLOR }]
      : []),
    ...groupPlaces.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      title: p.name,
      subtitle: `${p.kind} · ${formatDistance(p.distance)} · ~${walkMinutes(p.distance)} phút đi bộ`,
      color: groupMeta?.color,
    })),
  ];

  return (
    <div className="space-y-3">
      <ClientMap
        center={[lat, lng]}
        zoom={15}
        height={300}
        markers={markers}
        route={route?.line ?? null}
        areaPolygon={walkArea?.ring ?? null}
        fitPoints={
          groupPlaces.length
            ? [{ lat, lng }, ...groupPlaces]
            : walkArea
              ? walkArea.ring.map(([x, y]) => ({ lat: y, lng: x }))
              : null
        }
        onEngine={setEngine}
        onFirstIdle={(m) => setFromMap(collectFromMap(m, { lat, lng }))}
        onPick={
          picking
            ? (pLat, pLng) => {
                setPlace({ lat: pLat, lng: pLng, label });
                setPicking(false);
              }
            : undefined
        }
        geocodeSearch={picking}
      />

      {gl && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          {picking ? (
            <div className="space-y-2">
              <p className="font-medium">Bấm lên bản đồ đúng chỗ bạn hay đến</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Đây là">
                {LABELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={label === l}
                    onClick={() => setLabel(l)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      label === l
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Gõ địa chỉ ở ô tìm để đưa bản đồ tới khu vực đó, rồi bấm đúng điểm. Chỗ này chỉ lưu
                trên trình duyệt của bạn.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={geo.request}
                  disabled={geo.status === "pending"}
                >
                  {geo.status === "pending" ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Crosshair className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Dùng vị trí hiện tại
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>
                  Huỷ
                </Button>
              </div>
              {(geo.status === "denied" || geo.status === "unsupported") && (
                <p className="text-xs text-destructive">
                  Không lấy được vị trí — hãy bấm trực tiếp lên bản đồ.
                </p>
              )}
            </div>
          ) : !place ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" /> Từ đây tới chỗ làm hay trường học mất bao lâu?
              </p>
              <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
                <MapPinned className="mr-1.5 h-3.5 w-3.5" /> Đặt chỗ hay đến
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p aria-live="polite">
                  <span className="text-muted-foreground">
                    Tới <span style={{ color: PLACE_COLOR }}>●</span> {place.label.toLowerCase()}
                    :{" "}
                  </span>
                  {routeQ.isFetching ? (
                    <Loader2 className="inline h-4 w-4 animate-spin align-[-3px]" />
                  ) : routeQ.isError ? (
                    <span className="text-destructive">không tính được lúc này</span>
                  ) : route ? (
                    <>
                      <strong className="tabular">{formatDuration(route.durationSeconds)}</strong>
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatDistance(route.distanceMeters)} bằng {profileLabel(profile)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">không tìm được đường đi</span>
                  )}
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => setPicking(true)}
                  >
                    Đổi chỗ
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    aria-label="Xoá chỗ hay đến"
                    onClick={() => setPlace(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Cách di chuyển">
                {TRAVEL_PROFILES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={profile === p.value}
                    onClick={() => setProfile(p.value)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      profile === p.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {profile === "driving-traffic" && (
                <p className="text-xs text-muted-foreground">
                  Ước tính theo ô tô có tính kẹt xe — bản đồ chưa có chế độ xe máy.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {gl && (
        <NearbyAmenities
          data={nearby}
          selected={nearbyGroup}
          onSelect={setNearbyGroup}
          walkMinutes={walkMinutesSel}
          onWalkMinutesChange={setWalkMinutesSel}
          walkLoading={walkQ.isFetching}
          walkError={walkQ.isError}
          reach={reach}
        />
      )}
    </div>
  );
}
