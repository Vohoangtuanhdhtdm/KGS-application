import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatListingPrice } from "@/lib/api/listings";
import type { BuildingModel, BuildingUnit } from "@/lib/api/buildingModel";
import {
  CELL_COLORS,
  CELL_LABELS,
  cellKind,
  unitsByFloor,
  type CellKind,
} from "@/lib/buildingGeometry";
import { BuildingSceneClient } from "./BuildingSceneClient";

const LEGEND: CellKind[] = ["listed", "vacant", "occupied", "maintenance"];

/**
 * Khám phá toà nhà: Toà nhà → Tầng → Căn. Bấm vào khối căn trên cảnh 3D, hoặc chọn tầng rồi
 * chọn căn ở danh sách bên cạnh (cùng một trạng thái chọn — danh sách là lối dùng được bằng
 * bàn phím và trên máy không dựng được 3D).
 */
export function BuildingExplorer({
  model,
  currentSlug,
  height = 460,
  editorPreview = false,
}: {
  model: BuildingModel;
  /** Tin đang xem — căn của nó ghi "bạn đang xem tin này" thay vì liên kết. */
  currentSlug?: string;
  height?: number;
  /** Xem trước trong xưởng dựng: không dẫn sang trang tin. */
  editorPreview?: boolean;
}) {
  const { map: byFloor, unplaced } = useMemo(() => unitsByFloor(model), [model]);
  const focus = model.units.find((u) => u.id === model.focusUnitId) ?? null;
  const [unitId, setUnitId] = useState<string | null>(focus?.id ?? null);
  const [floor, setFloor] = useState<number | null>(focus?.floor ?? null);
  const unit = model.units.find((u) => u.id === unitId) ?? null;

  const floors = Array.from({ length: model.floors }, (_, i) => model.floors - i);
  const vacantTotal = model.units.filter((u) => u.status === 1).length;
  const listedTotal = model.units.filter((u) => u.listing).length;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-2">
        <BuildingSceneClient
          building={model}
          center={[model.longitude ?? 106.7, model.latitude ?? 10.78]}
          selectedFloor={floor}
          selectedUnitId={unitId}
          onSelect={(id, f) => {
            setUnitId(id);
            if (f != null) setFloor(f);
          }}
          height={height}
        />
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {LEGEND.map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-sm border" style={{ background: CELL_COLORS[k] }} />
              {CELL_LABELS[k]}
            </span>
          ))}
          <span>· Kéo chuột phải (hoặc Ctrl + kéo) để xoay</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm">
          <span className="font-medium">{model.floors} tầng</span> · {model.units.length} căn ·{" "}
          <span className="text-emerald-700">{vacantTotal} trống</span>
          {listedTotal > 0 && <> · {listedTotal} đang đăng tin</>}
        </div>

        {unit && (
          <UnitCard
            unit={unit}
            currentSlug={currentSlug}
            editorPreview={editorPreview}
            onClose={() => setUnitId(null)}
          />
        )}

        <div className="rounded-md border">
          <button
            type="button"
            onClick={() => {
              setFloor(null);
              setUnitId(null);
            }}
            className={cn(
              "flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted/60",
              floor == null && "bg-muted font-medium",
            )}
          >
            <Layers className="h-4 w-4" /> Cả toà nhà
          </button>
          <div className="max-h-[300px] overflow-y-auto">
            {floors.map((f) => {
              const list = byFloor.get(f) ?? [];
              const vacant = list.filter((u) => u.status === 1).length;
              const active = floor === f;
              return (
                <div key={f} className={cn("border-b last:border-b-0", active && "bg-muted/60")}>
                  <button
                    type="button"
                    aria-expanded={active}
                    onClick={() => {
                      setFloor(active ? null : f);
                      if (!active && unit?.floor !== f) setUnitId(null);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
                  >
                    <span className={cn(active && "font-medium")}>Tầng {f}</span>
                    <span className="text-xs text-muted-foreground">
                      {list.length === 0 ? "chưa khai căn" : `${vacant}/${list.length} trống`}
                    </span>
                  </button>
                  {active && list.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                      {list.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setUnitId(u.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs",
                            u.id === unitId
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background",
                          )}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: CELL_COLORS[cellKind(u)] }}
                          />
                          {u.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {unplaced.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {unplaced.length} căn chưa ghi số tầng nên không hiện trên mô hình:{" "}
            {unplaced.map((u) => u.name).join(", ")}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Mô hình dựng từ khung toà nhà và danh sách căn chủ nhà khai — vị trí căn trên mỗi tầng là
          sơ đồ minh hoạ, không phải bản vẽ kiến trúc.
        </p>
      </div>
    </div>
  );
}

const STATUS_TEXT: Record<BuildingUnit["status"], string> = {
  1: "Còn trống",
  2: "Đã có người",
  3: "Đang sửa chữa",
};

function UnitCard({
  unit,
  currentSlug,
  editorPreview,
  onClose,
}: {
  unit: BuildingUnit;
  currentSlug?: string;
  editorPreview: boolean;
  onClose: () => void;
}) {
  const l = unit.listing;
  const isCurrent = !!l && l.slug === currentSlug;
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{unit.name}</div>
          <div className="text-xs text-muted-foreground">
            Tầng {unit.floor ?? "?"}
            {unit.area ? ` · ${unit.area} m²` : ""}
          </div>
        </div>
        <Badge variant={unit.status === 1 ? "default" : "secondary"}>
          {STATUS_TEXT[unit.status]}
        </Badge>
      </div>
      {l ? (
        <div className="mt-2 space-y-1.5">
          <div className="line-clamp-2">{l.title}</div>
          <div className="font-semibold text-price">
            {formatListingPrice(l.price, l.type, l.rentPaymentCycle)}
          </div>
          {isCurrent ? (
            <div className="text-xs text-muted-foreground">Bạn đang xem tin của căn này.</div>
          ) : editorPreview ? (
            <div className="text-xs text-muted-foreground">
              Người tìm nhà bấm vào đây sẽ mở tin.
            </div>
          ) : (
            <Button asChild size="sm" className="w-full">
              <Link to="/tin-dang/$slug" params={{ slug: l.slug }}>
                Xem tin & liên hệ <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {unit.status === 1
            ? "Căn này còn trống nhưng chưa đăng tin — có thể hỏi chủ nhà qua tin bạn đang xem."
            : "Căn này hiện không cho thuê/bán."}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-2 text-xs text-muted-foreground underline"
      >
        Bỏ chọn
      </button>
    </div>
  );
}
