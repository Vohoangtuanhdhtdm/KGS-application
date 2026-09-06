import { api } from "./http";

export interface ValuationRequest {
  area: number;
  city: string;
  district: string;
  ward?: string | null;
  propertyType?: string | null;
  houseDirection?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floors?: number | null;
  frontage?: number | null;
}

export interface ValuationResult {
  price: number;
  priceLow: number;
  priceHigh: number;
  pricePerM2: number;
  /** "cao" | "trung bình" | "thấp" */
  confidence: string;
  areaMedianPricePerM2: number | null;
  areaSampleSize: number;
  notes: string[];
}

export interface ValuationModelInfo {
  available: boolean;
  trainedAt: string | null;
  rowsFit: number | null;
  /** Sai số phần trăm trung vị trên tập kiểm tra. */
  mdape: number | null;
  /** Tỉ lệ dự đoán nằm trong sai số 10%. */
  ppe10: number | null;
  ppe20: number | null;
}

export const valuationApi = {
  estimate: (body: ValuationRequest) =>
    api<ValuationResult>("/valuation/estimate", { method: "POST", body }),
  modelInfo: () => api<ValuationModelInfo>("/valuation/model-info", { skipAuth: true }),
};
