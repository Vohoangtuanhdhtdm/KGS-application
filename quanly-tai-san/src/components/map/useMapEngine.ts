import { useCallback, useEffect, useState } from "react";
import { markGlFailed, pickMapEngine, type MapEngine } from "@/lib/mapEngine";

/**
 * Động cơ bản đồ cho một lần mở, kèm hàm "lùi về Leaflet" khi GL hỏng giữa chừng.
 *
 * `engine` là null ở lần vẽ đầu (phía máy chủ không có WebGL hay sessionStorage để hỏi) —
 * nơi gọi hiện khung chờ trong lúc đó, giống cách các lớp bọc bản đồ vẫn làm.
 */
export function useMapEngine(): { engine: MapEngine | null; fallBack: () => void } {
  const [engine, setEngine] = useState<MapEngine | null>(null);
  useEffect(() => setEngine(pickMapEngine()), []);
  const fallBack = useCallback(() => {
    markGlFailed();
    setEngine("leaflet");
  }, []);
  return { engine, fallBack };
}
