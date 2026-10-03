// Lớp bọc nạp lười cho cảnh 3D. Cảnh 3D cần Mapbox GL — trên động cơ Leaflet dự phòng (không
// có token, không có WebGL2, hoặc GL vừa hỏng) thì hiện lời giải thích thay vì một khung trống.
import { lazy, Suspense } from "react";
import { Box } from "lucide-react";
import { useMapEngine } from "@/components/map/useMapEngine";
import type { BuildingSceneProps } from "./BuildingScene";

const BuildingScene = lazy(() => import("./BuildingScene"));

export function BuildingSceneClient(props: Omit<BuildingSceneProps, "onFatalError">) {
  const { engine, fallBack } = useMapEngine();
  const h = props.height ?? 420;
  const skeleton = (
    <div className="rounded-md border bg-muted animate-pulse" style={{ height: h }} />
  );
  if (!engine) return skeleton;
  if (engine !== "gl") {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground"
        style={{ height: h }}
      >
        <Box className="h-8 w-8" />
        Trình duyệt hoặc thiết bị này không dựng được bản đồ 3D (cần WebGL2).
        <br />
        Danh sách tầng và căn bên cạnh vẫn dùng bình thường.
      </div>
    );
  }
  return (
    <Suspense fallback={skeleton}>
      <BuildingScene {...props} onFatalError={fallBack} />
    </Suspense>
  );
}
