// Bản đồ đơn giản chạy bằng Mapbox GL JS — thay cho LeafletMap (vị trí tin ở trang chi tiết,
// vị trí tài sản, chọn điểm khi tạo tài sản / đăng tin), giữ nguyên props.
// Client-only, nạp lười qua ClientMap.
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { GL_LOCALE_VI, GL_STYLES, MAPBOX_TOKEN, isFatalGlError } from "@/lib/mapEngine";
import type { SimpleMapProps } from "./simpleMapTypes";
import { GeocodeBox } from "./GeocodeBox";

interface Props extends SimpleMapProps {
  onFatalError?: () => void;
}

function popupNode(title: string, subtitle?: string): HTMLElement {
  const el = document.createElement("div");
  const t = document.createElement("div");
  t.style.fontWeight = "600";
  t.textContent = title; // textContent, không innerHTML: tiêu đề là dữ liệu người dùng nhập
  el.appendChild(t);
  if (subtitle) {
    const s = document.createElement("div");
    s.style.cssText = "font-size:12px;margin-top:2px";
    s.textContent = subtitle;
    el.appendChild(s);
  }
  return el;
}

export default function GlSimpleMap({
  center,
  zoom = 13,
  markers = [],
  height = 400,
  onPick,
  pickerMarker,
  geocodeSearch,
  className,
  onFatalError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const cb = useRef({ onPick, onFatalError });
  cb.current = { onPick, onFatalError };

  useEffect(() => {
    if (!containerRef.current) return;
    const m = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: MAPBOX_TOKEN,
      style: GL_STYLES.streets,
      language: "vi",
      locale: GL_LOCALE_VI,
      center: [center[1], center[0]],
      zoom,
      // Bản đồ nằm giữa một trang dài: con lăn chuột phải cuộn TRANG, chỉ phóng to khi giữ Ctrl
      // (điện thoại: hai ngón tay). Không có cái này người dùng bị "kẹt" trong bản đồ khi cuộn.
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    m.on("error", (e) => {
      if (isFatalGlError(e as unknown as { error?: { status?: number; message?: string } })) {
        cb.current.onFatalError?.();
      }
    });
    m.on("click", (e) => cb.current.onPick?.(e.lngLat.lat, e.lngLat.lng));
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(containerRef.current);
    mapRef.current = m;
    setMap(m);
    return () => {
      ro.disconnect();
      m.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tâm đổi (chọn phường khác, tìm địa chỉ) → bay tới, giống FlyTo của bản Leaflet.
  const first = useRef(true);
  useEffect(() => {
    if (!map) return;
    if (first.current) {
      first.current = false;
      return;
    }
    map.flyTo({ center: [center[1], center[0]], zoom, duration: 500 });
  }, [map, center[0], center[1], zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Điểm đã chọn: kéo được khi có onPick — kéo tinh chỉnh chính xác hơn bấm lại nhiều lần.
  const pickRef = useRef<mapboxgl.Marker | null>(null);
  useEffect(() => {
    if (!map) return;
    if (!pickerMarker) {
      pickRef.current?.remove();
      pickRef.current = null;
      return;
    }
    if (!pickRef.current) {
      const mk = new mapboxgl.Marker({ color: "#1f2f6b", draggable: !!onPick });
      mk.on("dragend", () => {
        const ll = mk.getLngLat();
        cb.current.onPick?.(ll.lat, ll.lng);
      });
      mk.setPopup(new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupNode("Vị trí đã chọn")));
      pickRef.current = mk;
    }
    pickRef.current.setLngLat([pickerMarker.lng, pickerMarker.lat]).addTo(map);
  }, [map, pickerMarker?.lat, pickerMarker?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const markersKey = markers
    .map((m) => `${m.id}:${m.lat}:${m.lng}:${m.title}:${m.subtitle ?? ""}`)
    .join("|");
  useEffect(() => {
    if (!map) return;
    const made = markers.map((d) =>
      new mapboxgl.Marker({ color: "#1f2f6b" })
        .setLngLat([d.lng, d.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupNode(d.title, d.subtitle)))
        .addTo(map),
    );
    return () => made.forEach((mk) => mk.remove());
  }, [map, markersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={className}
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
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      {geocodeSearch && map && (
        <GeocodeBox
          proximity={center}
          onSelect={(lat, lng) => map.flyTo({ center: [lng, lat], zoom: 16, duration: 700 })}
        />
      )}
    </div>
  );
}
