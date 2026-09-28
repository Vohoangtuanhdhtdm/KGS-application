import type { ValuationResult } from "@/lib/api/valuation";

export interface PriceDeviation {
  huong: "cao" | "thap";
  /** Vượt khỏi khoảng thêm hơn một lần biên độ nữa — đủ xa để nói mạnh. */
  manh: boolean;
  /** Lệch bao nhiêu phần trăm so với giá ước tính (điểm giữa). */
  phanTram: number;
}

/**
 * So một mức giá với KHOẢNG của mô hình, không phải với điểm giữa.
 *
 * Dùng chung cho form đăng tin và trang tra cứu định giá, để hai nơi không bao giờ cảnh
 * báo theo hai quy tắc khác nhau. Lý do so với khoảng (chứ không phải một ngưỡng % cố định
 * quanh điểm giữa) nằm ở PriceSuggestion.tsx: ngưỡng cố định thấp hơn sai số của chính mô
 * hình, nên phân nửa số cảnh báo sẽ là do mô hình sai chứ không phải người dùng sai.
 *
 * Trả null khi không có gì để nói: chưa nhập giá, giá nằm trong khoảng, hoặc mô hình tự
 * nhận độ tin cậy thấp — lúc đó không có căn cứ để bảo người dùng rằng họ sai.
 */
export function comparePriceToBand(
  r: ValuationResult | null | undefined,
  price: number | null | undefined,
): PriceDeviation | null {
  if (!r || price == null || price <= 0) return null;
  if (r.confidence === "thấp") return null;

  const above = price > r.priceHigh;
  const below = price < r.priceLow;
  if (!above && !below) return null;

  // Biên độ nửa khoảng — dùng làm đơn vị đo "vượt ra ngoài bao xa".
  const half = Math.max(1, r.priceHigh - r.price);
  const over = above ? (price - r.priceHigh) / half : (r.priceLow - price) / half;

  return {
    huong: above ? "cao" : "thap",
    manh: over >= 1,
    phanTram: Math.abs(Math.round(((price - r.price) / r.price) * 100)),
  };
}
