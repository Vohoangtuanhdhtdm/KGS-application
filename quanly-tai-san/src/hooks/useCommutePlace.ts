import { useCallback, useSyncExternalStore } from "react";
import type { TravelProfile } from "@/lib/mapboxNav";

/**
 * "Chỗ hay đến" của người đang xem (chỗ làm, trường học...) và cách họ đi lại.
 *
 * Đặt một lần, dùng cho mọi tin: mở tin nào cũng thấy ngay "tới chỗ làm mất bao lâu" mà
 * không phải đặt lại. Sống ở localStorage — đây là sở thích của một người trên một máy,
 * không cần đăng nhập, và không có lý do gì gửi địa điểm làm việc của họ lên máy chủ.
 *
 * Toạ độ luôn do người dùng tự bấm trên bản đồ hoặc lấy từ GPS của chính họ — không phải kết
 * quả geocoding (loại geocoding miễn phí của Mapbox không cho lưu kết quả).
 */

const KEY = "kgs.commute";

export interface CommutePlace {
  lat: number;
  lng: number;
  label: string;
}

interface Stored {
  place: CommutePlace | null;
  profile: TravelProfile;
}

const DEFAULT: Stored = { place: null, profile: "driving-traffic" };

function read(): Stored {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<Stored>;
    const p = v.place;
    const place =
      p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
        ? { lat: p.lat, lng: p.lng, label: String(p.label || "Chỗ hay đến") }
        : null;
    const profile =
      v.profile === "walking" || v.profile === "cycling" || v.profile === "driving-traffic"
        ? v.profile
        : DEFAULT.profile;
    return { place, profile };
  } catch {
    return DEFAULT;
  }
}

let cache: Stored = read();
const listeners = new Set<() => void>();

function write(next: Stored) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Chặn localStorage (ẩn danh): vẫn dùng được trong lần xem này, chỉ không nhớ lâu.
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = read();
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => cache;
const getServerSnapshot = () => DEFAULT;

export function useCommutePlace() {
  const { place, profile } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setPlace = useCallback((p: CommutePlace | null) => write({ ...cache, place: p }), []);
  const setProfile = useCallback((pr: TravelProfile) => write({ ...cache, profile: pr }), []);
  return { place, profile, setPlace, setProfile };
}
