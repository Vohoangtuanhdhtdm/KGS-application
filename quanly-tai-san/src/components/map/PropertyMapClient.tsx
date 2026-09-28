// Guarded, code-split wrapper cho bản đồ tìm kiếm: chọn Mapbox GL (mặc định) hay Leaflet
// (đường lui) lúc mở — xem lib/mapEngine.ts. GL hỏng giữa chừng thì tự đổi sang Leaflet.
import { lazy, Suspense } from "react";
import type { ComponentProps } from "react";
import { useMapEngine } from "./useMapEngine";

const PropertyMap = lazy(() => import("./PropertyMap"));
const GlPropertyMap = lazy(() => import("./GlPropertyMap"));

export function PropertyMapClient(props: ComponentProps<typeof PropertyMap>) {
  const { engine, fallBack } = useMapEngine();
  const fallback = <div className="h-full w-full bg-muted animate-pulse" />;
  if (!engine) return fallback;
  return (
    <Suspense fallback={fallback}>
      {engine === "gl" ? (
        <GlPropertyMap {...props} onFatalError={fallBack} />
      ) : (
        <PropertyMap {...props} />
      )}
    </Suspense>
  );
}
