// Guarded, code-split wrapper around AssetMap for SSR safety — cùng pattern với ClientMap.tsx.
import { lazy, Suspense, useEffect, useState } from "react";
import type { ComponentProps } from "react";

const AssetMap = lazy(() => import("./AssetMap"));

function useIsClient() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}

export function AssetMapClient(props: ComponentProps<typeof AssetMap>) {
  const ready = useIsClient();
  const fallback = <div className="h-full w-full bg-muted animate-pulse" />;
  if (!ready) return fallback;
  return (
    <Suspense fallback={fallback}>
      <AssetMap {...props} />
    </Suspense>
  );
}
