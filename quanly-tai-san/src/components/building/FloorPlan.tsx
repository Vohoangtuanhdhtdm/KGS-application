import { useId, useMemo } from "react";
import type { BuildingModel, LngLat } from "@/lib/api/buildingModel";
import { formatCurrency } from "@/lib/format";
import {
  CELL_COLORS,
  buildCells,
  centroid,
  makeProjection,
  openRing,
} from "@/lib/buildingGeometry";

const W = 1000; // bề rộng hệ toạ độ vẽ — SVG tự co theo khung

/**
 * Mặt bằng một tầng, nhìn từ trên xuống: mỗi căn là một ô đặt đúng chỗ trên khung toà nhà,
 * căn có tin thì ẢNH CỦA CĂN lấp đầy ô (cắt theo hình ô), căn chưa có tin tô màu tình trạng.
 *
 * Dễ đọc hơn khối 3D nhiều — nhất là trên điện thoại — và trả lời đúng câu người xem hỏi khi
 * đã chọn được tầng: "tầng này có những căn nào, trông ra sao, căn nào còn trống".
 */
export function FloorPlan({
  model,
  floor,
  selectedUnitId,
  onSelect,
}: {
  model: BuildingModel;
  floor: number;
  selectedUnitId: string | null;
  onSelect: (unitId: string) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const ring = useMemo(() => openRing(model.footprint as LngLat[]), [model.footprint]);

  const plan = useMemo(() => {
    if (ring.length < 3) return null;
    const proj = makeProjection(centroid(ring));
    const cells = buildCells({ ...model, footprint: ring }).features.filter(
      (f) => f.properties.floor === floor,
    );
    const outline = ring.map(proj.toXY);
    const xs = outline.map((p) => p[0]);
    const ys = outline.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = Math.max(maxX - minX, maxY - minY) * 0.06;
    const k = W / (maxX - minX + pad * 2);
    const H = (maxY - minY + pad * 2) * k;
    // Bắc lên trên: trục y của SVG hướng xuống nên lật lại.
    const to = (p: [number, number]): [number, number] => [
      (p[0] - minX + pad) * k,
      (maxY - p[1] + pad) * k,
    ];
    return {
      H,
      outline: outline.map(to),
      cells: cells.map((f) => {
        const pts = (f.geometry.coordinates[0] as LngLat[])
          .slice(0, -1)
          .map((p) => to(proj.toXY(p)));
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const bx = Math.min(...pts.map((p) => p[0]));
        const by = Math.min(...pts.map((p) => p[1]));
        const bw = Math.max(...pts.map((p) => p[0])) - bx;
        const bh = Math.max(...pts.map((p) => p[1])) - by;
        return { f, pts, cx, cy, bx, by, bw, bh };
      }),
    };
  }, [ring, model, floor]);

  if (!plan)
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Toà nhà chưa có khung — chưa vẽ được mặt bằng.
      </div>
    );

  const units = new Map(model.units.map((u) => [u.id, u]));
  const pathOf = (pts: [number, number][]) => `M${pts.map((p) => p.join(",")).join("L")}Z`;
  // Chữ cố định theo hệ toạ độ vẽ (W=1000): đủ to để đọc được cả khi mặt bằng co còn ~300px
  // trên điện thoại.
  const font = 40;

  return (
    <svg
      viewBox={`0 0 ${W} ${plan.H}`}
      className="h-full w-full"
      role="img"
      aria-label={`Mặt bằng tầng ${floor}`}
    >
      <defs>
        {plan.cells.map((c, i) => (
          <clipPath key={i} id={`${uid}-c${i}`}>
            <path d={pathOf(c.pts)} />
          </clipPath>
        ))}
        <radialGradient id={`${uid}-shade`} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0.15" />
        </radialGradient>
      </defs>

      {/* Sàn + hành lang: nền khung toà nhà */}
      <path d={pathOf(plan.outline)} fill="#e2e8f0" stroke="#64748b" strokeWidth={6} />

      {plan.cells.map((c, i) => {
        const u = c.f.properties.unitId ? units.get(c.f.properties.unitId) : null;
        const img = u?.listing?.imageUrls?.[0];
        const selected = !!u && u.id === selectedUnitId;
        const sub = u?.listing
          ? // Giá gọn ("4,7 tr/tháng") cho vừa ô — giá đầy đủ ở thẻ căn bên cạnh.
            `${formatCurrency(u.listing.price, { compact: true })}${u.listing.type === 2 ? "/tháng" : ""}`
          : u
            ? u.status === 1
              ? "Còn trống"
              : u.status === 3
                ? "Đang sửa"
                : "Có người"
            : "Chưa khai căn";
        const dark = !!img || c.f.properties.kind === "listed";
        return (
          <g
            key={i}
            onClick={() => u && onSelect(u.id)}
            className={u ? "cursor-pointer" : undefined}
            role={u ? "button" : undefined}
            aria-label={u ? `${u.name}, ${sub}` : undefined}
          >
            <path d={pathOf(c.pts)} fill={CELL_COLORS[c.f.properties.kind]} />
            {img && (
              <g clipPath={`url(#${uid}-c${i})`}>
                <image
                  href={img}
                  x={c.bx}
                  y={c.by}
                  width={c.bw}
                  height={c.bh}
                  preserveAspectRatio="xMidYMid slice"
                />
                <rect x={c.bx} y={c.by} width={c.bw} height={c.bh} fill={`url(#${uid}-shade)`} />
                {/* dải màu tình trạng ở mép trên */}
                <rect
                  x={c.bx}
                  y={c.by}
                  width={c.bw}
                  height={font * 0.35}
                  fill={CELL_COLORS[c.f.properties.kind]}
                />
              </g>
            )}
            <path
              d={pathOf(c.pts)}
              fill="none"
              stroke={selected ? "#2563eb" : "#ffffff"}
              strokeWidth={selected ? 10 : 5}
            />
            {/* Nhãn ở tâm ô (các ô nằm xoay theo hướng toà nhà nên mép khung bao không
                trùng mép ô). Chữ trắng trên ảnh có viền tối cho dễ đọc. */}
            <text
              x={c.cx}
              y={c.cy - font * 0.1}
              textAnchor="middle"
              fontSize={font}
              fontWeight={700}
              fill={dark ? "#ffffff" : "#0f172a"}
              stroke={dark ? "rgba(0,0,0,0.55)" : "none"}
              strokeWidth={font * 0.14}
              paintOrder="stroke"
            >
              {c.f.properties.name}
            </text>
            <text
              x={c.cx}
              y={c.cy + font * 0.9}
              textAnchor="middle"
              fontSize={font * 0.72}
              fontWeight={dark ? 600 : 400}
              fill={dark ? "#ffffff" : "#334155"}
              stroke={dark ? "rgba(0,0,0,0.55)" : "none"}
              strokeWidth={font * 0.12}
              paintOrder="stroke"
            >
              {sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
