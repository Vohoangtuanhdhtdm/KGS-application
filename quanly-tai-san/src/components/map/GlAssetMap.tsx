// Bản đồ danh mục tài sản chạy bằng Mapbox GL JS — thay cho AssetMap (Leaflet), giữ nguyên
// props và cách mã hoá (vòng giá trị, màu trạng thái, cụm tô theo trạng thái đa số, spotlight
// + thẻ xem nhanh). Client-only, nạp lười qua AssetMapClient.
//
// Gom cụm: GL gom sẵn trong nguồn GeoJSON (`cluster: true`), không cần plugin. Nhưng lớp vẽ
// của GL chỉ vẽ được hình tròn phẳng, không vẽ được vòng giá trị có chấm, không "thở", không
// focus bằng bàn phím — nên dùng marker HTML, dựng lại theo những gì nguồn đang hiển thị mỗi
// lần bản đồ vẽ (cách Mapbox hướng dẫn cho cụm tuỳ biến).
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetStatusCode } from "@/constants/enums";
import { formatCurrency } from "@/lib/format";
import { prefersReducedMotion } from "@/lib/motion";
import { GL_LOCALE_VI, GL_STYLES, MAPBOX_TOKEN, isFatalGlError } from "@/lib/mapEngine";
import type { AssetMapProps } from "./AssetMap";
import {
  FALLBACK_CENTER,
  MAX_CLUSTER_RADIUS,
  clusterHtml,
  hasLocation,
  makeRingRadius,
  ringInnerHtml,
  snapRadius,
  type LocatedAsset,
} from "./assetMapShared";
import { SelectionOverlay } from "./AssetSelectionOverlay";

const SOURCE = "kgs-assets";
const STATUSES: AssetStatusCode[] = [1, 2, 3, 4, 5, 6];

interface Props extends AssetMapProps {
  onFatalError?: () => void;
}

type PointProps = { id: string; status: AssetStatusCode; r: number; alive: boolean };

function toGeoJson(
  items: LocatedAsset[],
  radiusOf: (v: number | null) => number,
  isAlive: (id: string) => boolean,
): GeoJSON.FeatureCollection<GeoJSON.Point, PointProps> {
  return {
    type: "FeatureCollection",
    features: items.map((a) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [a.longitude, a.latitude] },
      properties: {
        id: a.id,
        status: a.status,
        r: snapRadius(radiusOf(a.currentValue)),
        alive: isAlive(a.id),
      },
    })),
  };
}

export default function GlAssetMap({
  items,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  onCloseSelection,
  onOpenDetail,
  income,
  rightInset = 380,
  onFatalError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  const located = items.filter(hasLocation);
  const radiusOf = makeRingRadius(located);
  const selected = located.find((a) => a.id === selectedId) ?? null;
  const isAlive = (id: string) => income[id]?.hasRecentIncome === true;

  // Đọc bản mới nhất qua ref: marker dựng trong vòng "render" của GL, không phải trong React.
  const live = useRef({ located, onHover, onSelect, onFatalError, hoveredId, selectedId });
  live.current = { located, onHover, onSelect, onFatalError, hoveredId, selectedId };

  const pointMarkers = useRef(
    new Map<string, { marker: mapboxgl.Marker; el: HTMLElement; key: string }>(),
  );
  const clusterMarkers = useRef(new Map<number, { marker: mapboxgl.Marker; key: string }>());
  const tooltip = useRef<mapboxgl.Popup | null>(null);

  // ---------------- Dựng bản đồ ----------------
  useEffect(() => {
    if (!containerRef.current) return;
    const m = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: MAPBOX_TOKEN,
      // Nền "light": gần như đơn sắc — điều kiện để panel trắng bán trong suốt bên trên đọc rõ.
      style: GL_STYLES.light,
      language: "vi",
      locale: GL_LOCALE_VI,
      center: [FALLBACK_CENTER[1], FALLBACK_CENTER[0]],
      zoom: 11,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    m.touchZoomRotate.disableRotation();
    m.on("error", (e) => {
      if (isFatalGlError(e as unknown as { error?: { status?: number; message?: string } })) {
        live.current.onFatalError?.();
      }
    });
    m.on("load", () => {
      m.addSource(SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: MAX_CLUSTER_RADIUS,
        clusterMaxZoom: 16,
        // Đếm số tài sản theo từng trạng thái trong mỗi cụm → tô cụm theo trạng thái đa số.
        clusterProperties: Object.fromEntries(
          STATUSES.map((s) => [`s${s}`, ["+", ["case", ["==", ["get", "status"], s], 1, 0]]]),
        ),
      });
      // Lớp vô hình: GL chỉ nạp dữ liệu nguồn khi có ít nhất một lớp dùng nó. Hình thật là
      // marker HTML bên dưới.
      m.addLayer({
        id: `${SOURCE}-anchor`,
        type: "circle",
        source: SOURCE,
        paint: { "circle-radius": 0, "circle-opacity": 0 },
      });
      setLoaded(true);
    });
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(containerRef.current);
    tooltip.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "asset-tooltip",
      anchor: "bottom",
    });
    setMap(m);
    const points = pointMarkers.current;
    const clusters = clusterMarkers.current;
    return () => {
      ro.disconnect();
      points.forEach((p) => p.marker.remove());
      points.clear();
      clusters.forEach((c) => c.marker.remove());
      clusters.clear();
      tooltip.current?.remove();
      m.remove();
    };
  }, []);

  // ---------------- Dữ liệu ----------------
  const dataKey = located
    .map(
      (a) => `${a.id}:${a.latitude}:${a.longitude}:${a.status}:${a.currentValue}:${isAlive(a.id)}`,
    )
    .join("|");
  useEffect(() => {
    if (!map || !loaded) return;
    (map.getSource(SOURCE) as mapboxgl.GeoJSONSource).setData(
      toGeoJson(located, radiusOf, isAlive),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, loaded, dataKey]);

  // ---------------- Marker HTML theo những gì nguồn đang hiện ----------------
  const makePoint = useCallback((m: mapboxgl.Map, p: PointProps, lngLat: [number, number]) => {
    const el = document.createElement("div");
    el.className = `asset-ring-wrap asset-ring--s${p.status}`;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    const asset = () => live.current.located.find((a) => a.id === p.id);
    el.setAttribute("aria-label", asset()?.name ?? "Tài sản");
    el.innerHTML = ringInnerHtml(p.status, p.r, p.alive, false);

    // Xem nhanh khi rê chuột — không delay, để "lướt" cả danh mục mà không phải click từng cái.
    const showTip = () => {
      const a = asset();
      if (!a || !tooltip.current) return;
      const node = document.createElement("div");
      const name = document.createElement("span");
      name.className = "font-medium";
      name.textContent = a.name;
      node.appendChild(name);
      if (a.currentValue != null) {
        const v = document.createElement("span");
        v.className = "text-muted-foreground";
        v.textContent = ` · ${formatCurrency(a.currentValue, { compact: true })}`;
        node.appendChild(v);
      }
      tooltip.current
        .setOffset(p.r + 4)
        .setLngLat(lngLat)
        .setDOMContent(node)
        .addTo(m);
    };
    el.addEventListener("mouseenter", () => {
      live.current.onHover(p.id);
      showTip();
    });
    el.addEventListener("mouseleave", () => {
      live.current.onHover(null);
      tooltip.current?.remove();
    });
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      tooltip.current?.remove();
      live.current.onSelect(p.id);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") live.current.onSelect(p.id);
    });
    return el;
  }, []);

  useEffect(() => {
    if (!map || !loaded) return;
    const sync = () => {
      if (!map.isSourceLoaded(SOURCE)) return;
      const seenPoints = new Set<string>();
      const seenClusters = new Set<number>();
      const { hoveredId: hov, selectedId: sel } = live.current;

      for (const f of map.querySourceFeatures(SOURCE)) {
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const props = f.properties as Record<string, unknown>;

        if (props.cluster) {
          const cid = props.cluster_id as number;
          if (seenClusters.has(cid)) continue; // một cụm có thể nằm ở nhiều tile
          seenClusters.add(cid);
          const count = props.point_count as number;
          const tally = new Map(STATUSES.map((s) => [s as number, Number(props[`s${s}`] ?? 0)]));
          const key = `${count}|${STATUSES.map((s) => props[`s${s}`]).join(",")}`;
          const existing = clusterMarkers.current.get(cid);
          if (existing?.key === key) continue;
          existing?.marker.remove();

          const el = document.createElement("div");
          el.className = "asset-cluster-wrap";
          el.tabIndex = 0;
          el.setAttribute("role", "button");
          el.setAttribute("aria-label", `Cụm ${count} tài sản, bấm để phóng to`);
          el.innerHTML = clusterHtml(count, tally).html;
          const zoomIn = (e: Event) => {
            e.stopPropagation();
            (map.getSource(SOURCE) as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
              cid,
              (err, z) => {
                if (err || z == null) return;
                map.easeTo({ center: coords, zoom: z, duration: prefersReducedMotion() ? 0 : 500 });
              },
            );
          };
          el.addEventListener("click", zoomIn);
          el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") zoomIn(e);
          });
          const marker = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(map);
          clusterMarkers.current.set(cid, { marker, key });
          continue;
        }

        const p = props as unknown as PointProps;
        if (seenPoints.has(p.id)) continue;
        seenPoints.add(p.id);
        const key = `${p.status}|${p.r}|${p.alive}|${coords.join(",")}`;
        const existing = pointMarkers.current.get(p.id);
        if (existing?.key === key) continue;
        existing?.marker.remove();
        const el = makePoint(map, p, coords);
        el.classList.toggle("asset-ring-wrap--active", p.id === hov || p.id === sel);
        const marker = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(map);
        pointMarkers.current.set(p.id, { marker, el, key });
      }

      // Marker không còn hiện (bị gom vào cụm, trôi khỏi màn hình) → gỡ.
      for (const [id, entry] of pointMarkers.current) {
        if (!seenPoints.has(id)) {
          entry.marker.remove();
          pointMarkers.current.delete(id);
        }
      }
      for (const [cid, entry] of clusterMarkers.current) {
        if (!seenClusters.has(cid)) {
          entry.marker.remove();
          clusterMarkers.current.delete(cid);
        }
      }
    };
    map.on("render", sync);
    sync();
    return () => {
      map.off("render", sync);
    };
  }, [map, loaded, makePoint]);

  // Làm nổi bật bằng class trên phần tử sẵn có — không dựng lại marker (tooltip đang mở sẽ mất).
  useEffect(() => {
    for (const [id, { el }] of pointMarkers.current) {
      el.classList.toggle("asset-ring-wrap--active", id === hoveredId || id === selectedId);
    }
  }, [hoveredId, selectedId]);

  // ---------------- Khung nhìn ----------------
  // Ban đầu vừa bao trọn tài sản; chừa lề phải để marker không nằm khuất dưới panel danh sách.
  const fitted = useRef(false);
  useEffect(() => {
    if (!map || !loaded || fitted.current || located.length === 0) return;
    fitted.current = true;
    if (located.length === 1) {
      map.jumpTo({ center: [located[0].longitude, located[0].latitude], zoom: 14 });
      return;
    }
    const b = new mapboxgl.LngLatBounds();
    located.forEach((a) => b.extend([a.longitude, a.latitude]));
    map.fitBounds(b, {
      padding: { top: 48, left: 48, bottom: 48, right: rightInset },
      maxZoom: 15,
      duration: 0,
    });
  }, [map, loaded, located, rightInset]);

  // Chọn tài sản từ panel danh sách → đưa marker tương ứng vào tầm nhìn.
  const lastPanned = useRef<string | null>(null);
  useEffect(() => {
    if (!map) return;
    if (!selected) {
      lastPanned.current = null;
      return;
    }
    if (lastPanned.current === selected.id) return;
    lastPanned.current = selected.id;
    map.easeTo({
      center: [selected.longitude, selected.latitude],
      zoom: Math.max(map.getZoom(), 13),
      duration: prefersReducedMotion() ? 0 : 500,
    });
  }, [map, selected]);

  // ---------------- Spotlight + thẻ xem nhanh ----------------
  const selLat = selected?.latitude;
  const selLng = selected?.longitude;
  const read = useCallback(() => {
    const c = map!.getContainer();
    const box = c.getBoundingClientRect();
    const pt = map!.project([selLng!, selLat!]);
    return {
      pt: { x: pt.x, y: pt.y },
      size: { x: c.clientWidth, y: c.clientHeight },
      offset: { x: box.left, y: box.top },
    };
  }, [map, selLat, selLng]);
  const subscribe = useCallback(
    (cb: () => void) => {
      map!.on("move", cb);
      map!.on("resize", cb);
      return () => {
        map!.off("move", cb);
        map!.off("resize", cb);
      };
    },
    [map],
  );

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      {map && selected && (
        <SelectionOverlay
          target={selected}
          radius={snapRadius(radiusOf(selected.currentValue))}
          alive={isAlive(selected.id)}
          income={income}
          onClose={onCloseSelection}
          onOpenDetail={onOpenDetail}
          rightInset={rightInset}
          read={read}
          subscribe={subscribe}
        />
      )}
    </div>
  );
}
