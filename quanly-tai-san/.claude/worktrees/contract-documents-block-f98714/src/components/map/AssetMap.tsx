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
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AssetMapItem } from "@/lib/api/assets";
import type { AssetStatusCode } from "@/constants/enums";
import type { PortfolioIncome } from "@/lib/asset-income";
import { prefersReducedMotion } from "@/lib/motion";
import { formatCurrency } from "@/lib/format";
import { AssetQuickCard, QUICK_CARD_WIDTH } from "./AssetQuickCard";

// Positron: tile gần như đơn sắc, không có đường đỏ/vàng gắt như OSM mặc định — đây là
// điều kiện để panel trắng bán trong suốt đặt lên trên vẫn đọc rõ.
const POSITRON_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const POSITRON_ATTRIB =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const FALLBACK_CENTER: L.LatLngTuple = [10.7769, 106.7009];

// Dùng token ngữ nghĩa sẵn có, không đặt bảng màu riêng cho bản đồ.
const STATUS_COLOR: Record<AssetStatusCode, string> = {
  1: "var(--color-info)", // Đang sử dụng
  2: "var(--color-success)", // Đang cho thuê
  3: "var(--color-warning)", // Đang rao bán
  4: "var(--color-muted-foreground)", // Trống
  5: "var(--color-muted-foreground)", // Đã bán
  6: "var(--color-destructive)", // Hết hạn thuê
};

// Bán kính vòng ngoài: nhỏ nhất → lớn nhất trong CHÍNH danh mục đang xem
const RING_MIN = 18;
const RING_MAX = 48;
/** Tài sản chưa nhập giá trị: vòng nhỏ nhất, và không tham gia tính min–max. */
const RING_NO_VALUE = 18;
/** Mọi tài sản cùng giá trị → không có thang so sánh, dùng cỡ trung bình cố định. */
const RING_UNIFORM = 24;

type LocatedAsset = AssetMapItem & { latitude: number; longitude: number };

function hasLocation(a: AssetMapItem): a is LocatedAsset {
  return a.latitude != null && a.longitude != null;
}

/**
 * Chuẩn hoá bán kính theo min–max của chính danh mục người dùng đang xem, không theo giá
 * trị tuyệt đối: người chỉ có tài sản nhỏ vẫn phải thấy được cái nào lớn nhất của họ.
 */
function makeRingRadius(items: LocatedAsset[]): (value: number | null) => number {
  const values = items.map((a) => a.currentValue).filter((v): v is number => v != null);
  if (values.length === 0) return () => RING_NO_VALUE;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (value) => {
    if (value == null) return RING_NO_VALUE;
    if (max === min) return RING_UNIFORM;
    return RING_MIN + ((value - min) / (max - min)) * (RING_MAX - RING_MIN);
  };
}

function ringInnerHtml(status: AssetStatusCode, radius: number, alive: boolean, active: boolean) {
  const color = STATUS_COLOR[status] ?? STATUS_COLOR[4];
  const size = radius * 2;
  const cls = ["asset-ring", alive && "asset-ring--alive", active && "asset-ring--active"]
    .filter(Boolean)
    .join(" ");
  return `<div class="${cls}" style="width:${size}px;height:${size}px;border-color:${color};background:color-mix(in oklab, ${color} 14%, transparent)"><i class="asset-ring__dot" style="background:${color}"></i></div>`;
}

// DivIcon bất biến theo (trạng thái, bán kính, thở, nổi bật) — cache để đổi hover không
// phải dựng lại icon cho toàn bộ marker.
const iconCache = new Map<string, L.DivIcon>();

/**
 * Icon CỐ TÌNH không phụ thuộc trạng thái hover/chọn: đổi icon sẽ khiến react-leaflet gọi
 * `setIcon()`, thay luôn phần tử DOM của marker và giết Tooltip đang mở. Việc làm nổi bật
 * xử lý bằng cách bật/tắt class trên chính phần tử đó (xem HighlightMarkers).
 */
function ringIcon(status: AssetStatusCode, radius: number, alive: boolean): L.DivIcon {
  // Gom bán kính về bội số 2px: giữ cache nhỏ mà mắt thường không phân biệt được
  const r = Math.max(RING_MIN, Math.round(radius / 2) * 2);
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
  let top = 4;
  let topCount = -1;
  for (const [code, n] of tally) {
    if (n > topCount) {
      top = code;
      topCount = n;
    }
  }
  const color = STATUS_COLOR[top as AssetStatusCode] ?? STATUS_COLOR[4];
  const size = count >= 50 ? 64 : count >= 10 ? 52 : 40;
  const font = count >= 50 ? 18 : count >= 10 ? 16 : 14;

  return L.divIcon({
    html: `<div class="asset-cluster" style="width:${size}px;height:${size}px;font-size:${font}px;background:${color};box-shadow:0 0 0 8px color-mix(in oklab, ${color} 15%, transparent)">${count}</div>`,
    className: "asset-cluster-wrap",
    iconSize: L.point(size, size),
  });
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

const CARD_GAP = 16;
const CARD_EDGE = 8;
/** Chiều cao ước lượng để căn chỗ; card thật có thể thấp hơn, không ảnh hưởng thẩm mỹ. */
const CARD_EST_HEIGHT = 360;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Lớp "spotlight": làm tối nền bản đồ, vẽ lại marker đang chọn ở trên lớp tối, và mở card
 * ngay tại điểm vừa click.
 *
 * Vì sao phải vẽ LẠI marker thay vì nâng z-index marker gốc: marker nằm trong
 * `.leaflet-marker-pane` (position:absolute + z-index:600) — pane đó tự tạo stacking
 * context, nên không con nào bên trong vượt lên trên lớp tối đặt ngoài pane được.
 */
function SelectionLayer({
  target,
  radius,
  alive,
  income,
  onClose,
  onOpenDetail,
  rightInset,
}: {
  target: LocatedAsset;
  radius: number;
  alive: boolean;
  income: PortfolioIncome;
  onClose: () => void;
  onOpenDetail: (id: string) => void;
  rightInset: number;
}) {
  const map = useMap();
  // Lớp này được PORTAL ra document.body (xem phần return) nên toạ độ phải quy về
  // viewport, không phải toạ độ trong container bản đồ.
  const read = useCallback(() => {
    const box = map.getContainer().getBoundingClientRect();
    return {
      pt: map.latLngToContainerPoint([target.latitude, target.longitude]),
      size: map.getSize(),
      offset: { x: box.left, y: box.top },
    };
  }, [map, target.latitude, target.longitude]);
  const [geo, setGeo] = useState(read);

  // Card neo theo marker: pan/zoom thì đi theo, không bị "rớt" lại một chỗ
  const sync = useCallback(() => setGeo(read()), [read]);
  useEffect(() => sync(), [sync]);
  useMapEvents({ move: sync, zoom: sync, resize: sync });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Chỉ lớp trên cùng được xử lý Esc. Khi AssetDetailDialog (hoặc sheet) đang mở đè
      // lên, một lần Esc phải đóng đúng lớp đó — không đóng luôn cả thẻ xem nhanh bên dưới.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { pt, size, offset } = geo;

  // Chọn phía còn nhiều chỗ nhất, rồi kẹp lại trong viewport — cùng cách đã dùng để sửa
  // popover "Tìm quanh vị trí" ở Marketplace.
  const usableRight =
    size.x - rightInset > QUICK_CARD_WIDTH + CARD_GAP * 2 ? size.x - rightInset : size.x;
  const spaceRight = usableRight - pt.x;
  const spaceLeft = pt.x;
  let left =
    spaceRight >= QUICK_CARD_WIDTH + CARD_GAP || spaceRight >= spaceLeft
      ? pt.x + radius + CARD_GAP
      : pt.x - radius - CARD_GAP - QUICK_CARD_WIDTH;
  left = clamp(left, CARD_EDGE, usableRight - QUICK_CARD_WIDTH - CARD_EDGE);

  let top = pt.y - CARD_EST_HEIGHT / 2;
  top = clamp(top, CARD_EDGE, size.y - CARD_EST_HEIGHT - CARD_EDGE);

  // Gốc phóng nằm đúng phía marker → card "nở ra" từ điểm vừa click
  const originX = clamp(pt.x - left, 0, QUICK_CARD_WIDTH);
  const originY = clamp(pt.y - top, 0, CARD_EST_HEIGHT);

  // PORTAL ra document.body: nếu render trong cây bản đồ, cả 3 lớp này bị nhốt trong
  // stacking context `z-0` của wrapper bản đồ (thứ bắt buộc phải có để giam các pane
  // Leaflet z-400..700). Hệ quả đã đo được: quick card khai báo z-1000 vẫn bị panel
  // thống kê z-10 che mất. Ra ngoài body thì z-index mới có hiệu lực thật.
  return createPortal(
    <>
      <div className="asset-spotlight" onClick={onClose} role="presentation" aria-hidden="true" />
      {/* Bản sao sáng của marker đang chọn, nằm trên lớp tối */}
      <div
        className="asset-selected-ring"
        style={{ left: offset.x + pt.x - radius, top: offset.y + pt.y - radius }}
        aria-hidden="true"
        dangerouslySetInnerHTML={{
          __html: ringInnerHtml(target.status, radius, alive, true),
        }}
      />
      <div
        className="asset-quickcard"
        style={{
          left: offset.x + left,
          top: offset.y + top,
          width: QUICK_CARD_WIDTH,
          transformOrigin: `${originX}px ${originY}px`,
        }}
      >
        <AssetQuickCard
          asset={target}
          income={income[target.id]}
          onClose={onClose}
          onOpenDetail={onOpenDetail}
        />
      </div>
    </>,
    document.body,
  );
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
      <TileLayer url={POSITRON_URL} attribution={POSITRON_ATTRIB} />
      <FitToAssets items={located} rightInset={rightInset} />
      <PanToSelected target={selected} />

      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        maxClusterRadius={56}
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
          radius={Math.max(RING_MIN, Math.round(radiusOf(selected.currentValue) / 2) * 2)}
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
