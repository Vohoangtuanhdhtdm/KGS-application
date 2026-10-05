// Cảnh 3D của một toà nhà trên Mapbox GL JS — chỉ chạy được trên động cơ GL (nạp lười qua
// BuildingSceneClient). Hai chế độ:
//
//   • có `building`  → toà nhà dựng từ dữ liệu: mỗi căn một khối fill-extrusion, chọn tầng
//                      thì các tầng phía trên mờ đi để lộ mặt bằng tầng đó;
//   • không có       → các khối nhà 3D sẵn có của Mapbox quanh vị trí, toà nhà tại điểm
//                      `highlight` tô màu nổi bật (dùng cho tin chưa có mô hình).
//
// Khối nhà 3D nền lấy từ lớp "building" của nguồn composite (Mapbox Streets v8): có
// `height` / `min_height` cho những toà nhà có dữ liệu chiều cao.
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { GL_LOCALE_VI, GL_STYLES, MAPBOX_TOKEN, isFatalGlError } from "@/lib/mapEngine";
import type { LngLat } from "@/lib/api/buildingModel";
import {
  CELL_COLORS,
  buildCells,
  centroid,
  footprintArea,
  footprintFeature,
  openRing,
  type BuildingInput,
  type CellProps,
} from "@/lib/buildingGeometry";

const CTX = "kgs-ctx-buildings";
const CTX_HL = "kgs-ctx-highlight";
const CELLS = "kgs-cells";
const DRAFT = "kgs-draft";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const SELECTED = "#2563eb";
const GROUND = "kgs-ground";

export type PickMode = "building" | "draw" | null;

export interface BuildingSceneProps {
  building: BuildingInput | null;
  /** Tâm camera khi chưa có khung (vị trí tài sản / tin). */
  center: LngLat;
  /** Chế độ không có mô hình: toà nhà Mapbox tại điểm này được tô nổi bật. */
  highlight?: LngLat | null;
  selectedFloor?: number | null;
  selectedUnitId?: string | null;
  onSelect?: (unitId: string | null, floor: number | null) => void;
  /** Xưởng dựng: bấm vào một toà nhà trên bản đồ để lấy khung, hoặc bấm từng đỉnh để vẽ. */
  pickMode?: PickMode;
  onPickBuilding?: (ring: LngLat[] | null) => void;
  onAddVertex?: (p: LngLat) => void;
  /** Xưởng dựng, lần đầu: tự lấy khung toà nhà Mapbox tại điểm này ngay khi bản đồ vẽ xong. */
  autoPickAt?: LngLat | null;
  /** Khung đang vẽ dở (chưa đủ thành mô hình). */
  draft?: LngLat[];
  height?: number | string;
  /** Nằm giữa trang dài: con lăn cuộn trang, giữ Ctrl mới phóng to. */
  cooperative?: boolean;
  /** Chế độ trình bày cho người xem tin: nhà xung quanh mờ đi, toà nhà nằm giữa khung, đổ
   *  bóng nền, và xoay chậm một vòng cho tới khi người xem chạm vào. Xưởng dựng thì không —
   *  ở đó cần thấy rõ nhà xung quanh để lấy đúng khung. */
  showcase?: boolean;
  onFatalError?: () => void;
}

/** Vòng ngoài lớn nhất của một hình học toà nhà lấy từ tile. */
function outerRing(g: GeoJSON.Geometry): LngLat[] | null {
  const rings: GeoJSON.Position[][] =
    g.type === "Polygon"
      ? [g.coordinates[0]]
      : g.type === "MultiPolygon"
        ? g.coordinates.map((p) => p[0])
        : [];
  let best: LngLat[] | null = null;
  let bestArea = 0;
  for (const r of rings) {
    const ring = openRing(r.map((p) => [p[0], p[1]] as LngLat));
    const a = footprintArea(ring);
    if (a > bestArea) {
      bestArea = a;
      best = ring;
    }
  }
  return best;
}

/** Zoom vừa khít toà nhà: toà càng rộng càng lùi xa. */
function zoomFor(ring: LngLat[]): number {
  const a = footprintArea(ring);
  return a > 0 ? Math.max(16.2, Math.min(19, 20.3 - Math.log2(Math.sqrt(a) / 6))) : 17.5;
}

export default function BuildingScene({
  building,
  center,
  highlight,
  selectedFloor = null,
  selectedUnitId = null,
  onSelect,
  pickMode = null,
  onPickBuilding,
  onAddVertex,
  draft,
  autoPickAt,
  height = 420,
  cooperative = false,
  showcase = false,
  onFatalError,
}: BuildingSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const cb = useRef<{
    onSelect?: BuildingSceneProps["onSelect"];
    onPickBuilding?: BuildingSceneProps["onPickBuilding"];
    onAddVertex?: BuildingSceneProps["onAddVertex"];
    onFatalError?: () => void;
    pickMode: PickMode;
    stopSpin?: () => void;
  }>({ onSelect, onPickBuilding, onAddVertex, onFatalError, pickMode });
  cb.current = { ...cb.current, onSelect, onPickBuilding, onAddVertex, onFatalError, pickMode };

  const ring = useMemo(() => (building ? openRing(building.footprint) : []), [building]);
  const hasModel = ring.length >= 3;

  // ---------- Khởi tạo ----------
  useEffect(() => {
    if (!containerRef.current) return;
    const focus = hasModel ? centroid(ring) : center;
    const present = showcase && hasModel;
    const m = new mapboxgl.Map({
      container: containerRef.current,
      accessToken: MAPBOX_TOKEN,
      style: GL_STYLES.light,
      language: "vi",
      locale: GL_LOCALE_VI,
      center: focus,
      // Chế độ trình bày: khung lớn hơn (hộp thoại rộng) nên tiến lại gần — toà nhà chiếm
      // khoảng nửa chiều cao khung, vẫn thấy nền đất và phố xung quanh.
      // Khung hẹp (điện thoại) thì lùi lại tương ứng: mỗi nửa bề rộng là một mức zoom.
      zoom: hasModel
        ? zoomFor(ring) +
          (present
            ? 0.55 + 0.8 * Math.log2(Math.min(containerRef.current.clientWidth || 700, 700) / 700)
            : 0)
        : 17.2,
      pitch: present ? 55 : 58,
      bearing: -24,
      antialias: true,
      cooperativeGestures: cooperative,
    });
    // Tâm camera là CHÂN toà nhà; toà nhà mọc lên phía trên tâm nên trông như bị đẩy lên mép
    // trên. Đệm phía trên đẩy tâm xuống dưới, toà nhà nằm giữa khung.
    if (present)
      m.setPadding({
        top: Math.round(containerRef.current.clientHeight * 0.32),
        bottom: 0,
        left: 0,
        right: 0,
      });
    m.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    m.on("error", (e) => {
      if (isFatalGlError(e as unknown as { error?: { status?: number } }))
        cb.current.onFatalError?.();
    });
    // "style.load" thay vì "load": "load" còn chờ ảnh ký hiệu và tile vẽ xong lần đầu, trong
    // khi các lớp của mô hình chỉ cần style — thêm sớm thì toà nhà hiện cùng lúc với bản đồ.
    m.once("style.load", () => {
      // Lớp nhà 3D nền. Đặt dưới nhãn đường phố để chữ không bị khối nhà che.
      const labelLayer = m
        .getStyle()
        .layers?.find(
          (l) =>
            l.type === "symbol" &&
            (l.layout as { "text-field"?: unknown } | undefined)?.["text-field"],
        )?.id;
      const extrude: mapboxgl.FillExtrusionLayerSpecification["paint"] = {
        "fill-extrusion-height": ["coalesce", ["get", "height"], 6],
        "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
      };
      m.addLayer(
        {
          id: CTX,
          type: "fill-extrusion",
          source: "composite",
          "source-layer": "building",
          minzoom: 14,
          filter: ["==", ["get", "extrude"], "true"],
          // Trình bày: nhà xung quanh chỉ là bối cảnh — mờ, sáng màu, không che toà nhà chính.
          paint: {
            ...extrude,
            "fill-extrusion-color": present ? "#eef0f4" : "#e2e8f0",
            "fill-extrusion-opacity": present ? 0.38 : 0.7,
          },
        },
        labelLayer,
      );
      m.addLayer(
        {
          id: CTX_HL,
          type: "fill-extrusion",
          source: "composite",
          "source-layer": "building",
          minzoom: 14,
          filter: ["in", ["id"], ["literal", []]],
          paint: { ...extrude, "fill-extrusion-color": SELECTED, "fill-extrusion-opacity": 0.85 },
        },
        labelLayer,
      );

      // Nền đất dưới chân toà nhà: một mảng tối nhẹ cùng nét viền, như bóng đổ — khối nhà
      // "đứng" trên mặt đất thay vì lơ lửng giữa nền bản đồ phẳng.
      if (present) {
        const ground = footprintFeature(ring);
        if (ground) {
          m.addSource(GROUND, { type: "geojson", data: ground });
          m.addLayer({
            id: `${GROUND}-fill`,
            type: "fill",
            source: GROUND,
            paint: { "fill-color": "#334155", "fill-opacity": 0.18 },
          });
          m.addLayer({
            id: `${GROUND}-line`,
            type: "line",
            source: GROUND,
            paint: { "line-color": "#475569", "line-width": 1.5, "line-opacity": 0.5 },
          });
        }
        // Ánh sáng chếch từ phía tây nam: các mặt khối sáng tối khác nhau, đọc ra được chiều sâu.
        m.setLight({ anchor: "map", position: [1.3, 210, 35], intensity: 0.42, color: "#ffffff" });
      }

      m.addSource(CELLS, { type: "geojson", data: EMPTY });
      // Hai lớp vì độ mờ của fill-extrusion là thuộc tính của CẢ LỚP, không theo từng khối:
      // lớp chính cho các tầng đang thấy, lớp "bóng" mờ cho các tầng phía trên tầng đang chọn.
      for (const ghost of [false, true]) {
        m.addLayer({
          id: ghost ? `${CELLS}-ghost` : CELLS,
          type: "fill-extrusion",
          source: CELLS,
          filter: ["==", ["get", "ghost"], ghost],
          paint: {
            "fill-extrusion-color": ghost ? "#ffffff" : ["get", "color"],
            "fill-extrusion-height": ["get", "top"],
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-opacity": ghost ? 0.16 : 1,
            "fill-extrusion-vertical-gradient": false,
          },
        });
      }

      m.addSource(DRAFT, { type: "geojson", data: EMPTY });
      m.addLayer({
        id: `${DRAFT}-fill`,
        type: "fill",
        source: DRAFT,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": SELECTED, "fill-opacity": 0.15 },
      });
      m.addLayer({
        id: `${DRAFT}-line`,
        type: "line",
        source: DRAFT,
        filter: ["!=", ["geometry-type"], "Point"],
        paint: { "line-color": SELECTED, "line-width": 2.5, "line-dasharray": [2, 1] },
      });
      m.addLayer({
        id: `${DRAFT}-pts`,
        type: "circle",
        source: DRAFT,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#ffffff",
          "circle-stroke-color": SELECTED,
          "circle-stroke-width": 2,
        },
      });
      setLoaded(true);
    });

    m.on("click", (e) => {
      const mode = cb.current.pickMode;
      if (mode === "draw") {
        cb.current.onAddVertex?.([e.lngLat.lng, e.lngLat.lat]);
        return;
      }
      if (mode === "building") {
        const f = m.queryRenderedFeatures(e.point, { layers: [CTX] })[0];
        cb.current.onPickBuilding?.(f ? outerRing(f.geometry) : null);
        return;
      }
      const cell = m.queryRenderedFeatures(e.point, { layers: [CELLS] })[0];
      const p = cell?.properties as Partial<CellProps> | undefined;
      cb.current.onSelect?.(p?.unitId ?? null, p?.floor ?? null);
    });
    m.on("mousemove", (e) => {
      const mode = cb.current.pickMode;
      const layers = mode === "building" ? [CTX] : mode ? [] : [CELLS];
      const hit = layers.length > 0 && m.queryRenderedFeatures(e.point, { layers }).length > 0;
      m.getCanvas().style.cursor = mode === "draw" ? "crosshair" : hit ? "pointer" : "";
    });

    // Xoay chậm một vòng lúc mở để người xem thấy đây là mô hình 3D, dừng ngay khi họ chạm
    // vào (kéo, cuộn, bấm). Không xoay với người bật "giảm chuyển động".
    let spin = 0;
    if (present && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      let last = 0;
      const step = (t: number) => {
        if (last) m.setBearing(m.getBearing() + (t - last) * 0.004);
        last = t;
        spin = requestAnimationFrame(step);
      };
      const stop = () => {
        cancelAnimationFrame(spin);
        spin = 0;
      };
      m.once("load", () => (spin = requestAnimationFrame(step)));
      for (const ev of ["mousedown", "touchstart", "wheel"] as const) m.once(ev, stop);
      cb.current.stopSpin = stop;
    }

    const ro = new ResizeObserver(() => m.resize());
    ro.observe(containerRef.current);
    setMap(m);
    return () => {
      cancelAnimationFrame(spin);
      ro.disconnect();
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chọn tầng/căn từ danh sách bên cạnh cũng là "chạm vào" — dừng xoay để khối được chọn
  // đứng yên cho người xem nhìn.
  useEffect(() => {
    if (selectedFloor != null || selectedUnitId != null) cb.current.stopSpin?.();
  }, [selectedFloor, selectedUnitId]);

  // ---------- Khối căn ----------
  const cells = useMemo(
    () => (building && hasModel ? buildCells(building) : null),
    [building, hasModel],
  );

  useEffect(() => {
    if (!map || !loaded) return;
    const src = map.getSource(CELLS) as mapboxgl.GeoJSONSource;
    if (!cells) {
      src.setData(EMPTY);
      return;
    }
    src.setData({
      type: "FeatureCollection",
      features: cells.features.map((f) => {
        const p = f.properties;
        const ghost = selectedFloor != null && p.floor > selectedFloor;
        // Đang chọn một tầng: các tầng phía dưới nhạt đi một nửa để tầng được chọn nổi lên.
        const dim = selectedFloor != null && p.floor < selectedFloor;
        const color =
          p.unitId && p.unitId === selectedUnitId
            ? SELECTED
            : dim
              ? mix(CELL_COLORS[p.kind], "#ffffff", 0.55)
              : CELL_COLORS[p.kind];
        return { ...f, properties: { ...p, ghost, color } };
      }),
    });
  }, [map, loaded, cells, selectedFloor, selectedUnitId]);

  // ---------- Ẩn khối nhà nền trùng chỗ mô hình; tô nổi toà nhà tại điểm `highlight` ----------
  const hideKey = hasModel && !pickMode ? ring.map((p) => p.join(",")).join(";") : "";
  useEffect(() => {
    if (!map || !loaded) return;
    const base: mapboxgl.FilterSpecification = ["==", ["get", "extrude"], "true"];
    const apply = () => {
      let hidden: (string | number)[] = [];
      let hl: (string | number)[] = [];
      if (hideKey) {
        // Lấy mẫu tại tâm và các đỉnh co về tâm 30% — đủ để bắt khối nhà nằm dưới mô hình.
        const c = centroid(ring);
        hidden = idsAt(map, [
          c,
          ...ring.map((p) => [c[0] + (p[0] - c[0]) * 0.7, c[1] + (p[1] - c[1]) * 0.7] as LngLat),
        ]);
      } else if (!hasModel && highlight) {
        // Khối nổi bật vẽ ở lớp riêng — ẩn nó khỏi lớp nền để hai khối không chồng lên nhau.
        hl = idsAt(map, [highlight]);
        hidden = hl;
      }
      map.setFilter(
        CTX,
        hidden.length ? ["all", base, ["!", ["in", ["id"], ["literal", hidden]]]] : base,
      );
      map.setFilter(CTX_HL, ["in", ["id"], ["literal", hl]]);
    };
    // Bỏ lọc cũ rồi chờ vẽ lại xong mới truy vấn: khối đang bị ẩn thì không truy vấn ra
    // được, và khối nhà nền chỉ có sau khi tile đã vẽ.
    map.setFilter(CTX, base);
    map.setFilter(CTX_HL, ["in", ["id"], ["literal", []]]);
    map.once("idle", apply);
    map.triggerRepaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, loaded, hideKey, hasModel, highlight?.[0], highlight?.[1]]);

  // Ghim vị trí khi không có mô hình (kể cả khi không tìm thấy khối nhà tại đó).
  useEffect(() => {
    if (!map || hasModel || !highlight) return;
    const mk = new mapboxgl.Marker({ color: "#1f2f6b" }).setLngLat(highlight).addTo(map);
    return () => {
      mk.remove();
    };
  }, [map, hasModel, highlight?.[0], highlight?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Tự lấy khung lúc mở xưởng dựng ----------
  const autoDone = useRef(false);
  useEffect(() => {
    if (!map || !loaded || !autoPickAt || autoDone.current) return;
    autoDone.current = true;
    map.once("idle", () => {
      const f = map.queryRenderedFeatures(map.project(autoPickAt), { layers: [CTX] })[0];
      cb.current.onPickBuilding?.(f ? outerRing(f.geometry) : null);
    });
    map.triggerRepaint();
  }, [map, loaded, autoPickAt]);

  // ---------- Khung đang vẽ ----------
  useEffect(() => {
    if (!map || !loaded) return;
    const pts = draft ?? [];
    const features: GeoJSON.Feature[] = pts.map((p) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: p },
    }));
    const poly = footprintFeature(pts);
    if (poly) features.push(poly);
    else if (pts.length === 2)
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: pts },
      });
    (map.getSource(DRAFT) as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
  }, [map, loaded, draft]);

  // ---------- Camera theo khung mới ----------
  const ringKey = ring.map((p) => p.join(",")).join(";");
  // Khung có sẵn lúc mở thì camera đã đặt đúng chỗ khi khởi tạo; mọi khung MỚI (tự lấy, chọn,
  // vẽ, chữ nhật) thì đưa camera tới.
  const cameraRing = useRef(ringKey);
  useEffect(() => {
    if (!map || !hasModel || cameraRing.current === ringKey) return;
    cameraRing.current = ringKey;
    map.easeTo({ center: centroid(ring), zoom: zoomFor(ring), duration: 600 });
  }, [map, ringKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className={
        showcase ? "h-full w-full bg-muted" : "w-full overflow-hidden rounded-md border bg-muted"
      }
      style={showcase ? undefined : { height }}
    />
  );
}

function idsAt(map: mapboxgl.Map, pts: LngLat[]): (string | number)[] {
  const ids = new Set<string | number>();
  for (const p of pts) {
    for (const f of map.queryRenderedFeatures(map.project(p), { layers: [CTX] })) {
      if (f.id != null) ids.add(f.id);
    }
  }
  return [...ids];
}

/** Trộn hai màu hex theo tỉ lệ t (0 = a, 1 = b). */
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa
    .map((v, i) =>
      Math.round(v + (pb[i] - v) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
