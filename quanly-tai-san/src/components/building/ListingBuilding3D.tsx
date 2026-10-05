import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Building2, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildingModelApi, type BuildingModel } from "@/lib/api/buildingModel";
import { CELL_COLORS, cellKind, unitsByFloor } from "@/lib/buildingGeometry";
import { BuildingExplorer } from "./BuildingExplorer";
import { BuildingSceneClient } from "./BuildingSceneClient";

/**
 * "Xem 3D" ở trang chi tiết tin.
 *
 *   • Chủ nhà đã dựng mô hình → thẻ có hình mặt đứng toà nhà (SVG, tô màu từng căn theo tình
 *     trạng, căn của tin này viền nổi) — người xem thấy ngay "còn bao nhiêu căn trống, căn này
 *     ở đâu" mà chưa cần mở gì. Bấm vào mở trình khám phá Toà nhà → Tầng → Căn.
 *   • Chưa có → khối nhà 3D của Mapbox quanh vị trí, toà nhà tại vị trí tin tô nổi bật.
 *
 * Bản đồ 3D chỉ dựng khi người dùng bấm mở — mỗi lần mở bản đồ GL là một lượt tính phí của
 * Mapbox, không đáng tốn cho mọi lượt xem trang. Hình mặt đứng thì vẽ từ dữ liệu, miễn phí.
 */
export function ListingBuilding3D({
  slug,
  lat,
  lng,
  autoOpen = false,
}: {
  slug: string;
  lat: number;
  lng: number;
  /** Mở sẵn hộp thoại khi trang mở (đi tới từ bản đồ tìm kiếm) — chỉ khi có mô hình. */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["listing-building", slug],
    queryFn: () => buildingModelApi.forListing(slug),
    staleTime: 60_000,
    retry: 0,
  });
  const model = q.data ?? null;
  const focus = model?.units.find((u) => u.id === model.focusUnitId);
  const vacant = model?.units.filter((u) => u.status === 1).length ?? 0;
  const listed = model?.units.filter((u) => u.listing).length ?? 0;

  useEffect(() => {
    if (autoOpen && model) setOpen(true);
  }, [autoOpen, model]);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {model ? (
        <div className="grid sm:grid-cols-[240px_minmax(0,1fr)]">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Mở mô hình 3D của toà nhà"
            className="group relative flex items-end justify-center bg-gradient-to-b from-primary/5 to-muted/70 px-6 pb-4 pt-8 transition-colors hover:from-primary/10"
          >
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-card/90 px-1.5 py-0.5 text-[11px] font-semibold shadow-sm">
              <Box className="h-3 w-3" /> 3D
            </span>
            <BuildingFacade
              model={model}
              className="h-44 w-auto transition-transform duration-300 group-hover:-translate-y-0.5"
            />
          </button>

          <div className="flex flex-col gap-3 p-5">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> Toà nhà 3D
              </p>
              <h3 className="mt-1 text-lg font-semibold leading-snug tracking-tight">
                {model.assetName}
              </h3>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              <Chip>{model.floors} tầng</Chip>
              <Chip>{model.units.length} căn</Chip>
              <Chip strong>{vacant} căn trống</Chip>
              {listed > 0 && <Chip>{listed} đang đăng tin</Chip>}
            </div>

            {focus && (
              <p className="text-sm text-muted-foreground">
                Tin này là căn <span className="font-semibold text-foreground">{focus.name}</span>,
                tầng {focus.floor} — viền xanh trên hình.
              </p>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button onClick={() => setOpen(true)} disabled={q.isLoading}>
                <Box className="mr-1.5 h-4 w-4" />
                Khám phá toà nhà 3D
              </Button>
              <MiniLegend />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MapIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Xem khu vực ở dạng 3D</p>
            <p className="text-sm text-muted-foreground">
              Toà nhà cao bao nhiêu, sát nhà nào, mặt tiền hướng ra đâu.
            </p>
          </div>
          <Button variant="outline" onClick={() => setOpen(true)} disabled={q.isLoading}>
            <Box className="mr-1.5 h-4 w-4" />
            Xem 3D
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[96vh] w-[96vw] max-w-6xl gap-3 overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{model ? model.assetName : "Vị trí ở dạng 3D"}</DialogTitle>
            <DialogDescription>
              {model
                ? "Chọn tầng ở thanh bên trái mô hình, bấm vào một căn để xem tình trạng và tin đăng."
                : "Khối nhà 3D từ dữ liệu bản đồ Mapbox; toà nhà tại vị trí tin được tô màu xanh (nếu bản đồ có dữ liệu toà nhà đó)."}
            </DialogDescription>
          </DialogHeader>
          {open &&
            (model ? (
              <BuildingExplorer
                model={model}
                currentSlug={slug}
                height="clamp(340px, 62vh, 620px)"
              />
            ) : (
              <BuildingSceneClient
                building={null}
                center={[lng, lat]}
                highlight={[lng, lat]}
                height="clamp(340px, 62vh, 620px)"
              />
            ))}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Chip({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={
        strong
          ? "rounded-full bg-emerald-600/10 px-2.5 py-1 font-medium text-emerald-700"
          : "rounded-full border px-2.5 py-1 text-muted-foreground"
      }
    >
      {children}
    </span>
  );
}

function MiniLegend() {
  const items = [
    ["listed", "Trống, có tin"],
    ["vacant", "Trống"],
    ["occupied", "Có người"],
  ] as const;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {items.map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span
            className="h-2.5 w-2.5 rounded-sm border border-black/10"
            style={{ background: CELL_COLORS[k] }}
          />
          {label}
        </span>
      ))}
    </span>
  );
}

const FOCUS = "#2563eb";

/**
 * Mặt đứng toà nhà vẽ từ dữ liệu: mỗi hàng một tầng (tầng cao ở trên), mỗi ô một căn tô theo
 * tình trạng, căn của tin đang xem viền xanh. Thêm một mặt bên xiên cho có khối — đủ để đọc
 * ra "toà nhà" mà không cần WebGL. Toà rất cao thì thu chiều cao mỗi tầng lại cho vừa khung.
 */
function BuildingFacade({ model, className }: { model: BuildingModel; className?: string }) {
  const { map: byFloor } = useMemo(() => unitsByFloor(model), [model]);
  const floors = Math.max(model.floors, 1);
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
      const isFocus = u.id === model.focusUnitId;
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
