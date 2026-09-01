// Bản đồ chuyên dụng cho Marketplace — marker dạng viên thuốc hiện giá, đồng bộ
// hover 2 chiều với danh sách, cộng thêm (Giai đoạn 2): marker vị trí GPS, pin tìm kiếm
// kéo/click được, vòng bán kính, nút "Tìm trong khu vực này". Tách riêng khỏi LeafletMap
// (dùng cho picker vị trí/hiển thị 1 điểm ở Nhóm A) vì nhu cầu marker hoàn toàn khác —
// nhưng TÁI SỬ DỤNG đúng cấu hình OSM tile/attribution đã dùng ở LeafletMap.
// Client-only, load qua React.lazy (xem PropertyMapClient.tsx).
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { formatCurrency } from "@/lib/format";
import { formatListingPrice } from "@/lib/api/properties";
import type { ListingTypeCode } from "@/constants/enums";
import type { LatLng } from "@/hooks/useGeolocationOnDemand";
import type { PaymentCycleCode } from "@/constants/enums";
import { ImageIcon } from "lucide-react";

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Bán = navy (màu primary chủ đạo của app), Cho thuê = xanh (màu success) —
// dùng đúng token ngữ nghĩa hệ thống, không tạo bảng màu riêng cho Marketplace.
const TYPE_BORDER: Record<ListingTypeCode, string> = {
  1: "var(--color-primary)",
  2: "var(--color-success)",
};

// Lệch quá 500m so với searchCenter mới coi là "đã pan/zoom lệch" — hiện nút "Tìm trong khu vực này"
const MOVE_THRESHOLD_METERS = 500;

export interface PropertyMapPoint {
  id: string;
  lat: number;
  lng: number;
  price: number;
  type: ListingTypeCode;
  // Cho popup xem nhanh (Phần A) — optional để component vẫn dùng được cho các điểm
  // không cần popup (VD nếu sau này tái dùng cho mục đích khác)
  slug?: string;
  title?: string;
  thumbnailUrl?: string | null;
  rentPaymentCycle?: PaymentCycleCode | null;
}

function pillIcon(point: PropertyMapPoint, hovered: boolean): L.DivIcon {
  const border = TYPE_BORDER[point.type];
  const padding = hovered ? "5px 11px" : "4px 10px";
  const bg = hovered ? border : "white";
  const color = hovered ? "white" : "#111827";
  const shadow = hovered ? "0 4px 10px rgba(0,0,0,0.25)" : "0 1px 3px rgba(0,0,0,0.15)";
  const scale = hovered ? "scale(1.15)" : "scale(1)";
  const label = formatCurrency(point.price, { compact: true });
  const html = `<div style="display:inline-flex;align-items:center;padding:${padding};border-radius:999px;background:${bg};color:${color};border:2px solid ${border};font-size:12px;font-weight:600;white-space:nowrap;box-shadow:${shadow};transform:${scale};transition:transform 150ms, background 150ms, color 150ms;">${label}</div>`;
  return L.divIcon({
    html,
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
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.flyTo([points[0].lat, points[0].lng], 14, { duration: 0.5 });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.flyToBounds(bounds, { padding: [40, 40], duration: 0.5, maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => p.id).join(","), map]);
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

/** Thẻ xem nhanh trong Popup khi click marker — ảnh nhỏ + giá + tên rút gọn + link chi tiết. */
function MiniPropertyCard({ point }: { point: PropertyMapPoint }) {
  return (
    <div style={{ width: 180 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 6,
            overflow: "hidden",
            flexShrink: 0,
            background: "var(--color-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {point.thumbnailUrl ? (
            <img
              src={point.thumbnailUrl}
              alt={point.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <ImageIcon size={20} color="var(--color-muted-foreground)" />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--color-foreground)" }}>
            {formatListingPrice(point.price, point.type, point.rentPaymentCycle ?? null)}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-muted-foreground)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {point.title}
          </div>
        </div>
      </div>
      <Link
        to="/tin-dang/$slug"
        params={{ slug: point.slug! }}
        style={{
          display: "block",
          marginTop: 6,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-primary)",
        }}
      >
        Xem chi tiết →
      </Link>
    </div>
  );
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
  onMapReady?: (map: L.Map) => void;
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
  const icons = useMemo(
    () => new Map(points.map((p) => [p.id, pillIcon(p, p.id === hoveredId)])),
    [points, hoveredId],
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
        <TileLayer url={OSM_URL} attribution={OSM_ATTRIB} />
        <FitBounds points={points} />
        {searchCenter && <FlyToSearchCenter target={searchCenter} />}
        <MapController
          onMapClick={(latlng) => onSearchCenterChange?.(latlng)}
          onMoveEnd={handleMoveEnd}
          onMapReady={(map) => onMapReady?.(map)}
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

        {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={icons.get(p.id)}
            alt={`Tin đăng giá ${formatCurrency(p.price, { compact: true })}`}
            eventHandlers={{
              mouseover: () => onHoverPoint(p.id),
              mouseout: () => onHoverPoint(null),
              click: () => onClickPoint(p.id),
            }}
          >
            {/* Popup xem nhanh — song song với hành vi cuộn danh sách (onClickPoint ở trên) */}
            {p.slug && p.title && (
              <Popup autoPan={false} closeButton minWidth={200}>
                <MiniPropertyCard point={p} />
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
