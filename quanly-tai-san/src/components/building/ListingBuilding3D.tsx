import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildingModelApi } from "@/lib/api/buildingModel";
import { BuildingExplorer } from "./BuildingExplorer";
import { BuildingSceneClient } from "./BuildingSceneClient";

/**
 * "Xem 3D" ở trang chi tiết tin.
 *
 *   • Chủ nhà đã dựng mô hình → khám phá Toà nhà → Tầng → Căn, căn của tin này được chọn sẵn.
 *   • Chưa có → khối nhà 3D của Mapbox quanh vị trí, toà nhà tại vị trí tin tô nổi bật.
 *
 * Bản đồ 3D chỉ dựng khi người dùng bấm mở — mỗi lần mở bản đồ GL là một lượt tính phí của
 * Mapbox, không đáng tốn cho mọi lượt xem trang.
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

  useEffect(() => {
    if (autoOpen && model) setOpen(true);
  }, [autoOpen, model]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Box className="h-4 w-4" /> {model ? "Toà nhà 3D" : "Xem 3D khu vực"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {model ? (
            <>
              {model.floors} tầng · {model.units.length} căn · {vacant} căn trống
              {focus && (
                <>
                  {" "}
                  — tin này là <span className="font-medium text-foreground">{focus.name}</span>,
                  tầng {focus.floor}.
                </>
              )}
            </>
          ) : (
            "Nhìn toà nhà và các khối nhà xung quanh ở dạng 3D: cao bao nhiêu, sát nhà nào, mặt tiền hướng ra đâu."
          )}
        </p>
        <Button
          variant={model ? "default" : "outline"}
          onClick={() => setOpen(true)}
          disabled={q.isLoading}
        >
          <Building2 className="mr-1.5 h-4 w-4" />
          {model ? "Khám phá toà nhà" : "Xem 3D"}
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{model ? "Toà nhà → Tầng → Căn" : "Vị trí ở dạng 3D"}</DialogTitle>
            <DialogDescription>
              {model
                ? `${model.assetName}. Chọn một tầng để xem các căn, bấm vào căn để xem tình trạng và tin đăng.`
                : "Khối nhà 3D từ dữ liệu bản đồ Mapbox; toà nhà tại vị trí tin được tô màu xanh (nếu bản đồ có dữ liệu toà nhà đó)."}
            </DialogDescription>
          </DialogHeader>
          {open &&
            (model ? (
              <BuildingExplorer model={model} currentSlug={slug} height={480} />
            ) : (
              <BuildingSceneClient
                building={null}
                center={[lng, lat]}
                highlight={[lng, lat]}
                height={480}
              />
            ))}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
