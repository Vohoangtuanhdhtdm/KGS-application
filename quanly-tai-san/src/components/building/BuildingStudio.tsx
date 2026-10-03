import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, MousePointerClick, PenLine, RectangleHorizontal, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api/errors";
import { buildingModelApi, type BuildingModel, type LngLat } from "@/lib/api/buildingModel";
import {
  CELL_COLORS,
  CELL_LABELS,
  footprintArea,
  rectangleFootprint,
  unitsByFloor,
  type CellKind,
} from "@/lib/buildingGeometry";
import { BuildingSceneClient } from "./BuildingSceneClient";
import type { PickMode } from "./BuildingScene";
import { BuildingExplorer } from "./BuildingExplorer";

const LEGEND: CellKind[] = ["listed", "vacant", "occupied", "maintenance", "slab"];

/**
 * Xưởng dựng mô hình toà nhà — "dựng trong vài giây" rồi mới tinh chỉnh.
 *
 * Lấy cảm hứng từ cách các công cụ tạo 3D bằng AI (như Meshy) làm trải nghiệm: một đầu vào
 * tối thiểu → bản xem trước gần như tức thì → tinh chỉnh → xuất bản. Ở đây đầu vào là dữ
 * liệu đã có sẵn: mở tab là hệ thống tự lấy khung toà nhà tại vị trí tài sản trên bản đồ
 * Mapbox, lấy số tầng và các căn đã khai — chủ nhà thấy ngay toà nhà của mình ở dạng 3D, chỉ
 * cần sửa nếu khung lấy chưa đúng.
 */
export function BuildingStudio({ assetId }: { assetId: string }) {
  const q = useQuery({
    queryKey: ["building-model", assetId],
    queryFn: () => buildingModelApi.forAsset(assetId),
  });
  if (q.isLoading) return <Skeleton className="h-[480px] w-full" />;
  if (q.error || !q.data)
    return <p className="text-sm text-destructive">{getErrorMessage(q.error)}</p>;
  return <Studio key={q.data.assetId} data={q.data} />;
}

function Studio({ data }: { data: BuildingModel }) {
  const qc = useQueryClient();
  const location: LngLat | null =
    data.longitude != null && data.latitude != null ? [data.longitude, data.latitude] : null;

  const [ring, setRing] = useState<LngLat[]>(data.footprint);
  const [floors, setFloors] = useState(data.floors);
  const [floorHeight, setFloorHeight] = useState(data.floorHeightMeters);
  const [published, setPublished] = useState(data.published);
  const [mode, setMode] = useState<PickMode>(null);
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [rect, setRect] = useState({ w: 12, d: 18, r: 0 });
  const [showRect, setShowRect] = useState(false);
  const [preview, setPreview] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);

  const isNew = data.footprint.length === 0;
  const dirty =
    JSON.stringify(ring) !== JSON.stringify(data.footprint) ||
    floors !== data.floors ||
    floorHeight !== data.floorHeightMeters ||
    published !== data.published;

  // Số tầng không được thấp hơn tầng cao nhất đã khai căn — nếu không căn ở tầng đó biến mất.
  const maxUnitFloor = Math.max(0, ...data.units.map((u) => u.floor ?? 0));
  const building = useMemo(
    () => ({ footprint: ring, floors, floorHeightMeters: floorHeight, units: data.units }),
    [ring, floors, floorHeight, data.units],
  );
  const { unplaced } = useMemo(() => unitsByFloor(building), [building]);
  const area = footprintArea(ring);

  useEffect(() => {
    if (mode !== "draw") setDraft([]);
  }, [mode]);

  const save = useMutation({
    mutationFn: () =>
      buildingModelApi.save(data.assetId, {
        footprint: ring,
        floors,
        floorHeightMeters: floorHeight,
        published,
      }),
    onSuccess: (saved) => {
      qc.setQueryData(["building-model", data.assetId], saved);
      toast.success(
        saved.published ? "Đã lưu và công khai mô hình." : "Đã lưu mô hình (chưa công khai).",
      );
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (!location && isNew) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Tài sản chưa có vị trí trên bản đồ. Vào <b>Sửa</b> và chọn vị trí trước, rồi quay lại đây
          để dựng mô hình 3D.
        </CardContent>
      </Card>
    );
  }

  const applyRect = (next = rect) => {
    const c = location ?? ring[0];
    if (c) setRing(rectangleFootprint(c, next.w, next.d, next.r));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-2">
        {preview && ring.length >= 3 ? (
          <BuildingExplorer
            model={{
              ...data,
              footprint: ring,
              floors,
              floorHeightMeters: floorHeight,
              focusUnitId: null,
            }}
            editorPreview
            height={480}
          />
        ) : (
          <>
            <BuildingSceneClient
              building={ring.length >= 3 ? building : null}
              center={location ?? ring[0]}
              pickMode={mode}
              draft={mode === "draw" ? draft : undefined}
              autoPickAt={isNew ? location : null}
              onPickBuilding={(r) => {
                if (r && r.length >= 3) {
                  setRing(r);
                  setMode(null);
                  setAutoNote(
                    isNew && mode == null
                      ? "Đã tự lấy khung toà nhà tại vị trí tài sản. Kiểm tra lại — nếu chưa đúng, chọn toà khác hoặc vẽ tay."
                      : null,
                  );
                } else if (mode === "building") {
                  toast.info(
                    "Bản đồ không có dữ liệu toà nhà ở điểm này — hãy vẽ tay hoặc dùng hình chữ nhật.",
                  );
                } else if (isNew && location) {
                  // Không có khối nhà tại vị trí: bắt đầu bằng một hình chữ nhật để vẫn thấy ngay 3D.
                  setRing(rectangleFootprint(location, rect.w, rect.d, rect.r));
                  setShowRect(true);
                  setAutoNote(
                    "Bản đồ không có dữ liệu toà nhà tại vị trí này nên tạm dựng khung chữ nhật — chỉnh kích thước hoặc vẽ tay cho đúng.",
                  );
                }
              }}
              onAddVertex={(p) => setDraft((d) => [...d, p])}
              height={480}
            />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {LEGEND.map((k) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span
                    className="h-3 w-3 rounded-sm border"
                    style={{ background: CELL_COLORS[k] }}
                  />
                  {CELL_LABELS[k]}
                </span>
              ))}
            </div>
          </>
        )}
        {autoNote && <p className="text-xs text-muted-foreground">{autoNote}</p>}
      </div>

      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">1 · Khung toà nhà</CardTitle>
            <CardDescription className="text-xs">
              {ring.length >= 3
                ? `${ring.length} đỉnh · khoảng ${Math.round(area)} m² mặt sàn`
                : "Chưa có khung"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {mode === "draw" ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Bấm lần lượt các góc toà nhà trên bản đồ ({draft.length} điểm).
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={draft.length < 3}
                    onClick={() => {
                      setRing(draft);
                      setMode(null);
                    }}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Xong
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!draft.length}
                    onClick={() => setDraft((d) => d.slice(0, -1))}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
                    <X className="mr-1 h-3.5 w-3.5" /> Huỷ
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <Button
                  size="sm"
                  variant={mode === "building" ? "default" : "outline"}
                  onClick={() => {
                    setPreview(false);
                    setMode(mode === "building" ? null : "building");
                  }}
                >
                  <MousePointerClick className="mr-1.5 h-3.5 w-3.5" />
                  {mode === "building"
                    ? "Bấm vào toà nhà trên bản đồ…"
                    : "Chọn toà nhà trên bản đồ"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPreview(false);
                    setMode("draw");
                  }}
                >
                  <PenLine className="mr-1.5 h-3.5 w-3.5" /> Vẽ khung bằng tay
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowRect((v) => !v)}>
                  <RectangleHorizontal className="mr-1.5 h-3.5 w-3.5" /> Hình chữ nhật theo kích
                  thước
                </Button>
              </div>
            )}
            {showRect && mode !== "draw" && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(
                  [
                    ["w", "Ngang (m)", 3, 200],
                    ["d", "Sâu (m)", 3, 200],
                    ["r", "Xoay (°)", -90, 90],
                  ] as const
                ).map(([k, label, min, max]) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      min={min}
                      max={max}
                      value={rect[k]}
                      onChange={(e) => {
                        const v = Math.min(max, Math.max(min, Number(e.target.value) || 0));
                        const next = { ...rect, [k]: v };
                        setRect(next);
                        applyRect(next);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">2 · Tầng</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Số tầng</Label>
              <Input
                type="number"
                min={Math.max(1, maxUnitFloor)}
                max={100}
                value={floors}
                onChange={(e) =>
                  setFloors(
                    Math.min(
                      100,
                      Math.max(Math.max(1, maxUnitFloor), Math.round(Number(e.target.value) || 1)),
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cao mỗi tầng (m)</Label>
              <Input
                type="number"
                step={0.1}
                min={2.4}
                max={8}
                value={floorHeight}
                onChange={(e) =>
                  setFloorHeight(Math.min(8, Math.max(2.4, Number(e.target.value) || 3.2)))
                }
              />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              {data.units.length
                ? `${data.units.length} căn đã khai được xếp theo tầng tự động.`
                : "Chưa khai căn nào — mỗi tầng hiện là một khối. Khai căn ở tab Tầng/Phòng để chia từng căn."}
              {unplaced.length > 0 && ` ${unplaced.length} căn chưa ghi số tầng nên chưa hiện.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">3 · Xem trước & công khai</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={ring.length < 3}
              onClick={() => {
                setMode(null);
                setPreview((v) => !v);
              }}
            >
              {preview ? "Quay lại chỉnh sửa" : "Xem như người tìm nhà"}
            </Button>
            <label className="flex items-start justify-between gap-3 text-sm">
              <span>
                Cho người tìm nhà xem
                <span className="block text-xs text-muted-foreground">
                  Hiện ở trang tin của mọi căn trong toà nhà. Chỉ hiện tình trạng trống/đã có người,
                  không hiện thông tin người thuê.
                </span>
              </span>
              <Switch checked={published} onCheckedChange={setPublished} />
            </label>
            <Button
              className="w-full"
              disabled={ring.length < 3 || !dirty || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Đang lưu…" : dirty ? "Lưu mô hình" : "Đã lưu"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
