import { api } from "./http";
import type { SavedSearchCriteria } from "./savedSearches";

/** Nơi người dùng muốn ở gần, kèm thời gian đi lại hoặc bán kính. */
export interface AssistantAnchor {
  text: string;
  travelMinutes: number | null;
  /** walking | cycling | driving */
  travelMode: string | null;
  radiusKm: number | null;
}

export interface AssistantResult {
  /** Điều kiện CỨNG — cùng hình dạng với tiêu chí tìm kiếm / bộ lọc đã lưu. */
  criteria: SavedSearchCriteria & { latitude?: number | null; longitude?: number | null };
  /** Mong muốn MỀM — chỉ dùng để xếp hạng. */
  preferences: string[];
  anchor: AssistantAnchor | null;
  /** Phần trợ lý không chuyển được thành bộ lọc — hiện ra để người dùng biết. */
  unrecognized: string[];
  model: string;
  latencyMs: number;
  totalTokens: number;
}

export const assistantApi = {
  /** Dịch một câu thành bộ lọc. `previous` = kết quả câu trước, để câu sau là điều chỉnh. */
  searchIntent: (message: string, previous: AssistantResult | null) =>
    api<AssistantResult>("/assistant/search-intent", {
      method: "POST",
      skipAuth: true,
      body: {
        message,
        current: previous?.criteria ?? null,
        currentPreferences: previous?.preferences ?? null,
        currentAnchor: previous?.anchor ?? null,
      },
    }),
};
