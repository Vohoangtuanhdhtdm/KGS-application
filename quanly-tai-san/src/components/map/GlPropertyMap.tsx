// Bản đồ tìm kiếm chạy bằng Mapbox GL JS — thay cho PropertyMap (Leaflet), giữ NGUYÊN props
// và hành vi để trang tìm kiếm không phải đổi gì ngoài kiểu của onMapReady:
//   • viên giá đồng bộ hover hai chiều với danh sách, bấm viên giá → cuộn tới thẻ + xem nhanh
//   • chấm vị trí GPS, ghim tìm kiếm kéo/bấm được, vòng bán kính
//   • căn khung theo các tin, bay tới tâm tìm kiếm, nút "Tìm trong khu vực này"
// Client-only, nạp lười qua PropertyMapClient.
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LatLng } from "@/hooks/useGeolocationOnDemand";
import {
  GL_LOCALE_VI,
  GL_STYLES,
  MAPBOX_TOKEN,
  circlePolygon,
  distanceMeters,
  isFatalGlError,
  type MapViewApi,
} from "@/lib/mapEngine";
import {
  MOVE_THRESHOLD_METERS,
  groupHovered,
  groupLabel,
  groupPoints,
  isValidLatLng,
  pillHtml,
  type PillGroup,
  type PropertyMapPoint,
} from "./propertyMapShared";
import { MiniPropertyCard } from "./MiniPropertyCard";
import { MiniGroupCard } from "./MiniGroupCard";
import { MapBuildingCard } from "@/components/building/MapBuildingCard";
import { MAX_VIEW_SPAN_DEG, mapBuildingsApi, type MapBuilding } from "@/lib/api/buildingModel";
import { centroid, openRing } from "@/lib/buildingGeometry";
import { listingsApi, type PriceGridResult, type PublicListingFilters } from "@/lib/api/listings";
import {
  PRICE_CELLS,
  PRICE_FILL,
  PRICE_LABEL,
  PRICE_LINE,
  PRICE_POINTS,
  priceGeoJson,
} from "./priceLayer";
import { PriceLegend } from "./PriceLegend";

interface Props {
  points: PropertyMapPoint[];
  hoveredId: string | null;
  onHoverPoint: (id: string | null) => void;
  onClickPoint: (id: string) => void;
  defaultCenter: [number, number];
  className?: string;
  userLocation?: LatLng | null;
  searchCenter?: LatLng | null;
  onSearchCenterChange?: (c: LatLng) => void;
  radiusMeters?: number | null;
  /** Vùng "đi tới được trong X phút" (Isochrone). Có thì vẽ vùng này thay cho vòng bán kính. */
  areaPolygon?: [number, number][] | null;
  onMapReady?: (api: MapViewApi) => void;
  onShowSearchAreaButtonChange?: (show: boolean) => void;
  /** Nhãn nổi trên ghim tâm tìm kiếm, ví dụ "Chỗ làm" — cho biết ghim đó là gì. */
  searchCenterLabel?: string | null;
  /** Nội dung thêm dưới thẻ xem nhanh của một tin (ví dụ thời gian đi tới chỗ làm). */
  popupExtra?: (point: PropertyMapPoint) => ReactNode;
  /** GL hỏng hẳn (token, hạn mức) — lớp bọc đổi sang bản Leaflet. */
  onFatalError?: () => void;
  /** Loại tin đang tìm — khối toà nhà 3D chỉ hiện toà nhà có tin loại này. */
  listingType?: 1 | 2 | null;
  /** Bộ lọc đang tìm — lớp giá/m² gom đúng những tin khớp bộ lọc này. Không có thì ẩn nút. */
  priceFilters?: PublicListingFilters | null;
}

const PRICE_LAYERS = [PRICE_FILL, PRICE_LINE, PRICE_LABEL] as const;

const RADIUS_SOURCE = "kgs-search-radius";
/** Khối nhà 3D nền của Mapbox — chỉ bật ở chế độ 3D. */
const CTX_BUILDINGS = "kgs-search-ctx-buildings";
/** Toà nhà có mô hình công khai (dữ liệu của KGS). */
const MODEL_BUILDINGS = "kgs-search-model-buildings";
/** Gần hơn mức này mới tải và hiện khối toà nhà — xa hơn thì khối chỉ là chấm nhỏ. */
const BUILDINGS_MIN_ZOOM = 14.5;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function buildingsFC(list: MapBuilding[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: list
      .map((b) => ({ b, ring: openRing(b.footprint) }))
      .filter(({ ring }) => ring.length >= 3)
      .map(({ b, ring }) => ({
        type: "Feature" as const,
        properties: {
          assetId: b.assetId,
          height: b.floors * b.floorHeightMeters,
          // Còn căn trống → xanh lá; đang đăng tin nhưng không khai căn trống → xanh dương.
          color: b.vacantCount > 0 ? "#10b981" : "#3b82f6",
        },
        geometry: { type: "Polygon" as const, coordinates: [[...ring, ring[0]]] },
      })),
  };
}

/** Bật/tắt trạng thái trên viên giá có sẵn — đổi lớp thay vì dựng lại để hiệu ứng chuyển mượt. */
function setPillState(el: HTMLElement, hovered: boolean, active: boolean) {
  const pill = el.firstElementChild as HTMLElement | null;
  pill?.classList.toggle("is-hover", hovered);
  pill?.classList.toggle("is-active", active);
  el.style.zIndex = active ? "11" : hovered ? "10" : "";
}

/**
 * Popup của GL không tự kéo bản đồ như Leaflet: viên giá gần mép thì thẻ (cao ~340px) tràn ra
 * ngoài khung. Gọi sau khi React đã vẽ nội dung thẻ, dịch bản đồ vừa đủ cho thẻ lọt vào. Mép
 * dưới chừa rộng hơn vì nút "Tìm nhà theo thời gian đi làm" nổi ở góc dưới khung bản đồ.
 */
function panPopupIntoView(map: mapboxgl.Map, popup: mapboxgl.Popup) {
  const el = popup.getElement();
  if (!el || !popup.isOpen()) return;
  const box = el.getBoundingClientRect();
  const frame = map.getContainer().getBoundingClientRect();
  const pad = { top: 12, right: 12, bottom: 56, left: 12 };
  const shift = (start: number, end: number, min: number, max: number) =>
    start < min ? start - min : end > max ? Math.min(end - max, start - min) : 0;
  const dx = shift(box.left, box.right, frame.left + pad.left, frame.right - pad.right);
  const dy = shift(box.top, box.bottom, frame.top + pad.top, frame.bottom - pad.bottom);
  if (dx || dy) map.panBy([dx, dy], { duration: 300 });
}

function ariaFor(g: PillGroup): string {
  return g.points.length === 1
    ? `Tin đăng giá ${groupLabel(g)}`
    : `${g.points.length} tin đăng cùng vị trí, giá ${groupLabel(g).replace(/^.*· /, "")}`;
}

function userDot(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Vị trí hiện tại của bạn");
  el.style.cssText =
    "width:16px;height:16px;border-radius:50%;background:#4285F4;border:3px solid white;box-shadow:0 0 0 2px rgba(66,133,244,0.35), 0 1px 4px rgba(0,0,0,0.3);";
  return el;
}

function searchPin(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Kéo để đổi vị trí tìm kiếm");
  el.style.cssText = "cursor:grab;display:flex;flex-direction:column;align-items:center;";
  // Nhãn trên đầu ghim: ghim trơn không nói nó là gì — người dùng không biết đó là "chỗ làm
  // của tôi" hay chỉ là một điểm bấm nhầm.
  const tag = document.createElement("span");
  tag.dataset.role = "label";
  tag.style.cssText =
    "display:none;margin-bottom:2px;padding:1px 7px;border-radius:999px;background:var(--color-primary);color:var(--color-primary-foreground);font:600 11px/18px var(--font-sans, system-ui);white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25);";
  el.appendChild(tag);
  const svg = document.createElement("span");
  svg.innerHTML = `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.7 0 0 6.7 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.7 23.3 0 15 0z" fill="var(--color-primary)"/><circle cx="15" cy="15" r="6" fill="white"/></svg>`;
  el.appendChild(svg);
  return el;
}

export default function GlPropertyMap({
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
  areaPolygon,
  searchCenterLabel,
  popupExtra,
  onMapReady,
  onShowSearchAreaButtonChange,
  onFatalError,
  listingType = null,
  priceFilters = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);

  // Callback mới nhất, đọc qua ref: sự kiện gắn MỘT lần lúc dựng marker/bản đồ không được
  // giữ closure cũ (lúc đó searchCenter còn null, hoveredId còn cũ...).
  const cb = useRef({
    onHoverPoint,
    onClickPoint,
    onSearchCenterChange,
    onShowSearchAreaButtonChange,
    onFatalError,
    searchCenter,
  });
  cb.current = {
    onHoverPoint,
    onClickPoint,
    onSearchCenterChange,
    onShowSearchAreaButtonChange,
    onFatalError,
    searchCenter,
  };

  // Mỗi viên giá là một NHÓM tin chung toạ độ (xem groupPoints), khoá theo toạ độ.
  const pillsRef = useRef(
    new Map<string, { marker: mapboxgl.Marker; el: HTMLElement; group: PillGroup }>(),
  );
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [popupHost, setPopupHost] = useState<HTMLElement | null>(null);
  /** Các tin của viên giá đang mở — một tin thì thẻ xem nhanh, nhiều tin thì danh sách. */
  const [popupPoints, setPopupPoints] = useState<PropertyMapPoint[] | null>(null);
  /** Viên giá đang mở thẻ — giữ sáng để người dùng biết thẻ đang nói về điểm nào. */
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // ---- Toà nhà 3D ----
  const [is3D, setIs3D] = useState(false);
  const [buildings, setBuildings] = useState<MapBuilding[]>([]);
  const buildingsRef = useRef<MapBuilding[]>([]);
  buildingsRef.current = buildings;
  const typeRef = useRef(listingType);
  typeRef.current = listingType;
  const loadBuildingsRef = useRef<() => void>(() => {});
  const buildingPopupRef = useRef<mapboxgl.Popup | null>(null);
  const [buildingHost, setBuildingHost] = useState<HTMLElement | null>(null);
  const [popupBuilding, setPopupBuilding] = useState<MapBuilding | null>(null);

  // ---- Lớp giá/m² ----
  const [priceOn, setPriceOn] = useState(false);
  const [grid, setGrid] = useState<PriceGridResult | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const priceOnRef = useRef(priceOn);
  priceOnRef.current = priceOn;
  const priceFiltersRef = useRef(priceFilters);
  priceFiltersRef.current = priceFilters;
  const loadPriceRef = useRef<() => void>(() => {});

  // ---------------- Dựng bản đồ (một lần) ----------------
  useEffect(() => {
    if (!containerRef.current) return;
    const start = searchCenter ?? { lat: defaultCenter[0], lng: defaultCenter[1] };
    const map = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: MAPBOX_TOKEN,
      style: GL_STYLES.streets,
      language: "vi",
      locale: GL_LOCALE_VI,
      center: [start.lng, start.lat],
      zoom: searchCenter ? 13.5 : 11.5,
      // Không xoay, không nghiêng: trang tìm nhà cần một mặt phẳng dễ đọc, không cần 3D.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");

    map.on("error", (e) => {
      if (isFatalGlError(e as unknown as { error?: { status?: number; message?: string } })) {
        cb.current.onFatalError?.();
      }
    });

    map.on("load", () => {
      map.addSource(RADIUS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: `${RADIUS_SOURCE}-fill`,
        type: "fill",
        source: RADIUS_SOURCE,
        paint: { "fill-color": "#1f2f6b", "fill-opacity": 0.06 },
      });
      map.addLayer({
        id: `${RADIUS_SOURCE}-line`,
        type: "line",
        source: RADIUS_SOURCE,
        paint: { "line-color": "#1f2f6b", "line-width": 1 },
      });

      // Lớp giá/m²: ô lưới tô theo trung vị giá/m², nhãn đặt ở trọng tâm các tin trong ô. Nằm
      // dưới khối toà nhà và dưới viên giá (marker HTML luôn nổi trên canvas).
      map.addSource(PRICE_CELLS, { type: "geojson", data: EMPTY_FC });
      map.addSource(PRICE_POINTS, { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: PRICE_FILL,
        type: "fill",
        source: PRICE_CELLS,
        layout: { visibility: "none" },
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["case", ["get", "reliable"], 0.4, 0.18],
        },
      });
      map.addLayer({
        id: PRICE_LINE,
        type: "line",
        source: PRICE_CELLS,
        layout: { visibility: "none" },
        paint: { "line-color": ["get", "color"], "line-width": 1, "line-opacity": 0.8 },
      });
      map.addLayer({
        id: PRICE_LABEL,
        type: "symbol",
        source: PRICE_POINTS,
        layout: {
          visibility: "none",
          "text-field": ["get", "label"],
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-size": 11.5,
          "text-line-height": 1.15,
          // Ô nhiều tin được ưu tiên giữ nhãn khi hai nhãn chạm nhau.
          "symbol-sort-key": ["-", ["get", "count"]],
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.8,
        },
      });

      // Khối nhà nền 3D (chỉ hiện khi bật 3D) và toà nhà có mô hình của KGS (luôn hiện khi
      // đủ gần: nhìn thẳng từ trên xuống chúng là các mảng màu đánh dấu toà nhà xem 3D được).
      map.addLayer({
        id: CTX_BUILDINGS,
        type: "fill-extrusion",
        source: "composite",
        "source-layer": "building",
        minzoom: 14,
        filter: ["==", ["get", "extrude"], "true"],
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": "#e2e8f0",
          "fill-extrusion-height": ["coalesce", ["get", "height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
          "fill-extrusion-opacity": 0.65,
        },
      });
      map.addSource(MODEL_BUILDINGS, { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: MODEL_BUILDINGS,
        type: "fill-extrusion",
        source: MODEL_BUILDINGS,
        minzoom: BUILDINGS_MIN_ZOOM,
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.9,
        },
      });
      setReady(true);
      loadBuildingsRef.current();
      onMapReady?.({
        getCenter: () => {
          const c = map.getCenter();
          return { lat: c.lat, lng: c.lng };
        },
        getViewRadiusMeters: () => {
          const c = map.getCenter();
          const ne = map.getBounds()?.getNorthEast();
          return ne ? distanceMeters({ lat: c.lat, lng: c.lng }, { lat: ne.lat, lng: ne.lng }) : 0;
        },
        flyTo: (lat, lng, zoom) =>
          map.flyTo({ center: [lng, lat], zoom: zoom ?? 15, duration: 700 }),
      });
    });

    // Bấm vào khối toà nhà → cửa sổ toà nhà. Bấm chỗ khác của bản đồ (không phải viên giá)
    // → đổi tâm tìm kiếm.
    map.on("click", (e) => {
      // Lớp giá đang bật: bấm vào một ô → phóng tới ô đó, không đổi tâm tìm kiếm.
      if (priceOnRef.current && map.getLayer(PRICE_FILL)) {
        const cell = map.queryRenderedFeatures(e.point, { layers: [PRICE_FILL] })[0];
        if (cell?.properties) {
          const p = cell.properties as { west: number; south: number; east: number; north: number };
          map.fitBounds(
            [
              [p.west, p.south],
              [p.east, p.north],
            ],
            { padding: 60, maxZoom: 16, duration: 600 },
          );
          return;
        }
      }
      const hit = map.getLayer(MODEL_BUILDINGS)
        ? map.queryRenderedFeatures(e.point, { layers: [MODEL_BUILDINGS] })[0]
        : undefined;
      const b = hit && buildingsRef.current.find((x) => x.assetId === hit.properties?.assetId);
      if (b) {
        setPopupBuilding(b);
        buildingPopupRef.current?.setLngLat(e.lngLat).addTo(map);
        return;
      }
      cb.current.onSearchCenterChange?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    map.on("mouseenter", MODEL_BUILDINGS, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", MODEL_BUILDINGS, () => (map.getCanvas().style.cursor = ""));
    map.on("mouseenter", PRICE_FILL, () => (map.getCanvas().style.cursor = "zoom-in"));
    map.on("mouseleave", PRICE_FILL, () => (map.getCanvas().style.cursor = ""));

    // Lớp giá: tải lại lưới sau mỗi lần dừng kéo/phóng. Huỷ lượt cũ nếu lượt mới tới.
    let priceCtrl: AbortController | null = null;
    loadPriceRef.current = () => {
      const f = priceFiltersRef.current;
      const bounds = map.getBounds();
      if (!priceOnRef.current || !f?.type || !bounds || !map.getSource(PRICE_CELLS)) return;
      priceCtrl?.abort();
      const ctrl = new AbortController();
      priceCtrl = ctrl;
      setPriceLoading(true);
      setPriceError(false);
      const clampLng = (v: number) => Math.max(-180, Math.min(180, v));
      const clampLat = (v: number) => Math.max(-85, Math.min(85, v));
      listingsApi
        .priceGrid(
          f,
          {
            west: +clampLng(bounds.getWest()).toFixed(5),
            south: +clampLat(bounds.getSouth()).toFixed(5),
            east: +clampLng(bounds.getEast()).toFixed(5),
            north: +clampLat(bounds.getNorth()).toFixed(5),
          },
          map.getZoom(),
          ctrl.signal,
        )
        .then((g) => {
          if (ctrl.signal.aborted) return;
          setGrid(g);
          setPriceLoading(false);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          setPriceError(true);
          setPriceLoading(false);
        });
    };
    map.on("moveend", () => loadPriceRef.current());

    // Tải toà nhà trong khung nhìn sau mỗi lần dừng kéo/phóng. Huỷ lượt cũ nếu lượt mới tới.
    let ctrl: AbortController | null = null;
    loadBuildingsRef.current = () => {
      if (!map.getSource(MODEL_BUILDINGS)) return;
      const bounds = map.getBounds();
      if (!bounds || map.getZoom() < BUILDINGS_MIN_ZOOM) return;
      const box = {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      };
      if (box.east - box.west > MAX_VIEW_SPAN_DEG || box.north - box.south > MAX_VIEW_SPAN_DEG)
        return;
      ctrl?.abort();
      ctrl = new AbortController();
      mapBuildingsApi
        .inView(box, typeRef.current ?? null, ctrl.signal)
        .then(setBuildings)
        .catch(() => {
          // Lỗi mạng hay bị huỷ: giữ khối đang có, lần kéo sau thử lại.
        });
    };
    map.on("moveend", () => loadBuildingsRef.current());

    map.on("moveend", (e) => {
      const { searchCenter: sc, onShowSearchAreaButtonChange: show } = cb.current;
      if (!sc || !show) return;
      // Chỉ tính những lần NGƯỜI DÙNG kéo/phóng (sự kiện có originalEvent). Bản đồ tự căn
      // khung theo vùng đi lại thì tâm khung lệch khỏi ghim — không phải lý do để mời
      // "Tìm trong khu vực này".
      if (!e.originalEvent) {
        show(false);
        return;
      }
      const c = map.getCenter();
      show(distanceMeters({ lat: c.lat, lng: c.lng }, sc) > MOVE_THRESHOLD_METERS);
    });

    // Khung bản đồ đổi cỡ (kéo thanh chia danh sách/bản đồ, sheet trên điện thoại) mà không
    // đổi cỡ cửa sổ — GL chỉ tự nghe cửa sổ, nên theo dõi chính khung chứa.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    const host = document.createElement("div");
    setPopupHost(host);
    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      // Luôn mở phía trên viên giá, cách đủ chiều cao viên giá (~34px) để không đè lên nó.
      // Không để GL tự chọn hướng: hướng tự chọn đổi theo vị trí, nên sau khi kéo bản đồ cho
      // thẻ lọt khung thì GL lật thẻ sang phía kia và thẻ lại tràn ra mép đối diện.
      anchor: "bottom",
      offset: 40,
      maxWidth: "300px",
      className: "kgs-listing-popup",
    }).setDOMContent(host);
    popup.on("close", () => {
      setPopupPoints(null);
      setActiveKey(null);
    });
    popupRef.current = popup;

    const bHost = document.createElement("div");
    setBuildingHost(bHost);
    const bPopup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 8,
      maxWidth: "260px",
    }).setDOMContent(bHost);
    bPopup.on("close", () => setPopupBuilding(null));
    buildingPopupRef.current = bPopup;

    const pills = pillsRef.current;
    return () => {
      ro.disconnect();
      pills.forEach((p) => p.marker.remove());
      pills.clear();
      popup.remove();
      bPopup.remove();
      ctrl?.abort();
      priceCtrl?.abort();
      map.remove();
      mapRef.current = null;
    };
    // Dựng một lần; các thay đổi sau đi qua những effect bên dưới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Viên giá ----------------
  const validKey = points
    .filter((p) => isValidLatLng(p.lat, p.lng))
    .map((p) => `${p.id}:${p.price}:${p.type}`)
    .join(",");

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pills = pillsRef.current;
    // Toạ độ hỏng bị bỏ qua thay vì làm sập bản đồ — cùng nguyên tắc với bản Leaflet.
    const groups = groupPoints(points);
    const keep = new Set(groups.map((g) => g.key));

    for (const [key, entry] of pills) {
      if (!keep.has(key)) {
        entry.marker.remove();
        pills.delete(key);
      }
    }

    for (const g of groups) {
      const existing = pills.get(g.key);
      if (existing) {
        existing.group = g;
        // Giữ nguyên trạng thái sáng hiện có — effect hover bên dưới không chạy lại ở đây.
        const pill = existing.el.firstElementChild;
        existing.el.innerHTML = pillHtml(g, {
          hovered: pill?.classList.contains("is-hover"),
          active: pill?.classList.contains("is-active"),
        });
        existing.el.setAttribute("aria-label", ariaFor(g));
        continue;
      }
      const el = document.createElement("div");
      el.className = "property-pill-marker kgs-pill-host";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", ariaFor(g));
      el.innerHTML = pillHtml(g);
      // Rê vào viên gộp: làm nổi thẻ của tin rẻ nhất — tin mà viên giá đang ghi "từ".
      el.addEventListener("mouseenter", () =>
        cb.current.onHoverPoint((pills.get(g.key)?.group ?? g).points[0].id),
      );
      el.addEventListener("mouseleave", () => cb.current.onHoverPoint(null));
      const open = (e: Event) => {
        // Chặn không cho cú bấm lọt xuống bản đồ — nếu lọt, bản đồ hiểu là "đổi tâm tìm kiếm".
        e.stopPropagation();
        const cur = pills.get(g.key)?.group ?? g;
        cb.current.onClickPoint(cur.points[0].id);
        const withCard = cur.points.filter((x) => x.slug && x.title);
        if (withCard.length && popupRef.current) {
          // Đóng thẻ đang mở TRƯỚC khi đặt nội dung mới: sự kiện "close" của nó xoá
          // popupPoints/activeKey — chạy sau thì thẻ mới mở ra rỗng.
          popupRef.current.remove();
          setPopupPoints(withCard);
          setActiveKey(g.key);
          popupRef.current.setLngLat([cur.lng, cur.lat]).addTo(map);
        }
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") open(e);
      });

      // Neo ở mũi nhọn dưới đáy viên giá — mũi nhọn chỉ đúng vào vị trí căn nhà.
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([g.lng, g.lat])
        .addTo(map);
      pills.set(g.key, { marker, el, group: g });
    }
    // validKey gói đủ thứ làm marker đổi; `points` đổi identity mỗi lần vẽ thì không.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validKey]);

  // Hover: đổi style NGAY trên phần tử có sẵn, không dựng lại marker — dựng lại sẽ làm popup
  // đang mở mất chỗ neo và gây nháy. Viên gộp sáng lên khi rê vào BẤT KỲ tin nào của nó.
  useEffect(() => {
    for (const [key, { el, group }] of pillsRef.current) {
      setPillState(el, groupHovered(group, hoveredId), key === activeKey);
    }
  }, [hoveredId, activeKey, validKey]);

  // Thẻ vừa có nội dung (React đã commit vào khung popup) → kéo bản đồ cho thẻ lọt khung.
  useEffect(() => {
    const map = mapRef.current;
    if (map && popupRef.current && popupPoints) panPopupIntoView(map, popupRef.current);
  }, [popupPoints]);

  const areaKey = areaPolygon ? `${areaPolygon.length}:${areaPolygon[0]?.join(",")}` : "";

  // ---------------- Căn khung theo các tin ----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const valid = points.filter((p) => isValidLatLng(p.lat, p.lng));
    const b = new mapboxgl.LngLatBounds();
    // Đang tìm theo bán kính: khung phải thấy trọn ghim + vòng tròn, không chỉ vài tin bên
    // trong — nếu không, còn 2 kết quả là bản đồ phóng sát vào chúng, ghim trôi ra ngoài,
    // và tâm lệch khỏi ghim làm nút "Tìm trong khu vực này" bật lên dù người dùng chưa kéo.
    const cur = cb.current.searchCenter;
    if (areaPolygon && areaPolygon.length > 2) {
      areaPolygon.forEach(([lng, lat]) => b.extend([lng, lat]));
      if (cur) b.extend([cur.lng, cur.lat]);
    } else if (cur && radiusMeters != null) {
      for (const [lng, lat] of circlePolygon(cur, radiusMeters, 16).geometry.coordinates[0]) {
        b.extend([lng, lat]);
      }
    } else if (valid.length === 0) {
      return;
    } else if (valid.length === 1) {
      map.flyTo({ center: [valid[0].lng, valid[0].lat], zoom: 14, duration: 500 });
      return;
    }
    valid.forEach((p) => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: 40, maxZoom: 15, duration: 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, points.map((p) => p.id).join(","), areaKey]);

  // ---------------- Tâm tìm kiếm: bay tới, ghim, vòng bán kính ----------------
  const lastFlown = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchCenter) return;
    const key = `${searchCenter.lat.toFixed(5)},${searchCenter.lng.toFixed(5)}`;
    if (lastFlown.current === key) return;
    lastFlown.current = key;
    map.flyTo({
      center: [searchCenter.lng, searchCenter.lat],
      zoom: Math.max(map.getZoom(), 13.5),
      duration: 700,
    });
  }, [searchCenter]);

  const pinRef = useRef<mapboxgl.Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!searchCenter) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    if (!pinRef.current) {
      const pin = new mapboxgl.Marker({ element: searchPin(), anchor: "bottom", draggable: true });
      pin.on("dragend", () => {
        const ll = pin.getLngLat();
        cb.current.onSearchCenterChange?.({ lat: ll.lat, lng: ll.lng });
      });
      pinRef.current = pin;
    }
    pinRef.current.setLngLat([searchCenter.lng, searchCenter.lat]).addTo(map);
    const tag = pinRef.current.getElement().querySelector<HTMLElement>('[data-role="label"]');
    if (tag) {
      tag.textContent = searchCenterLabel ?? "";
      tag.style.display = searchCenterLabel ? "block" : "none";
    }
  }, [searchCenter, searchCenterLabel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(RADIUS_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    src?.setData(
      areaPolygon && areaPolygon.length > 2
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [areaPolygon] },
          }
        : radiusMeters != null && searchCenter
          ? circlePolygon(searchCenter, radiusMeters)
          : { type: "FeatureCollection", features: [] },
    );
    // Vùng đi lại có hình dạng thật (men theo đường sá), nên tô đậm hơn vòng tròn một chút
    // để người dùng thấy rõ nó không phải một vòng tròn.
    map.setPaintProperty(`${RADIUS_SOURCE}-fill`, "fill-opacity", areaPolygon ? 0.12 : 0.06);
    map.setPaintProperty(`${RADIUS_SOURCE}-line`, "line-width", areaPolygon ? 2 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, radiusMeters, searchCenter, areaKey]);

  // ---------------- Toà nhà 3D ----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource(MODEL_BUILDINGS) as mapboxgl.GeoJSONSource).setData(buildingsFC(buildings));
  }, [ready, buildings]);

  // Đổi Bán/Thuê → tải lại toà nhà theo loại tin mới.
  useEffect(() => {
    if (ready) loadBuildingsRef.current();
  }, [ready, listingType]);

  // Bật/tắt 3D: nghiêng bản đồ, cho xoay, hiện khối nhà nền. Ẩn khối nhà nền nằm dưới toà
  // nhà có mô hình để hai khối không chồng lên nhau.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty(CTX_BUILDINGS, "visibility", is3D ? "visible" : "none");
    if (is3D) {
      map.dragRotate.enable();
      map.easeTo({ pitch: 55, zoom: Math.max(map.getZoom(), 17), duration: 700 });
    } else {
      map.dragRotate.disable();
      map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    }
  }, [ready, is3D]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !is3D) return;
    const base: mapboxgl.FilterSpecification = ["==", ["get", "extrude"], "true"];
    map.setFilter(CTX_BUILDINGS, base);
    const apply = () => {
      const ids = new Set<string | number>();
      for (const b of buildings) {
        const c = centroid(openRing(b.footprint));
        for (const f of map.queryRenderedFeatures(map.project(c), { layers: [CTX_BUILDINGS] }))
          if (f.id != null) ids.add(f.id);
      }
      if (ids.size)
        map.setFilter(CTX_BUILDINGS, ["all", base, ["!", ["in", ["id"], ["literal", [...ids]]]]]);
    };
    map.once("idle", apply);
    map.triggerRepaint();
  }, [ready, is3D, buildings]);

  // ---------------- Lớp giá/m² ----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const id of PRICE_LAYERS)
      map.setLayoutProperty(id, "visibility", priceOn ? "visible" : "none");
    if (!priceOn) {
      setGrid(null);
      setPriceError(false);
      return;
    }
    // Viên giá ẩn khi lớp giá bật (xem lớp kgs-price-mode) — thẻ đang mở của một viên giá
    // không còn chỗ neo nên đóng luôn.
    popupRef.current?.remove();
    // Lớp giá để nhìn TOÀN CẢNH: đang phóng sát vài dãy nhà thì lùi ra mức quận.
    if (map.getZoom() > 13.5) map.easeTo({ zoom: 12.5, duration: 600 });
    else loadPriceRef.current();
  }, [ready, priceOn]);

  // Đổi bộ lọc (loại tin, khoảng giá, loại hình...) → tính lại lưới cho đúng tập tin mới.
  const priceFiltersKey = JSON.stringify(priceFilters ?? null);
  useEffect(() => {
    if (ready && priceOn) loadPriceRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceFiltersKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const fc = grid ? priceGeoJson(grid) : { cells: EMPTY_FC, points: EMPTY_FC };
    (map.getSource(PRICE_CELLS) as mapboxgl.GeoJSONSource | undefined)?.setData(fc.cells);
    (map.getSource(PRICE_POINTS) as mapboxgl.GeoJSONSource | undefined)?.setData(fc.points);
  }, [ready, grid]);

  // ---------------- Chấm GPS ----------------
  const dotRef = useRef<mapboxgl.Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      dotRef.current?.remove();
      dotRef.current = null;
      return;
    }
    if (!dotRef.current)
      dotRef.current = new mapboxgl.Marker({ element: userDot(), anchor: "center" });
    dotRef.current.setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
  }, [userLocation]);

  return (
    <div
      className={[className, priceOn ? "kgs-price-mode" : ""].filter(Boolean).join(" ")}
      style={{
        height: "100%",
        width: "100%",
        position: "relative",
        isolation: "isolate",
        zIndex: 0,
      }}
    >
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      <button
        type="button"
        onClick={() => setIs3D((v) => !v)}
        aria-pressed={is3D}
        title={
          is3D
            ? "Về bản đồ phẳng"
            : "Xem 3D: khối toà nhà và các toà nhà xem được từng tầng, từng căn"
        }
        className={`absolute right-2 top-[118px] z-10 rounded-md md:top-2 border px-2.5 py-1.5 text-xs font-semibold shadow-sm ${
          is3D ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
        }`}
      >
        {is3D ? "2D" : "3D"}
        {!is3D && buildings.length > 0 && (
          <span className="ml-1 rounded-full bg-emerald-500 px-1.5 text-[10px] text-white">
            {buildings.length}
          </span>
        )}
      </button>
      {priceFilters && (
        <button
          type="button"
          onClick={() => setPriceOn((v) => !v)}
          aria-pressed={priceOn}
          title={
            priceOn
              ? "Tắt lớp giá, xem lại từng tin"
              : "Lớp giá/m²: gom tin theo khu, tô màu theo giá trung vị mỗi m²"
          }
          className={`absolute right-2 top-[152px] z-10 rounded-md md:top-[42px] border px-2.5 py-1.5 text-xs font-semibold shadow-sm ${
            priceOn
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card hover:bg-accent"
          }`}
        >
          Giá/m²
        </button>
      )}
      {priceOn && (
        // Màn rộng: góc dưới phải — góc trên đã có nút điều khiển, góc dưới trái có nút "tìm theo
        // thời gian đi làm". Điện thoại: khung danh sách kéo lên che đáy bản đồ, nên dùng bản
        // gọn ở góc trên trái, ngay dưới hàng bộ lọc.
        <>
          <div className="absolute bottom-7 right-2 z-10 hidden md:block">
            <PriceLegend
              grid={grid}
              listingType={listingType}
              loading={priceLoading}
              error={priceError}
            />
          </div>
          <div className="absolute left-2 top-[160px] z-10 md:hidden">
            <PriceLegend
              compact
              grid={grid}
              listingType={listingType}
              loading={priceLoading}
              error={priceError}
            />
          </div>
        </>
      )}
      {/* Thẻ xem nhanh render bằng React qua portal vào khung popup của GL — nhờ vậy nó vẫn
          nằm trong cây component và dùng được Link của router. */}
      {popupHost &&
        popupPoints &&
        createPortal(
          <>
            {popupPoints.length === 1 ? (
              <MiniPropertyCard point={popupPoints[0]} />
            ) : (
              <MiniGroupCard points={popupPoints} />
            )}
            {/* Chung một vị trí nên thời gian đi lại của tin đầu đúng cho cả nhóm. */}
            {popupExtra && <div className="px-3 pb-3">{popupExtra(popupPoints[0])}</div>}
          </>,
          popupHost,
        )}
      {buildingHost &&
        popupBuilding &&
        createPortal(<MapBuildingCard b={popupBuilding} />, buildingHost)}
    </div>
  );
}
