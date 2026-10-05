import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Box, Building2, Loader2, MapPin, Plus } from "lucide-react";
import { buildingsApi, type OwnerBuilding } from "@/lib/api/buildings";
import { getErrorMessage } from "@/lib/api/errors";
import { ASSET_TYPE, type AssetTypeCode } from "@/constants/enums";
import { BuildingFacade } from "@/components/building/BuildingFacade";
import { buildingStats, toFacadeUnits } from "@/components/building/ownerBuildingUnits";
import { VietnamAddressPicker } from "@/components/assets/VietnamAddressPicker";
import { LocationPinField, type LatLngValue } from "@/components/listings/LocationPinField";
import type { BuildingUnit } from "@/lib/api/buildingModel";
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

/**
 * TOÀ NHÀ & KHU TRỌ — nơi chủ nhà có nhiều căn khai toà nhà một lần, dựng mô hình 3D, rồi
 * đăng tin cho từng căn.
 *
 * Trước đây mô hình 3D chỉ dựng được trong khu "Quản lý tài sản" cũ (đã ẩn khỏi điều hướng),
 * và luồng đăng tin chỉ đăng nguyên căn — nên ngoài dữ liệu trình diễn, không chủ nhà nào tạo
 * được tin hiện trên mô hình 3D. Trang này là lối vào đó.
 */
export const Route = createFileRoute("/toa-nha/")({
  head: () => ({ meta: [{ title: "Toà nhà & khu trọ — KGS" }] }),
  component: BuildingsPage,
});

function BuildingsPage() {
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: ["owner-buildings"], queryFn: buildingsApi.mine });
  const list = q.data ?? [];

  return (
    <div className="mx-auto max-w-[1180px] space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Toà nhà &amp; khu trọ</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Có nhiều căn ở cùng một chỗ? Khai toà nhà một lần, dựng mô hình 3D, rồi đăng tin cho
            từng căn — người tìm nhà xoay toà nhà, thấy tầng nào còn trống và căn của tin nằm ở đâu.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Thêm toà nhà
        </Button>
      </div>

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : q.error ? (
        <p className="text-sm text-destructive">{getErrorMessage(q.error)}</p>
      ) : list.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((b) => (
            <BuildingCard key={b.assetId} b={b} />
          ))}
        </div>
      )}

      <CreateBuildingDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const demo: BuildingUnit[] = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        id: `d${i}`,
        name: `P.${Math.floor(i / 3) + 2}0${(i % 3) + 1}`,
        floor: Math.floor(i / 3) + 2,
        area: null,
        status: (i % 4 === 0 ? 1 : i % 7 === 0 ? 3 : 2) as 1 | 2 | 3,
        listing:
          i % 5 === 0 ? { slug: "", title: "", price: 0, type: 2, rentPaymentCycle: null } : null,
      })),
    [],
  );
  return (
    <Card className="grid items-center gap-6 p-6 sm:grid-cols-[200px_1fr] sm:p-8">
      <BuildingFacade
        floors={6}
        units={demo}
        focusUnitId="d10"
        className="mx-auto h-auto max-h-48 w-full"
      />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Chưa có toà nhà nào</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Nhập địa chỉ, số tầng và số căn mỗi tầng — hệ thống tạo sẵn P.201, P.202…</li>
          <li>Mở mô hình 3D: khung toà nhà được lấy tự động từ bản đồ, chỉnh nếu cần.</li>
          <li>Đăng tin cho căn trống — tin hiện đúng chỗ trên mô hình.</li>
        </ol>
        <Button onClick={onCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Thêm toà nhà đầu tiên
        </Button>
      </div>
    </Card>
  );
}

function BuildingCard({ b }: { b: OwnerBuilding }) {
  const s = buildingStats(b);
  const units = useMemo(() => toFacadeUnits(b.units), [b.units]);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="grid sm:grid-cols-[170px_minmax(0,1fr)]">
        <Link
          to="/toa-nha/$id"
          params={{ id: b.assetId }}
          className="flex items-end justify-center bg-gradient-to-b from-primary/5 to-muted/70 px-4 pb-3 pt-6"
          aria-label={`Mở ${b.name}`}
        >
          <BuildingFacade floors={b.floors} units={units} className="h-auto max-h-36 w-full" />
        </Link>
        <div className="flex flex-col gap-3 p-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {ASSET_TYPE[(b.propertyType in ASSET_TYPE ? b.propertyType : 99) as AssetTypeCode]}
            </p>
            <h3 className="truncate font-semibold">{b.name}</h3>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {[b.addressDetail, b.ward, b.district].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full border px-2 py-0.5">{b.floors} tầng</span>
            <span className="rounded-full border px-2 py-0.5">{s.units} căn</span>
            <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 font-medium text-emerald-700">
              {s.vacant} trống
            </span>
            <span className="rounded-full border px-2 py-0.5">{s.live} đang hiển thị</span>
          </div>
          <p className="flex items-center gap-1.5 text-xs">
            <Box className="h-3.5 w-3.5" />
            {!b.hasModel ? (
              <span className="text-warning">Chưa dựng mô hình 3D</span>
            ) : b.published ? (
              <span className="text-emerald-700">Mô hình 3D đang công khai</span>
            ) : (
              <span className="text-muted-foreground">Mô hình 3D chưa công khai</span>
            )}
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link to="/toa-nha/$id" params={{ id: b.assetId }}>
                Quản lý căn
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/toa-nha/$id" params={{ id: b.assetId }} search={{ tab: "3d" }}>
                <Box className="mr-1.5 h-3.5 w-3.5" />
                {b.hasModel ? "Mô hình 3D" : "Dựng 3D"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

const BUILDING_TYPES: AssetTypeCode[] = [7, 2, 6, 1, 99];

function CreateBuildingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetTypeCode>(7);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [detail, setDetail] = useState("");
  const [pin, setPin] = useState<LatLngValue | null>(null);
  const [floors, setFloors] = useState(5);
  const [perFloor, setPerFloor] = useState(4);
  const [firstFloor, setFirstFloor] = useState(2);
  const [unitArea, setUnitArea] = useState("");

  const preview: BuildingUnit[] = useMemo(() => {
    const out: BuildingUnit[] = [];
    for (let f = Math.max(1, firstFloor); f <= floors; f++)
      for (let i = 1; i <= perFloor; i++)
        out.push({
          id: `${f}-${i}`,
          name: `P.${f}${String(i).padStart(2, "0")}`,
          floor: f,
          area: null,
          status: 1,
          listing: null,
        });
    return out;
  }, [floors, perFloor, firstFloor]);

  const missing: string[] = [];
  if (!city || !district || !ward) missing.push("địa chỉ");
  if (!pin) missing.push("ghim vị trí");

  const create = useMutation({
    mutationFn: () =>
      buildingsApi.create({
        name: name.trim() || null,
        propertyType: type,
        city,
        district,
        ward,
        addressDetail: detail.trim() || null,
        latitude: pin!.lat,
        longitude: pin!.lng,
        floors,
        unitsPerFloor: perFloor,
        firstUnitFloor: Math.min(firstFloor, floors),
        unitArea: unitArea ? Number(unitArea) : null,
      }),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ["owner-buildings"] });
      toast.success(`Đã tạo ${b.units.length} căn`, {
        description: "Giờ dựng mô hình 3D — khung toà nhà được lấy tự động từ bản đồ.",
      });
      onOpenChange(false);
      navigate({ to: "/toa-nha/$id", params: { id: b.assetId }, search: { tab: "3d" } });
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không tạo được toà nhà")),
  });

  const clampInt = (v: string, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(Number(v) || min)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm toà nhà / khu trọ</DialogTitle>
          <DialogDescription>
            Khai một lần — các căn được tạo sẵn để đăng tin và hiện trên mô hình 3D.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="b-name">Tên gọi (không bắt buộc)</Label>
              <Input
                id="b-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Chung cư mini Trần Thái Tông"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                Chỉ bạn thấy. Người tìm nhà thấy địa chỉ.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Loại</p>
              <div className="flex flex-wrap gap-2">
                {BUILDING_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={type === t}
                    onClick={() => setType(t)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      type === t
                        ? "border-primary bg-primary/10 font-medium"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {t === 7 ? "Khu / nhà trọ" : t === 2 ? "Chung cư, căn hộ" : ASSET_TYPE[t]}
                  </button>
                ))}
              </div>
            </div>

            <VietnamAddressPicker
              city={city}
              district={district}
              ward={ward}
              onChange={(v) => {
                setCity(v.city);
                setDistrict(v.district);
                setWard(v.ward);
              }}
            />
            <div className="space-y-1.5">
              <Label htmlFor="b-detail">Số nhà, tên đường</Label>
              <Input
                id="b-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Ví dụ: 127 Trần Thái Tông"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                Ghim vị trí toà nhà *{" "}
                <span className="font-normal text-muted-foreground">
                  — để lấy khung toà nhà trên bản đồ
                </span>
              </p>
              <LocationPinField value={pin} onChange={setPin} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumBox
                label="Số tầng"
                value={floors}
                onChange={(v) => setFloors(clampInt(v, 1, 60))}
              />
              <NumBox
                label="Căn mỗi tầng"
                value={perFloor}
                onChange={(v) => setPerFloor(clampInt(v, 0, 30))}
              />
              <NumBox
                label="Có căn từ tầng"
                value={firstFloor}
                onChange={(v) => setFirstFloor(clampInt(v, 1, 60))}
              />
              <div className="space-y-1.5">
                <Label htmlFor="b-area">m² mỗi căn</Label>
                <Input
                  id="b-area"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={unitArea}
                  onChange={(e) => setUnitArea(e.target.value)}
                  placeholder="25"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tạo sẵn {preview.length} căn: {preview[0]?.name ?? "—"}
              {preview.length > 1 ? ` … ${preview[preview.length - 1].name}` : ""}. Sửa tên, diện
              tích, thêm bớt căn sau ở trang toà nhà.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 md:sticky md:top-0 md:self-start">
            <p className="text-xs font-medium text-muted-foreground">Xem trước</p>
            <BuildingFacade floors={floors} units={preview} className="h-auto max-h-56 w-full" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          {missing.length > 0 && (
            <p className="mr-auto text-xs text-muted-foreground">
              Còn thiếu: {missing.join(", ")}.
            </p>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button disabled={missing.length > 0 || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Building2 className="mr-1.5 h-4 w-4" />
            )}
            Tạo toà nhà
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  const id = `nb-${label}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
