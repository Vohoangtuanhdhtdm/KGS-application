import { useCallback, useState } from "react";

export interface LatLng {
  lat: number;
  lng: number;
}

export type GeolocationStatus = "idle" | "pending" | "granted" | "denied" | "unsupported";

/**
 * Hỏi vị trí trình duyệt CHỈ KHI người dùng chủ động gọi `request()` — không tự
 * xin quyền khi mount. Mỗi lần request() tăng `requestId` để nơi gọi phân biệt
 * được kết quả nào ứng với lần bấm nào (tránh xử lý nhầm kết quả cũ).
 */
export function useGeolocationOnDemand(): {
  status: GeolocationStatus;
  position: LatLng | null;
  requestId: number;
  request: () => void;
} {
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [position, setPosition] = useState<LatLng | null>(null);
  const [requestId, setRequestId] = useState(0);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
        setRequestId((id) => id + 1);
      },
      () => {
        setStatus("denied");
        setRequestId((id) => id + 1);
      },
      { timeout: 5000 },
    );
  }, []);

  return { status, position, requestId, request };
}
