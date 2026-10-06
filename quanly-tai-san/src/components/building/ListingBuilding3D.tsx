import { useEffect, useState } from "react";
import { unitLabel } from "@/lib/buildingGeometry";
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
import { buildingModelApi } from "@/lib/api/buildingModel";
import { CELL_COLORS } from "@/lib/buildingGeometry";
import { BuildingFacade } from "./BuildingFacade";
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
              floors={model.floors}
              units={model.units}
              focusUnitId={model.focusUnitId}
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
                Tin này là{" "}
                <span className="font-semibold text-foreground">{unitLabel(focus.name)}</span>, tầng{" "}
                {focus.floor} — viền xanh trên hình.
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
