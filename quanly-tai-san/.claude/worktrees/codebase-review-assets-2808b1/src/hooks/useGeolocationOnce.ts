import { useEffect, useRef, useState } from "react";

export interface LatLng {
  lat: number;
  lng: number;
}

export type GeolocationStatus = "idle" | "pending" | "granted" | "denied" | "unsupported";

/**
 * Hỏi vị trí trình duyệt ĐÚNG 1 LẦN khi component mount — không tự gọi lại
 * getCurrentPosition dù bị từ chối/lỗi, tránh popup xin quyền lặp lại gây khó chịu.
 * Muốn thử lại phải qua hành động chủ động của người dùng (không có trong Giai đoạn 2).
 */
export function useGeolocationOnce(): { status: GeolocationStatus; position: LatLng | null } {
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [position, setPosition] = useState<LatLng | null>(null);
  const askedRef = useRef(false);

  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    setStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      () => {
        setStatus("denied");
      },
      { timeout: 5000 },
    );
  }, []);

  return { status, position };
}
