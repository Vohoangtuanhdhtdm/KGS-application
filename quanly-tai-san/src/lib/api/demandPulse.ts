import { api, toQuery } from "./http";
import type { ListingTypeCode } from "@/constants/enums";

/**
 * Nhịp cầu — số người đang đăng nhu cầu tìm nhà theo khu vực. Chỉ là con số gộp: máy chủ đếm
 * người khác nhau và bỏ mọi nhóm dưới 3 người.
 */

export interface DemandPulseBand {
  label: string;
  min: number | null;
  max: number | null;
  people: number;
}

export interface DemandPulse {
  /** null = mọi loại tin. */
  type: ListingTypeCode | null;
  city: string;
  /** null = cả tỉnh/thành. */
  district: string | null;
  people: number;
  bands: DemandPulseBand[];
}

export interface DemandPulseQuery {
  type?: ListingTypeCode | null;
  city?: string | null;
  district?: string | null;
}

export const demandPulseApi = {
  /** null khi khu vực này chưa đủ 3 người. */
  get: (q: DemandPulseQuery) =>
    api<{ group: DemandPulse | null }>(`/demand-pulse${toQuery({ ...q })}`).then((r) => r.group),

  top: (type?: ListingTypeCode) => api<DemandPulse[]>(`/demand-pulse/top${toQuery({ type })}`),
};
