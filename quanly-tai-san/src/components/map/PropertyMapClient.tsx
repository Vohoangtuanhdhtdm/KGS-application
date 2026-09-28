// Guarded, code-split wrapper cho bản đồ tìm kiếm: chọn Mapbox GL (mặc định) hay Leaflet
// (đường lui) lúc mở — xem lib/mapEngine.ts. GL hỏng giữa chừng thì tự đổi sang Leaflet.
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import type { ComponentProps } from "react";
import type { MapEngine } from "@/lib/mapEngine";
import type { LngLat } from "@/lib/mapboxNav";
import type { PropertyMapPoint } from "./propertyMapShared";
import { useMapEngine } from "./useMapEngine";

const PropertyMap = lazy(() => import("./PropertyMap"));
const GlPropertyMap = lazy(() => import("./GlPropertyMap"));

type Props = ComponentProps<typeof PropertyMap> & {
  /** Vùng đi lại (Isochrone) — chỉ bản GL vẽ; điều khoản Mapbox không cho vẽ nó ở nơi khác. */
  areaPolygon?: LngLat[] | null;
  searchCenterLabel?: string | null;
  popupExtra?: (point: PropertyMapPoint) => ReactNode;
  /** Báo động cơ đang dùng, để trang bật/tắt các tính năng chỉ chạy được trên GL. */
  onEngine?: (engine: MapEngine) => void;
};

export function PropertyMapClient({
  areaPolygon,
  searchCenterLabel,
  popupExtra,
  onEngine,
  ...props
}: Props) {
  const { engine, fallBack } = useMapEngine();
  useEffect(() => {
    if (engine) onEngine?.(engine);
  }, [engine, onEngine]);
  const fallback = <div className="h-full w-full bg-muted animate-pulse" />;
  if (!engine) return fallback;
  return (
    <Suspense fallback={fallback}>
      {engine === "gl" ? (
        <GlPropertyMap
          {...props}
          areaPolygon={areaPolygon}
          searchCenterLabel={searchCenterLabel}
          popupExtra={popupExtra}
          onFatalError={fallBack}
        />
      ) : (
        <PropertyMap {...props} />
      )}
    </Suspense>
  );
}
