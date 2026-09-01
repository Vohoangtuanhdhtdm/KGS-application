// Guarded, code-split wrapper around LeafletMap for SSR safety.
import { lazy, Suspense, useEffect, useState } from "react";
import type { ComponentProps } from "react";

const LeafletMap = lazy(() => import("./LeafletMap"));

function useIsClient() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}

export function ClientMap(props: ComponentProps<typeof LeafletMap>) {
  const ready = useIsClient();
  if (!ready) {
    return (
      <div
        className="rounded-md border bg-muted animate-pulse"
        style={{ height: props.height ?? 400 }}
      />
    );
  }
  return (
    <Suspense fallback={<div className="rounded-md border bg-muted animate-pulse" style={{ height: props.height ?? 400 }} />}>
      <LeafletMap {...props} />
    </Suspense>
  );
}
