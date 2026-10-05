import { useMemo } from "react";
import type { BuildingUnit } from "@/lib/api/buildingModel";
import { CELL_COLORS, cellKind, unitsByFloor } from "@/lib/buildingGeometry";

const FOCUS = "#2563eb";

/**
 * Mặt đứng toà nhà vẽ từ dữ liệu: mỗi hàng một tầng (tầng cao ở trên), mỗi ô một căn tô theo
 * tình trạng, căn của tin đang xem viền xanh. Thêm một mặt bên xiên cho có khối — đủ để đọc
 * ra "toà nhà" mà không cần WebGL. Toà rất cao thì thu chiều cao mỗi tầng lại cho vừa khung.
 */
export function BuildingFacade({
  floors: floorCount,
  units,
  focusUnitId = null,
  className,
}: {
  floors: number;
  units: BuildingUnit[];
  /** Căn được viền xanh — căn của tin đang xem, hoặc căn đang chọn. */
  focusUnitId?: string | null;
  className?: string;
}) {
  const { map: byFloor } = useMemo(
    () =>
      unitsByFloor({ footprint: [], floors: Math.max(floorCount, 1), floorHeightMeters: 3, units }),
    [floorCount, units],
  );
  const floors = Math.max(floorCount, 1);
  const cols = Math.max(1, ...Array.from(byFloor.values()).map((l) => l.length));

  const W = 132;
  const rowH = Math.max(6, Math.min(18, 150 / floors));
  const H = rowH * floors;
  const roof = 8;
  const depth = 16; // mặt bên xiên
  const pad = 3;
  const vbW = W + depth + 2;
  const vbH = H + roof + depth + 10;
  const top = depth + roof;

  const cells: React.ReactNode[] = [];
  for (let f = 1; f <= floors; f++) {
    const list = byFloor.get(f) ?? [];
    const y = top + (floors - f) * rowH;
    const n = Math.max(list.length, 1);
    const cw = (W - pad * 2) / n;
    if (list.length === 0) {
      cells.push(
        <rect
          key={`s${f}`}
          x={pad}
          y={y + 1.5}
          width={W - pad * 2}
          height={rowH - 3}
          rx={1.5}
          fill={CELL_COLORS.slab}
        />,
      );
      continue;
    }
    list.forEach((u, i) => {
      const isFocus = u.id === focusUnitId;
      cells.push(
        <rect
          key={u.id}
          x={pad + i * cw + 1}
          y={y + 1.5}
          width={cw - 2}
          height={rowH - 3}
          rx={1.5}
          fill={CELL_COLORS[cellKind(u)]}
          stroke={isFocus ? FOCUS : "rgba(15,23,42,0.08)"}
          strokeWidth={isFocus ? 2.2 : 0.6}
        >
          <title>{`${u.name} · tầng ${f}`}</title>
        </rect>,
      );
    });
  }

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className={className}
      role="img"
      aria-label={`Mặt đứng toà nhà ${floors} tầng, ${cols} căn mỗi tầng`}
    >
      {/* bóng đổ dưới chân */}
      <ellipse
        cx={W / 2 + depth / 2}
        cy={top + H + 4}
        rx={W / 2 + 10}
        ry={4}
        fill="rgba(15,23,42,0.12)"
      />
      {/* mặt bên xiên */}
      <polygon
        points={`${W},${top} ${W + depth},${top - depth} ${W + depth},${top + H - depth} ${W},${top + H}`}
        fill="#cbd5e1"
      />
      {/* mái */}
      <polygon
        points={`0,${top} ${depth},${top - depth} ${W + depth},${top - depth} ${W},${top}`}
        fill="#e2e8f0"
      />
      <rect
        x={W * 0.62}
        y={top - depth - roof + 2}
        width={W * 0.18}
        height={roof}
        rx={1}
        fill="#cbd5e1"
      />
      {/* thân */}
      <rect x={0} y={top} width={W} height={H} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={1} />
      {cells}
      {/* mặt đất */}
      <line x1={-4} x2={W + depth + 2} y1={top + H} y2={top + H} stroke="#94a3b8" strokeWidth={1} />
    </svg>
  );
}
