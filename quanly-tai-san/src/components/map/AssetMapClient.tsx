// Guarded, code-split wrapper cho bản đồ danh mục tài sản: Mapbox GL (mặc định) hay Leaflet
// (đường lui), chọn lúc mở — xem lib/mapEngine.ts. GL hỏng giữa chừng thì tự đổi sang Leaflet.
import { lazy, Suspense } from "react";
import type { AssetMapProps } from "./AssetMap";
import { useMapEngine } from "./useMapEngine";

const AssetMap = lazy(() => import("./AssetMap"));
const GlAssetMap = lazy(() => import("./GlAssetMap"));

export function AssetMapClient(props: AssetMapProps) {
  const { engine, fallBack } = useMapEngine();
  const fallback = <div className="h-full w-full bg-muted animate-pulse" />;
  if (!engine) return fallback;
  return (
    <Suspense fallback={fallback}>
      {engine === "gl" ? (
        <GlAssetMap {...props} onFatalError={fallBack} />
      ) : (
        <AssetMap {...props} />
      )}
    </Suspense>
  );
}
