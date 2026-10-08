import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Box, LayoutGrid, Layers } from "lucide-react";
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
import type { BuildingSceneProps } from "./BuildingScene";
import { FloorPlan } from "./FloorPlan";
import { UnitPhotos } from "./UnitPhotos";

const LEGEND: CellKind[] = ["listed", "vacant", "occupied", "maintenance"];

/**
 * Khám phá toà nhà: Toà nhà → Tầng → Căn.
 *
 * Bố cục như một sơ đồ toà nhà thật: thanh tầng đứng dọc ngay trên mô hình (như bảng nút
 * thang máy), chú giải màu nằm trong khung — mắt không phải chạy qua lại giữa mô hình và một
 * danh sách dài ở cột bên. Cột bên chỉ còn ba việc: con số tổng, căn đang chọn, và các căn
 * của tầng đang chọn. Bấm khối căn trên mô hình hay bấm ở danh sách đều cùng một trạng thái
 * chọn (danh sách là lối dùng được bằng bàn phím và trên máy không dựng được 3D).
 */
export function BuildingExplorer({
  model,
  currentSlug,
  height = 460,
  editorPreview = false,
  scene,
}: {
  model: BuildingModel;
  /** Tin đang xem — căn của nó ghi "bạn đang xem tin này" thay vì liên kết. */
  currentSlug?: string;
  height?: number | string;
  /** Xem trước trong xưởng dựng: không dẫn sang trang tin. */
  editorPreview?: boolean;
  /** Mô phỏng nắng và lượt bay quanh toà nhà — chuyển thẳng xuống cảnh 3D. */
  scene?: Pick<
    BuildingSceneProps,
    "sunTime" | "sunEnabled" | "tourSignal" | "facadeAzimuth" | "onTourEnd"
  >;
}) {
  const { map: byFloor, unplaced } = useMemo(() => unitsByFloor(model), [model]);
  const focus = model.units.find((u) => u.id === model.focusUnitId) ?? null;
  const [unitId, setUnitId] = useState<string | null>(focus?.id ?? null);
  const [floor, setFloor] = useState<number | null>(focus?.floor ?? null);
  const unit = model.units.find((u) => u.id === unitId) ?? null;
  // "3D" (khối toà nhà) hay "Mặt bằng" (một tầng nhìn từ trên xuống, ảnh căn lấp ô).
  const [view, setView] = useState<"3d" | "plan">("3d");

  const floors = Array.from({ length: model.floors }, (_, i) => model.floors - i);
  const vacantTotal = model.units.filter((u) => u.status === 1).length;
  const listedTotal = model.units.filter((u) => u.listing).length;
  const floorUnits = floor != null ? (byFloor.get(floor) ?? []) : [];
  const vacantFloors = floors
    .map((f) => ({ f, n: (byFloor.get(f) ?? []).filter((u) => u.status === 1).length }))
    .filter((x) => x.n > 0);

  const pickFloor = (f: number | null) => {
    setFloor(f);
    if (f == null || unit?.floor !== f) setUnitId(null);
    if (f == null) setView("3d");
  };
  // Mở mặt bằng khi chưa chọn tầng: lấy tầng cao nhất có căn trống (hoặc có căn).
  const openPlan = () => {
    if (floor == null) {
      const withUnits = floors.filter((f) => (byFloor.get(f)?.length ?? 0) > 0);
      const best =
        withUnits.find((f) => byFloor.get(f)!.some((u) => u.status === 1)) ?? withUnits[0] ?? null;
      if (best == null) return;
      setFloor(best);
    }
    setView("plan");
  };
  const showPlan = view === "plan" && floor != null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="relative overflow-hidden rounded-xl border bg-muted" style={{ height }}>
        <BuildingSceneClient
          building={model}
          center={[model.longitude ?? 106.7, model.latitude ?? 10.78]}
          selectedFloor={floor}
          selectedUnitId={unitId}
          onSelect={(id, f) => {
            setUnitId(id);
            if (f != null) setFloor(f);
          }}
          height="100%"
          showcase
          fallbackImage={model.buildingImages?.[0] ?? null}
          {...scene}
        />

        {/* Mặt bằng phủ lên trên — cảnh 3D vẫn dựng bên dưới để chuyển lại không phải tải
            bản đồ lần nữa (mỗi lần tải là một lượt tính phí Mapbox). */}
        {showPlan && (
          <div className="absolute inset-0 z-10 flex flex-col bg-card pb-4 pl-16 pr-2 pt-14 sm:pl-20 sm:pr-4">
            <p className="mb-2 text-sm font-medium">
              Tầng {floor}{" "}
              <span className="font-normal text-muted-foreground">· nhìn từ trên xuống</span>
            </p>
            <div className="min-h-0 flex-1">
              <FloorPlan
                model={model}
                floor={floor!}
                selectedUnitId={unitId}
                onSelect={(id) => setUnitId(id)}
              />
            </div>
          </div>
        )}

        {/* 3D / Mặt bằng */}
        <div
          role="group"
          aria-label="Kiểu xem"
          className="absolute right-14 top-3 z-20 inline-flex rounded-lg border bg-card/95 p-0.5 shadow-sm backdrop-blur"
        >
          <button
            type="button"
            aria-pressed={!showPlan}
            onClick={() => setView("3d")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium",
              !showPlan ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Box className="h-3.5 w-3.5" /> 3D
          </button>
          <button
            type="button"
            aria-pressed={showPlan}
            onClick={openPlan}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium",
              showPlan ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Mặt bằng
          </button>
        </div>

        {/* Thanh tầng — như bảng nút thang máy, tầng cao ở trên. */}
        <div className="pointer-events-none absolute inset-y-3 left-3 z-20 flex flex-col justify-center">
          <div
            role="group"
            aria-label="Chọn tầng"
            className="pointer-events-auto flex max-h-full flex-col gap-0.5 overflow-y-auto rounded-lg border bg-card/90 p-1 shadow-sm backdrop-blur"
          >
            <FloorButton active={floor == null} onClick={() => pickFloor(null)} title="Cả toà nhà">
              <Layers className="h-3.5 w-3.5" />
            </FloorButton>
            {floors.map((f) => {
              const list = byFloor.get(f) ?? [];
              const vacant = list.filter((u) => u.status === 1).length;
              return (
                <FloorButton
                  key={f}
                  active={floor === f}
                  onClick={() => pickFloor(floor === f ? null : f)}
                  title={`Tầng ${f}${list.length ? ` · ${vacant}/${list.length} trống` : ""}`}
                >
                  <span className="tabular-nums">{f}</span>
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      vacant > 0 ? "bg-emerald-500" : "bg-transparent",
                    )}
                  />
                </FloorButton>
              );
            })}
          </div>
        </div>

        {/* Chú giải màu — nằm trong khung, cạnh thứ nó giải thích. */}
        <div
          className={cn(
            "pointer-events-none absolute left-16 right-48 top-3 hidden flex-wrap gap-1.5 lg:flex",
            showPlan && "lg:hidden",
          )}
        >
          {LEGEND.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card/90 px-2 py-0.5 text-[11px] font-medium shadow-sm backdrop-blur"
            >
              <span
                className="h-2.5 w-2.5 rounded-sm border border-black/10"
                style={{ background: CELL_COLORS[k] }}
              />
              {CELL_LABELS[k]}
            </span>
          ))}
        </div>

        <p className="pointer-events-none absolute bottom-8 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground/70 px-3 py-1 text-[11px] text-background sm:block">
          {showPlan
            ? "Bấm vào một căn để xem ảnh và giá"
            : "Bấm vào một căn · kéo chuột phải để xoay · cuộn để phóng to"}
        </p>
      </div>

      <div className="space-y-3">
        {/* Điện thoại: chú giải nằm dưới mô hình, không đè lên khối nhà. */}
        <div className="-mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground lg:hidden">
          {LEGEND.map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-sm border border-black/10"
                style={{ background: CELL_COLORS[k] }}
              />
              {CELL_LABELS[k]}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Tầng" value={model.floors} />
          <Stat label="Căn trống" value={`${vacantTotal}/${model.units.length}`} good />
          <Stat label="Đang đăng tin" value={listedTotal} />
        </div>

        {unit ? (
          <UnitCard
            unit={unit}
            currentSlug={currentSlug}
            editorPreview={editorPreview}
            fallbackImages={model.buildingImages ?? []}
            onClose={() => setUnitId(null)}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Bấm vào một khối căn trên mô hình — hoặc chọn tầng — để xem căn đó còn trống không và
            giá bao nhiêu.
          </div>
        )}

        {floor != null ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">Tầng {floor}</p>
              <span className="text-xs text-muted-foreground">
                {floorUnits.length === 0
                  ? "chưa khai căn"
                  : `${floorUnits.filter((u) => u.status === 1).length}/${floorUnits.length} trống`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {floorUnits.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUnitId(u.id)}
                  aria-pressed={u.id === unitId}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60",
                    u.id === unitId && "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                >
                  {u.listing?.imageUrls?.[0] ? (
                    <img
                      src={u.listing.imageUrls[0]}
                      alt=""
                      loading="lazy"
                      className="h-9 w-12 shrink-0 rounded border-l-4 object-cover"
                      style={{ borderLeftColor: CELL_COLORS[cellKind(u)] }}
                    />
                  ) : (
                    <span
                      className="h-9 w-1.5 shrink-0 rounded-full border border-black/10"
                      style={{ background: CELL_COLORS[cellKind(u)] }}
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium">{u.name}</span>
                    <span className="block truncate text-muted-foreground">
                      {u.area ? `${u.area} m²` : STATUS_TEXT[u.status]}
                      {u.listing ? " · có tin" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          vacantFloors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Tầng còn căn trống</p>
              <div className="flex flex-wrap gap-1.5">
                {vacantFloors.map(({ f, n }) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => pickFloor(f)}
                    className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted/60"
                  >
                    Tầng {f} · <span className="font-medium text-emerald-700">{n} trống</span>
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {unplaced.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {unplaced.length} căn chưa ghi số tầng nên không hiện trên mô hình:{" "}
            {unplaced.map((u) => u.name).join(", ")}.
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Mô hình dựng từ khung toà nhà và danh sách căn chủ nhà khai — vị trí căn trên mỗi tầng là
          sơ đồ minh hoạ, không phải bản vẽ kiến trúc.
        </p>
      </div>
    </div>
  );
}

function FloorButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "flex h-7 min-w-10 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, good }: { label: string; value: React.ReactNode; good?: boolean }) {
  return (
    <div className="rounded-lg border px-2.5 py-2">
      <div className={cn("text-lg font-semibold tabular-nums", good && "text-emerald-700")}>
        {value}
      </div>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
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
  fallbackImages,
  onClose,
}: {
  unit: BuildingUnit;
  currentSlug?: string;
  editorPreview: boolean;
  /** Ảnh chung của toà nhà — cho căn chưa có tin. */
  fallbackImages: string[];
  onClose: () => void;
}) {
  const l = unit.listing;
  const isCurrent = !!l && l.slug === currentSlug;
  const own = l?.imageUrls ?? [];
  return (
    <div className="space-y-2.5 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
      <UnitPhotos
        images={own.length ? own : fallbackImages}
        shared={own.length === 0 && fallbackImages.length > 0}
        alt={`Ảnh ${unit.name}`}
      />
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{unit.name}</div>
          <div className="text-xs text-muted-foreground">
            Tầng {unit.floor ?? "?"}
            {unit.area ? ` · ${unit.area} m²` : ""}
          </div>
        </div>
        <Badge
          variant={unit.status === 1 ? "default" : "secondary"}
          className={unit.status === 1 ? "bg-emerald-600 text-white hover:bg-emerald-600" : ""}
        >
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
