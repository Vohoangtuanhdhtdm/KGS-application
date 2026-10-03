// Bản đồ chuyên dụng cho Marketplace — marker dạng viên thuốc hiện giá, đồng bộ
// hover 2 chiều với danh sách, cộng thêm (Giai đoạn 2): marker vị trí GPS, pin tìm kiếm
// kéo/click được, vòng bán kính, nút "Tìm trong khu vực này". Tách riêng khỏi LeafletMap
// (dùng cho picker vị trí/hiển thị 1 điểm ở Nhóm A) vì nhu cầu marker hoàn toàn khác —
// nhưng TÁI SỬ DỤNG đúng cấu hình OSM tile/attribution đã dùng ở LeafletMap.
// Client-only, load qua React.lazy (xem PropertyMapClient.tsx).
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import { BaseTileLayer } from "./BaseTileLayer";
import { useEffect, useMemo, useRef } from "react";
import { formatCurrency } from "@/lib/format";
import type { LatLng } from "@/hooks/useGeolocationOnDemand";
import type { MapViewApi } from "@/lib/mapEngine";
import {
  MOVE_THRESHOLD_METERS,
  groupHovered,
  groupLabel,
  groupPoints,
  isValidLatLng,
  pillStyle,
  type PillGroup,
  type PropertyMapPoint,
} from "./propertyMapShared";
import { MiniPropertyCard } from "./MiniPropertyCard";
import { MiniGroupCard } from "./MiniGroupCard";

export type { PropertyMapPoint } from "./propertyMapShared";

function pillIcon(group: PillGroup, hovered: boolean): L.DivIcon {
  return L.divIcon({
    html: `<div style="${pillStyle(group.points[0], hovered)}">${groupLabel(group)}</div>`,
    className: "property-pill-marker", // reset style mặc định của leaflet cho div icon
    iconSize: undefined,
    iconAnchor: [hovered ? 30 : 26, 14],
  });
}

// Chấm xanh dương kiểu Google Maps — vị trí GPS thật, cố định, KHÁC hẳn marker property/pin tìm kiếm
const USER_LOCATION_ICON = L.divIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#4285F4;border:3px solid white;box-shadow:0 0 0 2px rgba(66,133,244,0.35), 0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: "user-location-marker",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Pin tìm kiếm — kéo/click để đổi tâm tìm kiếm, khác marker vị trí GPS lẫn marker property
const SEARCH_PIN_ICON = L.divIcon({
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.7 0 0 6.7 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.7 23.3 0 15 0z" fill="var(--color-primary)"/><circle cx="15" cy="15" r="6" fill="white"/></svg>`,
  className: "search-pin-marker",
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

function FitBounds({ points }: { points: PropertyMapPoint[] }) {
  const map = useMap();

  // Lọc toạ độ hỏng TRƯỚC khi đưa cho Leaflet.
  //
  // L.latLngBounds gặp NaN sẽ ném "Invalid LatLng object: (NaN, NaN)". Lỗi đó ném từ trong
  // useEffect nên React không nuốt được — nó nổi lên error boundary và làm SẬP CẢ TRANG
  // tìm kiếm, không riêng bản đồ. Một toạ độ hỏng của một tin đăng không được phép hạ cả
  // trang, nên chặn ngay tại đây thay vì tin rằng dữ liệu luôn sạch.
  const usable = points.filter((p) => isValidLatLng(p.lat, p.lng));
  const key = usable.map((p) => p.id).join(",");

  useEffect(() => {
    if (usable.length === 0) return;
    if (usable.length === 1) {
      map.flyTo([usable[0].lat, usable[0].lng], 14, { duration: 0.5 });
      return;
    }
    try {
      const bounds = L.latLngBounds(usable.map((p) => [p.lat, p.lng]));
      if (!bounds.isValid()) return;
      map.flyToBounds(bounds, { padding: [40, 40], duration: 0.5, maxZoom: 15 });
    } catch {
      // Đường phòng vệ cuối. Không căn được khung nhìn thì bản đồ vẫn hiện ở vị trí mặc
      // định — chấp nhận được. Ném lỗi ra ngoài thì không.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);

  return null;
}

/** Bay tới searchCenter khi nó đổi từ bên ngoài (GPS/geocode) — không flyTo khi đổi do chính kéo/click trên map. */
function FlyToSearchCenter({ target }: { target: LatLng | null }) {
  const map = useMap();
  const lastFlown = useRef<string | null>(null);
  useEffect(() => {
    if (!target) return;
    const key = `${target.lat.toFixed(5)},${target.lng.toFixed(5)}`;
    if (lastFlown.current === key) return;
    lastFlown.current = key;
    map.flyTo([target.lat, target.lng], 14, { duration: 0.7 });
  }, [target, map]);
  return null;
}

/** Bắt sự kiện click (đổi tâm tìm kiếm) + moveend (theo dõi lệch để hiện nút "Tìm trong khu vực này"). */
function MapController({
  onMapClick,
  onMoveEnd,
  onMapReady,
}: {
  onMapClick: (latlng: LatLng) => void;
  onMoveEnd: (map: L.Map) => void;
  onMapReady: (map: L.Map) => void;
}) {
  const map = useMapEvents({
    click: (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
    moveend: () => onMoveEnd(map),
  });
  useEffect(() => {
    onMapReady(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

interface PropertyMapProps {
  points: PropertyMapPoint[];
  hoveredId: string | null;
  onHoverPoint: (id: string | null) => void;
  onClickPoint: (id: string) => void;
  defaultCenter: [number, number];
  className?: string;
  // Giai đoạn 2 — tương tác bản đồ nâng cao
  userLocation?: LatLng | null;
  searchCenter?: LatLng | null;
  onSearchCenterChange?: (c: LatLng) => void;
  radiusMeters?: number | null;
  /** Trang tìm kiếm chỉ cần tâm và bán kính khung nhìn — không cầm thẳng đối tượng Leaflet,
      để bản GL (GlPropertyMap) thay thế được mà trang không phải biết. */
  onMapReady?: (api: MapViewApi) => void;
  onShowSearchAreaButtonChange?: (show: boolean) => void;
}

export default function PropertyMap({
  points,
  hoveredId,
  onHoverPoint,
  onClickPoint,
  defaultCenter,
  className,
  userLocation,
  searchCenter,
  onSearchCenterChange,
  radiusMeters,
  onMapReady,
  onShowSearchAreaButtonChange,
}: PropertyMapProps) {
  // Tin chung toạ độ (các căn của một toà nhà) gộp thành một viên — xem groupPoints.
  const groups = useMemo(() => groupPoints(points), [points]);
  const icons = useMemo(
    () => new Map(groups.map((g) => [g.key, pillIcon(g, groupHovered(g, hoveredId))])),
    [groups, hoveredId],
  );

  const handleMoveEnd = (map: L.Map) => {
    if (!searchCenter || !onShowSearchAreaButtonChange) return;
    const dist = map.getCenter().distanceTo([searchCenter.lat, searchCenter.lng]);
    onShowSearchAreaButtonChange(dist > MOVE_THRESHOLD_METERS);
  };

  return (
    <div className={className} style={{ height: "100%", width: "100%" }}>
      <MapContainer
        center={searchCenter ? [searchCenter.lat, searchCenter.lng] : defaultCenter}
        zoom={searchCenter ? 14 : 12}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <BaseTileLayer />
        <FitBounds points={points} />
        {searchCenter && <FlyToSearchCenter target={searchCenter} />}
        <MapController
          onMapClick={(latlng) => onSearchCenterChange?.(latlng)}
          onMoveEnd={handleMoveEnd}
          onMapReady={(map) =>
            onMapReady?.({
              getCenter: () => {
                const c = map.getCenter();
                return { lat: c.lat, lng: c.lng };
              },
              getViewRadiusMeters: () => map.getCenter().distanceTo(map.getBounds().getNorthEast()),
              flyTo: (lat, lng, zoom) => map.flyTo([lat, lng], zoom ?? 15, { duration: 0.7 }),
            })
          }
        />

        {radiusMeters != null && searchCenter && (
          <Circle
            center={[searchCenter.lat, searchCenter.lng]}
            radius={radiusMeters}
            pathOptions={{
              color: "var(--color-primary)",
              fillColor: "var(--color-primary)",
              fillOpacity: 0.06,
              weight: 1,
            }}
          />
        )}

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={USER_LOCATION_ICON}
            alt="Vị trí hiện tại của bạn"
            keyboard={false}
          />
        )}

        {searchCenter && (
          <Marker
            position={[searchCenter.lat, searchCenter.lng]}
            icon={SEARCH_PIN_ICON}
            alt="Kéo để đổi vị trí tìm kiếm"
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                onSearchCenterChange?.({ lat, lng });
              },
            }}
          />
        )}

        {/* Cùng lý do với FitBounds: một Marker mang toạ độ NaN cũng ném lỗi và hạ cả trang.
            Bỏ qua điểm hỏng thay vì tin dữ liệu luôn sạch. */}
        {groups.map((g) => {
          const p = g.points[0];
          const withCard = g.points.filter((x) => x.slug && x.title);
          return (
            <Marker
              key={g.key}
              position={[g.lat, g.lng]}
              icon={icons.get(g.key)}
              alt={
                g.points.length === 1
                  ? `Tin đăng giá ${formatCurrency(p.price, { compact: true })}`
                  : `${g.points.length} tin đăng cùng vị trí`
              }
              eventHandlers={{
                mouseover: () => onHoverPoint(p.id),
                mouseout: () => onHoverPoint(null),
                click: () => onClickPoint(p.id),
              }}
            >
              {/* Popup xem nhanh — song song với hành vi cuộn danh sách (onClickPoint ở trên) */}
              {withCard.length > 0 && (
                <Popup autoPan={false} closeButton minWidth={200}>
                  {withCard.length === 1 ? (
                    <MiniPropertyCard point={withCard[0]} />
                  ) : (
                    <MiniGroupCard points={withCard} />
                  )}
                </Popup>
              )}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
