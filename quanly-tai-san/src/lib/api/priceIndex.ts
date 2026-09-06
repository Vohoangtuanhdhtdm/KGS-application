import { api, toQuery } from "./http";

export interface PriceIndexPoint {
  weekStart: string;
  /** Tuần gốc = 100. Mức TƯƠNG ĐỐI, không phải giá tuyệt đối. */
  index: number;
  count: number;
  moePercent: number | null;
}

export interface PriceIndexForecast {
  method: string;
  nextIndex: number;
  changePercent: number;
  backtestMape: number;
  /** false = dữ liệu chưa đủ để dự báo đáng tin. Giao diện phải nói rõ. */
  reliable: boolean;
  note: string;
}

export interface PriceIndexDto {
  available: boolean;
  scope: string;
  points: PriceIndexPoint[];
  /** Trung vị thô — chỉ để đối chiếu, không phải chỉ số chính. */
  naivePoints: PriceIndexPoint[];
  changePoints: number | null;
  weeklyVolatility: number | null;
  mixShiftMeanPoints: number | null;
  mixShiftMaxPoints: number | null;
  forecast: PriceIndexForecast | null;
  baseWeek: string | null;
  builtAt: string | null;
  method: string | null;
  rows: number | null;
  caveats: string[];
}

export const priceIndexApi = {
  get: (province?: string, district?: string) =>
    api<PriceIndexDto>(`/valuation/price-index${toQuery({ province, district })}`, {
      skipAuth: true,
    }),
};
