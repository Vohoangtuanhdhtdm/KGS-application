// Bản đồ danh mục tài sản cho dashboard — KHÁC PropertyMap (Marketplace) ở 3 điểm:
// basemap Positron xám nhạt (để panel trắng nổi lên đọc được), marker "vòng giá trị" mã
// hoá giá trị + trạng thái, và gom cụm bằng leaflet.markercluster.
// Client-only, nạp qua React.lazy (xem AssetMapClient.tsx).
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import L from "leaflet";
// Kéo phần khai báo bổ sung cho namespace `L` (L.MarkerCluster, MarkerClusterGroupOptions).
// react-leaflet-cluster đã nạp plugin này ở runtime; import lặp là idempotent.
import "leaflet.markercluster";
import { MapContainer, Marker, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import type { AssetMapItem } from "@/lib/api/assets";
import type { AssetStatusCode } from "@/constants/enums";
import type { PortfolioIncome } from "@/lib/asset-income";
import { prefersReducedMotion } from "@/lib/motion";
import { formatCurrency } from "@/lib/format";
import { BaseTileLayer } from "./BaseTileLayer";
import {
  FALLBACK_CENTER,
  MAX_CLUSTER_RADIUS,
  STATUS_COLOR,
  clusterHtml,
  hasLocation,
  makeRingRadius,
  ringInnerHtml,
  snapRadius,
  type LocatedAsset,
} from "./assetMapShared";
import { SelectionOverlay } from "./AssetSelectionOverlay";

// Nền "light" (Mapbox light-v11, lùi về OSM nếu không có Mapbox): gần như đơn sắc, không có
// đường đỏ/vàng gắt — điều kiện để panel trắng bán trong suốt đặt lên trên vẫn đọc rõ.
//
// Trước đây gắn cứng CARTO Positron. Nguồn đó nay trả tile đóng dấu chìm "API KEY REQUIRED"
// kín mặt bản đồ (xem lib/mapTiles.ts) — và vì tile tải THÀNH CÔNG nên không có lỗi nào để
// bắt. Dùng chung BaseTileLayer còn cho bản đồ này luôn cơ chế tự đổi nguồn khi nguồn hỏng.

// DivIcon bất biến theo (trạng thái, bán kính, thở, nổi bật) — cache để đổi hover không
// phải dựng lại icon cho toàn bộ marker.
const iconCache = new Map<string, L.DivIcon>();

/**
 * Icon CỐ TÌNH không phụ thuộc trạng thái hover/chọn: đổi icon sẽ khiến react-leaflet gọi
 * `setIcon()`, thay luôn phần tử DOM của marker và giết Tooltip đang mở. Việc làm nổi bật
 * xử lý bằng cách bật/tắt class trên chính phần tử đó (xem HighlightMarkers).
 */
function ringIcon(status: AssetStatusCode, radius: number, alive: boolean): L.DivIcon {
  const r = snapRadius(radius);
  const key = `${status}|${r}|${alive}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    html: ringInnerHtml(status, r, alive, false),
    // className mang mã trạng thái để iconCreateFunction đọc lại khi tô màu cụm —
    // Leaflet MarkerOptions không có chỗ gắn dữ liệu tuỳ ý.
    className: `asset-ring-wrap asset-ring--s${status}`,
    iconSize: [r * 2, r * 2],
    iconAnchor: [r, r],
  });
  iconCache.set(key, icon);
  return icon;
}

/** Tô cụm theo trạng thái chiếm đa số — giữ được thông tin trạng thái cả khi zoom xa. */
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const tally = new Map<number, number>();
  for (const m of cluster.getAllChildMarkers()) {
    const cls = (m.options.icon?.options as L.DivIconOptions | undefined)?.className ?? "";
    const code = Number(/asset-ring--s(\d+)/.exec(cls)?.[1]);
    if (Number.isFinite(code)) tally.set(code, (tally.get(code) ?? 0) + 1);
  }
  const { html, size } = clusterHtml(count, tally);
  return L.divIcon({ html, className: "asset-cluster-wrap", iconSize: L.point(size, size) });
}

/**
 * Khung nhìn ban đầu vừa đủ bao trọn tài sản đang có (không phải toàn Việt Nam trống
 * trải). Chừa lề phải rộng hơn để marker không nằm khuất dưới panel danh sách.
 */
function FitToAssets({ items, rightInset }: { items: LocatedAsset[]; rightInset: number }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || items.length === 0) return;
    fitted.current = true;
    if (items.length === 1) {
      map.setView([items[0].latitude, items[0].longitude], 14, { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(items.map((a) => [a.latitude, a.longitude] as L.LatLngTuple)), {
      paddingTopLeft: [48, 48],
      paddingBottomRight: [rightInset, 48],
      maxZoom: 15,
    });
  }, [items, map, rightInset]);

  return null;
}

/** Chọn tài sản từ panel danh sách → đưa marker tương ứng vào tầm nhìn. */
function PanToSelected({ target }: { target: LocatedAsset | null }) {
  const map = useMap();
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!target) {
      lastId.current = null;
      return;
    }
    if (lastId.current === target.id) return;
    lastId.current = target.id;
    map.setView([target.latitude, target.longitude], Math.max(map.getZoom(), 13), {
      animate: !prefersReducedMotion(),
    });
  }, [target, map]);

  return null;
}

/** Lớp spotlight + thẻ xem nhanh, lấy toạ độ từ Leaflet (phần vẽ dùng chung: SelectionOverlay). */
function SelectionLayer(props: Omit<Parameters<typeof SelectionOverlay>[0], "read" | "subscribe">) {
  const map = useMap();
  const { latitude, longitude } = props.target;
  // Lớp được PORTAL ra document.body nên toạ độ phải quy về viewport.
  const read = useCallback(() => {
    const box = map.getContainer().getBoundingClientRect();
    const pt = map.latLngToContainerPoint([latitude, longitude]);
    const size = map.getSize();
    return {
      pt: { x: pt.x, y: pt.y },
      size: { x: size.x, y: size.y },
      offset: { x: box.left, y: box.top },
    };
  }, [map, latitude, longitude]);
  const subscribe = useCallback(
    (cb: () => void) => {
      map.on("move zoom resize", cb);
      return () => {
        map.off("move zoom resize", cb);
      };
    },
    [map],
  );
  return <SelectionOverlay {...props} read={read} subscribe={subscribe} />;
}

/**
 * Một marker + tooltip xem nhanh. Memo hoá và giữ MỌI prop truyền xuống Leaflet ổn định
 * (icon, offset, eventHandlers): chỉ cần một prop đổi identity mỗi lần render là
 * react-leaflet sẽ dựng lại Tooltip, làm nó biến mất ngay khi vừa hiện.
 */
const AssetMarker = memo(function AssetMarker({
  asset,
  radius,
  alive,
  onHover,
  onSelect,
  registerMarker,
}: {
  asset: LocatedAsset;
  radius: number;
  alive: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  registerMarker: (id: string, marker: L.Marker | null) => void;
}) {
  const position = useMemo<L.LatLngTuple>(
    () => [asset.latitude, asset.longitude],
    [asset.latitude, asset.longitude],
  );
  const offset = useMemo<L.PointTuple>(() => [0, -radius], [radius]);
  const icon = useMemo(() => ringIcon(asset.status, radius, alive), [asset.status, radius, alive]);
  const setRef = useCallback(
    (m: L.Marker | null) => registerMarker(asset.id, m),
    [asset.id, registerMarker],
  );
  const eventHandlers = useMemo(
    () => ({
      mouseover: () => onHover(asset.id),
      mouseout: () => onHover(null),
      click: () => onSelect(asset.id),
      keypress: (e: L.LeafletKeyboardEvent) => {
        if (e.originalEvent.key === "Enter") onSelect(asset.id);
      },
    }),
    [asset.id, onHover, onSelect],
  );

  return (
    <Marker
      ref={setRef}
      position={position}
      icon={icon}
      alt={asset.name}
      eventHandlers={eventHandlers}
    >
      {/* Xem nhanh khi rê chuột — không delay, để "lướt" cả danh mục mà không phải click từng cái */}
      <Tooltip direction="top" offset={offset} opacity={1} className="asset-tooltip">
        <span className="font-medium">{asset.name}</span>
        {asset.currentValue != null && (
          <span className="text-muted-foreground">
            {" · "}
            {formatCurrency(asset.currentValue, { compact: true })}
          </span>
        )}
      </Tooltip>
    </Marker>
  );
});

export interface AssetMapProps {
  items: AssetMapItem[];
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onCloseSelection: () => void;
  onOpenDetail: (id: string) => void;
  income: PortfolioIncome;
  /** Bề rộng vùng bị panel che ở mép phải, để căn khung nhìn và vị trí card cho đúng. */
  rightInset?: number;
}

export default function AssetMap({
  items,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  onCloseSelection,
  onOpenDetail,
  income,
  rightInset = 380,
}: AssetMapProps) {
  const located = items.filter(hasLocation);
  const radiusOf = makeRingRadius(located);
  const selected = located.find((a) => a.id === selectedId) ?? null;
  const isAlive = (id: string) => income[id]?.hasRecentIncome === true;

  // Làm nổi bật bằng class trên phần tử marker sẵn có, KHÔNG đổi icon (xem ghi chú ở
  // ringIcon). getElement() trả null khi marker đang bị gom vào cụm — bỏ qua là đúng.
  const markerRefs = useRef<Record<string, L.Marker | null>>({});
  const registerMarker = useCallback((id: string, marker: L.Marker | null) => {
    markerRefs.current[id] = marker;
  }, []);
  useEffect(() => {
    for (const [id, marker] of Object.entries(markerRefs.current)) {
      marker
        ?.getElement()
        ?.classList.toggle("asset-ring-wrap--active", id === hoveredId || id === selectedId);
    }
  }, [hoveredId, selectedId, items]);

  return (
    <MapContainer
      center={FALLBACK_CENTER}
      zoom={11}
      zoomControl={false}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <BaseTileLayer variant="light" />
      <FitToAssets items={located} rightInset={rightInset} />
      <PanToSelected target={selected} />

      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={MAX_CLUSTER_RADIUS}
        iconCreateFunction={clusterIcon}
      >
        {located.map((a) => (
          <AssetMarker
            key={a.id}
            asset={a}
            radius={radiusOf(a.currentValue)}
            alive={isAlive(a.id)}
            onHover={onHover}
            onSelect={onSelect}
            registerMarker={registerMarker}
          />
        ))}
      </MarkerClusterGroup>

      {selected && (
        <SelectionLayer
          target={selected}
          radius={snapRadius(radiusOf(selected.currentValue))}
          alive={isAlive(selected.id)}
          income={income}
          onClose={onCloseSelection}
          onOpenDetail={onOpenDetail}
          rightInset={rightInset}
        />
      )}
    </MapContainer>
  );
}
