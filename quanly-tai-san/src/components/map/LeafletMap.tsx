// Client-only Leaflet wrapper. Load only via React.lazy.
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { BaseTileLayer } from "./BaseTileLayer";
import { useEffect } from "react";
import type { SimpleMapProps } from "./simpleMapTypes";

// Fix default marker icons (Vite bundler breaks the paths)
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type { MarkerData } from "./simpleMapTypes";

function FlyTo({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom ?? map.getZoom(), { duration: 0.5 });
  }, [lat, lng, zoom, map]);
  return null;
}

function ClickPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LeafletMap({
  center,
  zoom = 13,
  markers = [],
  height = 400,
  onPick,
  pickerMarker,
  className,
}: SimpleMapProps) {
  return (
    <div
      className={className}
      // isolation + z-0: nhốt z-index nội bộ của Leaflet (400–1000) trong stacking
      // context riêng để bản đồ không đè lên Dialog/Popover (z-50)
      style={{
        height,
        width: "100%",
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
        zIndex: 0,
        isolation: "isolate",
      }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <BaseTileLayer />
        <FlyTo lat={center[0]} lng={center[1]} zoom={zoom} />
        {onPick && <ClickPicker onPick={onPick} />}
        {pickerMarker && (
          <Marker
            position={[pickerMarker.lat, pickerMarker.lng]}
            // Kéo được như bản GL: tinh chỉnh chính xác hơn bấm lại nhiều lần.
            draggable={!!onPick}
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                onPick?.(ll.lat, ll.lng);
              },
            }}
          >
            <Popup>Vị trí đã chọn</Popup>
          </Marker>
        )}
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]}>
            <Popup>
              <div style={{ fontWeight: 600 }}>{m.title}</div>
              {m.subtitle && <div style={{ fontSize: 12, marginTop: 2 }}>{m.subtitle}</div>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
