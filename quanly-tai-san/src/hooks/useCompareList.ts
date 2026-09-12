import { useCallback, useSyncExternalStore } from "react";
import type { ListingTypeCode } from "@/constants/enums";

/**
 * Danh sách tin đang chọn để so sánh.
 *
 * Sống hoàn toàn ở localStorage, KHÔNG qua backend: đây là một tiện ích tạm thời trong
 * lúc người dùng lướt tin, không phải dữ liệu cần lưu lâu dài hay đồng bộ giữa thiết bị.
 * Không cần đăng nhập vẫn dùng được — khách vãng lai so sánh tin trước khi quyết định
 * đăng ký cũng là một hành vi hợp lý.
 *
 * Dùng useSyncExternalStore thay vì useState + useEffect: nhiều PropertyListCard trên
 * cùng một trang (và cả CompareBar) đều đọc chung một danh sách, đổi ở nút này phải phản
 * ánh ngay ở nút khác mà không cần Context/Provider bọc toàn bộ cây trang public.
 */

const KEY = "kgs.compare";
const MAX = 3;

export interface CompareItem {
  id: string;
  slug: string;
  type: ListingTypeCode;
  title: string;
  thumbnailUrl: string | null;
}

function doc(): CompareItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let cache: CompareItem[] = doc();
const listeners = new Set<() => void>();

function write(items: CompareItem[]) {
  cache = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Hết dung lượng hoặc chế độ ẩn danh chặn localStorage — bỏ qua, danh sách chỉ
    // không sống sót qua lần tải lại trang, không phải lỗi cần báo người dùng.
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  // Đồng bộ giữa các tab: chọn tin để so sánh ở tab này thấy ngay ở tab kia.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = doc();
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return cache;
}

export function useCompareList() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => []);

  const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  const toggle = useCallback((item: CompareItem) => {
    const cur = doc();
    if (cur.some((i) => i.id === item.id)) {
      write(cur.filter((i) => i.id !== item.id));
      return;
    }
    // Chỉ so sánh trong cùng một loại (Bán với Bán, Thuê với Thuê) — trộn lẫn thì các
    // dòng "giá", "giá/m²" không còn nghĩa để so. Chọn tin khác loại thì thay hẳn danh
    // sách cũ thay vì báo lỗi im lặng hay chặn không rõ vì sao.
    const base = cur.length > 0 && cur[0].type !== item.type ? [] : cur;
    if (base.length >= MAX) return; // nút phía UI đã disable khi đủ, đây là chốt chặn cuối
    write([...base, item]);
  }, []);

  const remove = useCallback((id: string) => write(doc().filter((i) => i.id !== id)), []);
  const clear = useCallback(() => write([]), []);

  return { items, has, toggle, remove, clear, max: MAX };
}
