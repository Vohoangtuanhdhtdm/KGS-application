import type { SavedSearchCriteria } from "@/lib/api/savedSearches";

/**
 * Bản nháp "Đăng nhu cầu" của khách chưa đăng nhập.
 *
 * Khách bấm Đăng nhu cầu thì phải đăng nhập trước; không giữ lại những gì họ vừa điền thì sau khi
 * đăng nhập họ phải làm lại từ đầu — và phần lớn sẽ bỏ. Bản nháp đi qua sessionStorage (chỉ
 * sống trong tab này), trang chứa hộp đọc một lần rồi xoá. Cùng khuôn với `lib/voice/handoff.ts`:
 * mọi lỗi (JSON hỏng, trình duyệt chặn bộ nhớ) đều coi như không có bản nháp.
 */
export const DEMAND_DRAFT_KEY = "kgs:nhu-cau-nhap";

export interface DemandDraft {
  name: string;
  criteria: SavedSearchCriteria;
  note: string;
  notify: boolean;
}

const defaultStorage = (): Storage | undefined => {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
};

export function saveDemandDraft(d: DemandDraft, storage: Storage | undefined = defaultStorage()) {
  try {
    storage?.setItem(DEMAND_DRAFT_KEY, JSON.stringify(d));
  } catch {
    // Bị chặn bộ nhớ: sau khi đăng nhập hộp mở trống, người dùng điền lại được.
  }
}

export function takeDemandDraft(
  storage: Storage | undefined = defaultStorage(),
): DemandDraft | null {
  try {
    const raw = storage?.getItem(DEMAND_DRAFT_KEY);
    storage?.removeItem(DEMAND_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as DemandDraft;
    return d && typeof d === "object" && d.criteria && typeof d.criteria === "object" ? d : null;
  } catch {
    try {
      storage?.removeItem(DEMAND_DRAFT_KEY);
    } catch {
      /* bỏ qua */
    }
    return null;
  }
}
