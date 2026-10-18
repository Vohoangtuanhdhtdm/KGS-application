import type { AssistantResult } from "@/lib/api/assistant";

/**
 * Bàn giao bộ lọc KiGi dựng được sang trang Tìm nhà.
 *
 * URL của trang Tìm nhà không chở được tiện nghi, mong muốn mềm hay điểm neo đi lại — nên kết quả
 * trợ lý được gửi qua sessionStorage, trang Tìm nhà áp bằng đúng hàm nó dùng cho trợ lý gõ tay, rồi
 * xoá. Mất khoá (mở lại liên kết sau đó) hay JSON hỏng thì coi như không có gì để bàn giao.
 */
export const HANDOFF_KEY = "kgs:tro-ly-ban-giao";

const defaultStorage = (): Storage | undefined => {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
};

export function saveHandoff(r: AssistantResult, storage: Storage | undefined = defaultStorage()) {
  try {
    storage?.setItem(HANDOFF_KEY, JSON.stringify(r));
  } catch {
    // Trình duyệt chặn bộ nhớ: trang Tìm nhà mở không có bộ lọc, người dùng vẫn lọc tay được.
  }
}

export function takeHandoff(
  storage: Storage | undefined = defaultStorage(),
): AssistantResult | null {
  try {
    const raw = storage?.getItem(HANDOFF_KEY);
    storage?.removeItem(HANDOFF_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as AssistantResult;
    return r && typeof r === "object" && r.criteria ? r : null;
  } catch {
    try {
      storage?.removeItem(HANDOFF_KEY);
    } catch {
      /* bỏ qua */
    }
    return null;
  }
}
