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
import type { BuildingUnit, LngLat } from "@/lib/api/buildingModel";
import { formatListingPrice } from "@/lib/api/listings";
import { sunPosition } from "@/lib/sun";
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
const SLABS = "kgs-slabs";
/** Bề dày sàn giữa hai tầng — khớp khe SLAB_GAP để lại giữa các khối căn. */
const SLAB_THICKNESS = 0.6;

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
  /** Ảnh chung của toà nhà — cho bong bóng khi rê chuột lên căn chưa có ảnh riêng. */
  fallbackImage?: string | null;
  /**
   * Mô phỏng nắng: chiếu sáng theo vị trí mặt trời thật tại thời điểm này, có đổ bóng. null =
   * ánh sáng trình bày cố định như cũ.
   */
  sunTime?: Date | null;
  /**
   * Cảnh này có dùng mô phỏng nắng. Bật thì dựng bằng hệ đèn v3 (setLights) ngay từ đầu với
   * ánh sáng trung tính: chuyển từ đèn cũ sang đèn v3 giữa chừng buộc Mapbox dựng lại toàn bộ
   * tile — khung bản đồ trắng vài giây. Bắt đầu sẵn bằng đèn v3 thì kéo giờ chỉ là đổi thông số.
   */
  sunEnabled?: boolean;
  /** Tăng số này để bắt đầu một lượt bay quanh toà nhà (0 = chưa bay). */
  tourSignal?: number;
  /** Hướng mặt tiền (phương vị, độ) — lượt bay dừng lại nhìn thẳng vào mặt tiền. */
  facadeAzimuth?: number | null;
  onTourEnd?: () => void;
  onFatalError?: () => void;
}

/**
 * Hai nguồn sáng của Mapbox GL v3 theo vị trí mặt trời: nắng (có hướng, đổ bóng) + ánh sáng
 * môi trường. Mặt trời thấp thì nắng vàng và yếu đi; lặn rồi thì chỉ còn ánh sáng xanh nhạt.
 */
/** Ánh sáng trung tính (không mô phỏng giờ) — gần với ánh sáng trình bày cũ, không đổ bóng. */
const NEUTRAL_LIGHTS: mapboxgl.LightsSpecification[] = [
  { id: "kgs-ambient", type: "ambient", properties: { color: "#ffffff", intensity: 0.62 } },
  {
    id: "kgs-sun",
    type: "directional",
    properties: { direction: [210, 50], color: "#ffffff", intensity: 0.45, "cast-shadows": false },
  },
];

function sunLights(time: Date, at: LngLat): mapboxgl.LightsSpecification[] {
  const p = sunPosition(time, at[1], at[0]);
  const up = p.altitude > 0;
  const strength = Math.max(0, Math.min(1, p.altitude / 25));
  return [
    {
      id: "kgs-ambient",
      type: "ambient",
      // Bóng đổ chỉ lấy đi phần nắng trực tiếp, còn ánh sáng môi trường thì vẫn còn. Môi trường
      // quá sáng thì bóng nhạt không đọc được; quá tối thì chiều muộn cả cảnh sẫm lại. 0,5 là
      // điểm cân bằng khi thử ở TP.HCM từ 7:00 đến 17:30.
      properties: {
        color: up ? "#ffffff" : "#a5b4d4",
        intensity: up ? 0.5 + 0.05 * strength : 0.4,
      },
    },
    {
      id: "kgs-sun",
      type: "directional",
      properties: {
        // [phương vị từ hướng Bắc, góc từ đỉnh đầu]. Kẹp ở 86°: sát chân trời thì bóng dài vô
        // tận, phủ kín khung hình mà không nói thêm được gì.
        direction: [p.azimuth, Math.min(86, 90 - Math.max(p.altitude, 0))],
        color: p.altitude < 12 ? "#ffcf99" : "#fff8ee",
        intensity: up ? 0.6 + 0.15 * strength : 0,
        "cast-shadows": up,
        "shadow-intensity": 1,
      },
    },
  ];
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
  fallbackImage = null,
  sunTime = null,
  sunEnabled = false,
  tourSignal = 0,
  facadeAzimuth = null,
  onTourEnd,
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
    onTourEnd?: () => void;
    units?: BuildingUnit[];
    fallbackImage?: string | null;
  }>({ onSelect, onPickBuilding, onAddVertex, onFatalError, pickMode });
  cb.current = {
    ...cb.current,
    onSelect,
    onPickBuilding,
    onAddVertex,
    onFatalError,
    pickMode,
    units: building?.units,
    fallbackImage,
    onTourEnd,
  };
  /** Góc nhìn lúc mở — lượt bay kết thúc ở đúng độ gần này. */
  const homeView = useRef<{ zoom: number; pitch: number } | null>(null);

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
        if (!sunEnabled)
          m.setLight({
            anchor: "map",
            position: [1.3, 210, 35],
            intensity: 0.42,
            color: "#ffffff",
          });
      }
      if (sunEnabled) m.setLights(NEUTRAL_LIGHTS);

      // Trình bày: bóng đổ góc khuất (chân tường, khe giữa các khối) và bo mép khối — khối
      // hết trông như hộp nhựa. Hai thuộc tính này có từ Mapbox GL v3.
      const polish = present
        ? {
            layout: { "fill-extrusion-edge-radius": 0.3 },
            ao: {
              "fill-extrusion-ambient-occlusion-intensity": 0.35,
              "fill-extrusion-ambient-occlusion-radius": 2.5,
            },
          }
        : { layout: {}, ao: {} };

      // Sàn giữa các tầng + mái: một tấm mỏng sẫm, nhô ra mép một chút như ban công — đọc
      // ra được từng tầng thay vì một khối liền.
      m.addSource(SLABS, { type: "geojson", data: EMPTY });
      m.addLayer({
        id: SLABS,
        type: "fill-extrusion",
        source: SLABS,
        layout: polish.layout,
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "top"],
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-opacity": 1,
          ...polish.ao,
        },
      });

      m.addSource(CELLS, { type: "geojson", data: EMPTY });
      // Hai lớp vì độ mờ của fill-extrusion là thuộc tính của CẢ LỚP, không theo từng khối:
      // lớp chính cho các tầng đang thấy, lớp "bóng" mờ cho các tầng phía trên tầng đang chọn.
      for (const ghost of [false, true]) {
        m.addLayer({
          id: ghost ? `${CELLS}-ghost` : CELLS,
          type: "fill-extrusion",
          source: CELLS,
          filter: ["==", ["get", "ghost"], ghost],
          layout: ghost ? {} : polish.layout,
          paint: {
            // Rê chuột lên căn: căn sáng lên (feature-state, không phải dựng lại dữ liệu).
            // Tầng phía trên tầng đang chọn: khối kính xám nhạt — đủ rõ để vẫn thấy hình cả toà
            // nhà (trắng mờ 16% như trước thì trên nền bản đồ sáng gần như biến mất, người xem
            // tưởng toà nhà bị mất), nhưng đủ trong để nhìn xuyên xuống tầng đang chọn.
            "fill-extrusion-color": ghost
              ? "#94a3b8"
              : [
                  "case",
                  ["boolean", ["feature-state", "hover"], false],
                  ["get", "hoverColor"],
                  ["get", "color"],
                ],
            "fill-extrusion-height": ["get", "top"],
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-opacity": ghost ? 0.3 : 1,
            "fill-extrusion-vertical-gradient": false,
            ...(ghost ? { "fill-extrusion-cast-shadows": false } : polish.ao),
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
    // Bong bóng khi rê chuột lên một căn: ảnh, tên căn, giá — thấy căn trông thế nào mà chưa
    // cần bấm. Chỉ ở chế độ trình bày (người tìm nhà).
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      maxWidth: "220px",
      className: "kgs-unit-popup",
    });
    let hovered: string | number | null = null;
    const setHover = (id: string | number | null) => {
      if (hovered === id) return;
      if (hovered != null) m.setFeatureState({ source: CELLS, id: hovered }, { hover: false });
      hovered = id;
      if (id != null) m.setFeatureState({ source: CELLS, id }, { hover: true });
    };
    m.on("mousemove", (e) => {
      const mode = cb.current.pickMode;
      const layers = mode === "building" ? [CTX] : mode ? [] : [CELLS];
      const hits = layers.length > 0 ? m.queryRenderedFeatures(e.point, { layers }) : [];
      m.getCanvas().style.cursor = mode === "draw" ? "crosshair" : hits.length ? "pointer" : "";
      if (mode) return;
      const cell = hits[0];
      setHover(cell?.id ?? null);
      const p = cell?.properties as Partial<CellProps> | undefined;
      const u = p?.unitId ? cb.current.units?.find((x) => x.id === p.unitId) : null;
      if (!present || !u) {
        popup.remove();
        return;
      }
      popup
        .setLngLat(e.lngLat)
        .setHTML(unitPopupHtml(u, cb.current.fallbackImage ?? null))
        .addTo(m);
    });
    m.getCanvas().addEventListener("mouseleave", () => {
      setHover(null);
      popup.remove();
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

    homeView.current = { zoom: m.getZoom(), pitch: m.getPitch() };
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

  // ---------- Nắng & bóng ----------
  const sunKey = sunTime ? Math.round(sunTime.valueOf() / 60_000) : 0;
  const lit = useRef(false);
  useEffect(() => {
    if (!map || !loaded) return;
    const at = hasModel ? centroid(ring) : (highlight ?? center);
    // Khối trong suốt không đổ bóng — lúc mô phỏng nắng thì nhà xung quanh phải đặc, để thấy
    // được nhà bên cạnh che nắng của căn này hay không.
    const present = showcase && hasModel;
    map.setPaintProperty(CTX, "fill-extrusion-opacity", sunTime ? 1 : present ? 0.38 : 0.7);
    map.setPaintProperty(CTX_HL, "fill-extrusion-opacity", sunTime ? 1 : 0.85);
    if (sunTime) {
      map.setLights(sunLights(sunTime, at));
      lit.current = true;
    } else if (lit.current) {
      // Tắt mô phỏng: về ánh sáng trung tính, vẫn trong hệ đèn v3 để không phải dựng lại tile.
      map.setLights(sunEnabled ? NEUTRAL_LIGHTS : null);
      lit.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, loaded, sunKey]);

  // ---------- Bay quanh toà nhà ----------
  // Ba chặng như một cú máy flycam: lùi lên cao thấy cả khu → sà xuống chéo góc → lượn nửa
  // vòng và dừng nhìn thẳng mặt tiền. Người xem chạm vào bản đồ là dừng ngay, trả lại quyền điều
  // khiển. Bật "giảm chuyển động" thì nhảy thẳng tới góc cuối, không bay.
  useEffect(() => {
    if (!map || !loaded || !tourSignal) return;
    cb.current.stopSpin?.();
    const target = hasModel ? centroid(ring) : (highlight ?? center);
    const home = homeView.current ?? { zoom: 17.2, pitch: 58 };
    // Hướng nhìn của camera ngược với hướng mặt tiền: mặt tiền quay về Tây thì máy đứng phía
    // Tây nhìn sang Đông. Chưa biết hướng thì giữ hướng nhìn hiện tại.
    const endBearing = facadeAzimuth != null ? (facadeAzimuth + 180) % 360 : map.getBearing();
    const done = () => cb.current.onTourEnd?.();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.jumpTo({ center: target, zoom: home.zoom, pitch: 60, bearing: endBearing });
      done();
      return;
    }

    let cancelled = false;
    let raf = 0;
    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(raf);
      map.stop();
      done();
    };
    const canvas = map.getCanvasContainer();
    const events = ["mousedown", "touchstart", "wheel"] as const;
    events.forEach((ev) => canvas.addEventListener(ev, cancel, { passive: true }));

    const fly = (opts: mapboxgl.CameraOptions & { duration: number; curve?: number }) =>
      new Promise<void>((resolve) => {
        if (cancelled) return resolve();
        map.once("moveend", () => resolve());
        map.flyTo({ ...opts, essential: true });
      });
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

    void (async () => {
      await fly({
        center: target,
        zoom: 14.6,
        pitch: 25,
        bearing: endBearing - 140,
        duration: 2000,
      });
      await fly({
        center: target,
        zoom: home.zoom - 0.7,
        pitch: 62,
        bearing: endBearing - 110,
        duration: 2600,
        curve: 1.1,
      });
      if (cancelled) return;
      // Lượn: xoay 110° về hướng mặt tiền và tiến lại gần dần trong 6 giây.
      const from = { bearing: endBearing - 110, zoom: home.zoom - 0.7 };
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          if (cancelled) return resolve();
          const t = Math.min(1, (now - start) / 6000);
          const k = ease(t);
          map.jumpTo({
            center: target,
            bearing: from.bearing + 110 * k,
            zoom: from.zoom + 0.7 * k,
            pitch: 62 - 4 * k,
          });
          if (t < 1) raf = requestAnimationFrame(step);
          else resolve();
        };
        raf = requestAnimationFrame(step);
      });
      if (!cancelled) {
        cancelled = true;
        done();
      }
    })();

    return () => {
      events.forEach((ev) => canvas.removeEventListener(ev, cancel));
      if (!cancelled) {
        cancelled = true;
        cancelAnimationFrame(raf);
        map.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, loaded, tourSignal]);

  // ---------- Khối căn ----------
  const cells = useMemo(
    () => (building && hasModel ? buildCells(building) : null),
    [building, hasModel],
  );

  // Sàn tầng + mái (chế độ trình bày). Đang chọn một tầng thì không vẽ sàn các tầng phía trên
  // — các tầng đó đang mờ, sàn sẫm của chúng sẽ che mất tầng được chọn.
  useEffect(() => {
    if (!map || !loaded || !map.getSource(SLABS)) return;
    const src = map.getSource(SLABS) as mapboxgl.GeoJSONSource;
    if (!showcase || !building || !hasModel) {
      src.setData(EMPTY);
      return;
    }
    const c = centroid(ring);
    const ledge = ring.map(
      (p) => [c[0] + (p[0] - c[0]) * 1.025, c[1] + (p[1] - c[1]) * 1.025] as LngLat,
    );
    const closed = [...ledge, ledge[0]];
    const h = building.floorHeightMeters;
    // Chọn tầng N: chỉ vẽ sàn đến trần tầng N-1 — tầng N để hở trần, thấy mặt trên các căn.
    const top = selectedFloor != null ? selectedFloor - 1 : building.floors;
    const features: GeoJSON.Feature[] = [];
    for (let f = 1; f <= top; f++) {
      const roof = f === building.floors;
      features.push({
        type: "Feature",
        properties: {
          base: f * h - SLAB_THICKNESS,
          top: f * h + (roof ? 0.5 : 0),
          color: roof ? "#475569" : "#94a3b8",
        },
        geometry: { type: "Polygon", coordinates: [closed] },
      });
    }
    src.setData({ type: "FeatureCollection", features });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, loaded, showcase, building, hasModel, ringKeyForSlabs(ring), selectedFloor]);

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
        return {
          ...f,
          properties: { ...p, ghost, color, hoverColor: mix(color, "#ffffff", 0.35) },
        };
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

const ringKeyForSlabs = (ring: LngLat[]) => ring.map((p) => p.join(",")).join(";");

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
  );

/** Nội dung bong bóng khi rê chuột lên căn. Chuỗi tự dựng nên phải escape mọi văn bản. */
function unitPopupHtml(u: BuildingUnit, fallback: string | null): string {
  const own = u.listing?.imageUrls?.[0] ?? null;
  const img = own ?? fallback;
  const status = u.listing
    ? `<span style="color:#047857;font-weight:600">${esc(formatListingPrice(u.listing.price, u.listing.type, u.listing.rentPaymentCycle))}</span>`
    : u.status === 1
      ? '<span style="color:#047857">Còn trống · chưa đăng tin</span>'
      : u.status === 3
        ? '<span style="color:#b45309">Đang sửa chữa</span>'
        : '<span style="color:#64748b">Đã có người</span>';
  return `<div style="font:12px/1.35 system-ui,sans-serif;color:#0f172a">${
    img
      ? `<div style="position:relative"><img src="${esc(img)}" alt="" style="display:block;width:196px;height:110px;object-fit:cover;border-radius:6px"/>${
          own
            ? ""
            : '<span style="position:absolute;left:4px;top:4px;background:rgba(0,0,0,.55);color:#fff;font-size:10px;padding:1px 5px;border-radius:4px">Ảnh chung</span>'
        }</div>`
      : ""
  }<div style="margin-top:${img ? 6 : 0}px;font-weight:600">${esc(u.name)}${
    u.floor ? ` · tầng ${u.floor}` : ""
  }${u.area ? ` · ${u.area} m²` : ""}</div><div>${status}</div></div>`;
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
