import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { unitLabel } from "@/lib/buildingGeometry";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Box, ExternalLink, Loader2, MapPin, Plus, Send, Trash2 } from "lucide-react";
import { buildingsApi, type OwnerBuildingUnit } from "@/lib/api/buildings";
import { assetsApi } from "@/lib/api/assets";
import { getErrorMessage } from "@/lib/api/errors";
import {
  LISTING_STATUS,
  LISTING_STATUS_CLASS,
  UNIT_STATUS,
  type UnitStatusCode,
} from "@/constants/enums";
import { CELL_COLORS, cellKind } from "@/lib/buildingGeometry";
import { BuildingStudio } from "@/components/building/BuildingStudio";
import { BuildingFacade } from "@/components/building/BuildingFacade";
import { buildingStats, isPostable, toFacadeUnits } from "@/components/building/ownerBuildingUnits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tab = "units" | "3d";

export const Route = createFileRoute("/toa-nha/$id")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    s.tab === "3d" ? { tab: "3d" } : {},
  head: () => ({ meta: [{ title: "Toà nhà — KGS" }] }),
  component: BuildingPage,
});

function BuildingPage() {
  const { id } = Route.useParams();
  const { tab = "units" } = Route.useSearch();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["owner-buildings"], queryFn: buildingsApi.mine });
  const b = q.data?.find((x) => x.assetId === id) ?? null;
  const facadeUnits = useMemo(() => (b ? toFacadeUnits(b.units) : []), [b]);

  if (q.isLoading) return <Skeleton className="mx-auto mt-6 h-[480px] max-w-[1180px] rounded-xl" />;
  if (!b)
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-muted-foreground">
        Không tìm thấy toà nhà.{" "}
        <Link to="/toa-nha" className="text-primary underline">
          Về danh sách
        </Link>
      </div>
    );

  const s = buildingStats(b);
  const setTab = (t: Tab) =>
    navigate({
      to: "/toa-nha/$id",
      params: { id },
      search: t === "3d" ? { tab: "3d" } : {},
      replace: true,
    });

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-6 sm:px-6">
      <Link
        to="/toa-nha"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Toà nhà &amp; khu trọ
      </Link>

      <div className="flex flex-wrap items-end gap-5">
        <BuildingFacade floors={b.floors} units={facadeUnits} className="h-24 w-auto" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{b.name}</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {[b.addressDetail, b.ward, b.district, b.city].filter(Boolean).join(", ")}
          </p>
          <p className="mt-1 text-sm">
            {b.floors} tầng · {s.units} căn ·{" "}
            <span className="font-medium text-emerald-700">{s.vacant} trống</span> · {s.live} tin
            đang hiển thị
          </p>
        </div>
      </div>

      {!b.published && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <Box className="h-4 w-4 shrink-0 text-warning" />
          <span className="flex-1">
            {b.hasModel
              ? "Mô hình 3D chưa công khai — người tìm nhà chưa xem được toà nhà này ở dạng 3D."
              : "Chưa dựng mô hình 3D. Mất chưa tới một phút: khung toà nhà được lấy tự động từ bản đồ."}
          </span>
          {tab !== "3d" && (
            <Button size="sm" variant="outline" onClick={() => setTab("3d")}>
              {b.hasModel ? "Mở mô hình 3D" : "Dựng mô hình 3D"}
            </Button>
          )}
        </div>
      )}

      <div className="inline-flex rounded-lg border bg-card p-0.5" role="tablist">
        {(
          [
            ["units", "Căn & tin đăng"],
            ["3d", "Mô hình 3D"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "3d" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Khung toà nhà, số tầng, chiều cao tầng — rồi bật <b>Công khai</b> để người tìm nhà xem
            được. Các căn và tin đăng hiện trên mô hình theo số tầng ở tab "Căn &amp; tin đăng".
          </p>
          <BuildingStudio assetId={id} />
        </div>
      ) : (
        <UnitsBoard assetId={id} floors={b.floors} units={b.units} />
      )}
    </div>
  );
}

/* ============================== Bảng căn theo tầng ============================== */

function UnitsBoard({
  assetId,
  floors,
  units,
}: {
  assetId: string;
  floors: number;
  units: OwnerBuildingUnit[];
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<OwnerBuildingUnit | null>(null);
  const floorList = Array.from({ length: floors }, (_, i) => floors - i);
  const byFloor = new Map<number, OwnerBuildingUnit[]>();
  for (const u of units) {
    const f = u.floor ?? 0;
    byFloor.set(f, [...(byFloor.get(f) ?? []), u]);
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["owner-buildings"] });
    qc.invalidateQueries({ queryKey: ["building-model", assetId] });
  };

  const addUnit = useMutation({
    mutationFn: (floor: number) => {
      const list = byFloor.get(floor) ?? [];
      let n = list.length + 1;
      const names = new Set(units.map((u) => u.name));
      let name = `P.${floor}${String(n).padStart(2, "0")}`;
      while (names.has(name)) name = `P.${floor}${String(++n).padStart(2, "0")}`;
      return assetsApi.units.create(assetId, {
        name,
        floorNumber: floor,
        area: list[0]?.area ?? null,
      });
    },
    onSuccess: refresh,
    onError: (e) => toast.error(getErrorMessage(e, "Không thêm được căn")),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(["listed", "vacant", "occupied", "maintenance"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm border border-black/10"
              style={{ background: CELL_COLORS[k] }}
            />
            {k === "listed"
              ? "Có tin đang hiển thị"
              : k === "vacant"
                ? "Trống"
                : k === "occupied"
                  ? "Có người"
                  : "Đang sửa"}
          </span>
        ))}
        <span>· Bấm vào một căn để sửa tên, diện tích, tình trạng.</span>
      </div>

      <Card className="divide-y py-0">
        {floorList.map((f) => {
          const list = byFloor.get(f) ?? [];
          return (
            <div key={f} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
              <div className="w-20 shrink-0 pt-1.5 text-sm font-medium">Tầng {f}</div>
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((u) => (
                  <UnitTile key={u.id} u={u} assetId={assetId} onEdit={() => setEditing(u)} />
                ))}
                <button
                  type="button"
                  onClick={() => addUnit.mutate(f)}
                  disabled={addUnit.isPending}
                  className="flex min-h-[72px] items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted/50"
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm căn
                </button>
              </div>
            </div>
          );
        })}
        {(byFloor.get(0)?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-2 p-3 sm:flex-row">
            <div className="w-20 shrink-0 pt-1.5 text-sm font-medium text-muted-foreground">
              Chưa có tầng
            </div>
            <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {byFloor.get(0)!.map((u) => (
                <UnitTile key={u.id} u={u} assetId={assetId} onEdit={() => setEditing(u)} />
              ))}
            </div>
          </div>
        )}
      </Card>

      {editing && (
        <EditUnitDialog
          assetId={assetId}
          unit={editing}
          maxFloor={floors}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function UnitTile({
  u,
  assetId,
  onEdit,
}: {
  u: OwnerBuildingUnit;
  assetId: string;
  onEdit: () => void;
}) {
  const kind = cellKind({
    status: u.status,
    listing:
      u.listingStatus === 2
        ? { slug: "", title: "", price: 0, type: 2, rentPaymentCycle: null }
        : null,
  });
  return (
    <div className="flex min-h-[72px] gap-2 rounded-lg border bg-card p-2">
      <span
        className="w-1.5 shrink-0 rounded-full border border-black/10"
        style={{ background: CELL_COLORS[kind] }}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <button type="button" onClick={onEdit} className="block w-full text-left">
          <span className="block text-sm font-medium hover:underline">{u.name}</span>
          <span className="block text-xs text-muted-foreground">
            {u.area ? `${u.area} m² · ` : ""}
            {UNIT_STATUS[u.status]}
          </span>
        </button>
        {u.listingId ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${LISTING_STATUS_CLASS[u.listingStatus!]}`}
            >
              {LISTING_STATUS[u.listingStatus!]}
            </span>
            <Link
              to="/dang-tin"
              search={{ id: u.listingId }}
              className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
            >
              Mở tin <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        ) : isPostable(u) && u.status === 1 ? (
          <Link
            to="/dang-tin"
            search={{ toaNha: assetId, can: u.id }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <Send className="h-3 w-3" /> Đăng tin căn này
          </Link>
        ) : null}
      </div>
    </div>
  );
}

const STATUS_OPTIONS: UnitStatusCode[] = [1, 2, 3];

function EditUnitDialog({
  assetId,
  unit,
  maxFloor,
  onClose,
  onSaved,
}: {
  assetId: string;
  unit: OwnerBuildingUnit;
  maxFloor: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(unit.name);
  const [floor, setFloor] = useState(String(unit.floor ?? ""));
  const [area, setArea] = useState(unit.area?.toString() ?? "");
  const [status, setStatus] = useState<UnitStatusCode>(unit.status);

  const save = useMutation({
    mutationFn: () =>
      assetsApi.units.update(assetId, unit.id, {
        name: name.trim(),
        floorNumber: floor ? Math.max(1, Math.min(maxFloor, Number(floor))) : null,
        area: area ? Number(area) : null,
        status,
      }),
    onSuccess: () => {
      onSaved();
      toast.success("Đã lưu căn");
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không lưu được")),
  });
  const remove = useMutation({
    mutationFn: () => assetsApi.units.remove(assetId, unit.id),
    onSuccess: () => {
      onSaved();
      toast.success("Đã xoá căn");
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không xoá được căn")),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{unitLabel(unit.name, true)}</DialogTitle>
          <DialogDescription>
            Tình trạng quyết định màu của căn trên mô hình 3D người tìm nhà thấy.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3 space-y-1.5 sm:col-span-1">
            <Label htmlFor="u-name">Tên</Label>
            <Input
              id="u-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-floor">Tầng</Label>
            <Input
              id="u-floor"
              type="number"
              min={1}
              max={maxFloor}
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-area">m²</Label>
            <Input
              id="u-area"
              type="number"
              min={0}
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Tình trạng</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  status === s
                    ? "border-primary bg-primary/10 font-medium"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {UNIT_STATUS[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t pt-4">
          <Button
            variant="ghost"
            className="mr-auto text-destructive hover:text-destructive"
            disabled={remove.isPending || !!unit.listingId}
            title={unit.listingId ? "Căn đang có tin — đóng tin trước khi xoá căn" : undefined}
            onClick={() => remove.mutate()}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Xoá căn
          </Button>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Lưu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
