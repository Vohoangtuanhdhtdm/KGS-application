// Guarded, code-split wrapper cho bản đồ đơn giản: Mapbox GL (mặc định) hay Leaflet (đường
// lui), chọn lúc mở — xem lib/mapEngine.ts. GL hỏng giữa chừng thì tự đổi sang Leaflet.
import { lazy, Suspense, useEffect } from "react";
import type { MapEngine } from "@/lib/mapEngine";
import type { SimpleMapProps } from "./simpleMapTypes";
import { useMapEngine } from "./useMapEngine";

const LeafletMap = lazy(() => import("./LeafletMap"));
const GlSimpleMap = lazy(() => import("./GlSimpleMap"));

export function ClientMap({
  onEngine,
  ...props
}: SimpleMapProps & { onEngine?: (engine: MapEngine) => void }) {
  const { engine, fallBack } = useMapEngine();
  useEffect(() => {
    if (engine) onEngine?.(engine);
  }, [engine, onEngine]);
  const skeleton = (
    <div
      className="rounded-md border bg-muted animate-pulse"
      style={{ height: props.height ?? 400 }}
    />
  );
  if (!engine) return skeleton;
  return (
    <Suspense fallback={skeleton}>
      {engine === "gl" ? (
        <GlSimpleMap {...props} onFatalError={fallBack} />
      ) : (
        <LeafletMap {...props} />
      )}
    </Suspense>
  );
}
