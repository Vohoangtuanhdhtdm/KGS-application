import { AMENITIES, type AmenityKey } from "@/constants/enums";
import type { PublicListingSummaryDto } from "@/lib/api/listings";
import { formatCurrency } from "@/lib/format";

const short = (v: number) => formatCurrency(v, { compact: true });

export interface MatchContext {
  priceMax?: number | null;
  totalCostMax?: number | null;
  bedroomsMin?: number | null;
  areaMin?: number | null;
  areaMax?: number | null;
  petsAllowed?: boolean | null;
  amenities?: string[] | null;
  /** Nhãn điểm neo ("Chỗ làm", "đường Hàm Nghi") nếu đang tìm quanh một điểm. */
  centerLabel?: string | null;
}

/**
 * "Vì sao hợp" cho một tin, tính bằng QUY TẮC từ dữ liệu thật của tin — không nhờ LLM.
 *
 * Lý do: lời giải thích phải kiểm chứng được. Mỗi dòng ở đây đối chiếu một con số hay một cờ
 * trong tin với điều kiện người dùng đã nêu ("6,8 triệu ≤ 7 triệu"). Một LLM viết lời khen
 * thì nghe hay hơn nhưng có thể bịa — đúng thứ không được phép trên trang tìm nhà. Đồng thời
 * không tốn thêm lượt gọi LLM nào cho mỗi tin.
 */
export function matchReasons(p: PublicListingSummaryDto, c: MatchContext): string[] {
  const out: string[] = [];
  if (c.totalCostMax != null && p.totalMonthlyCost > 0 && p.totalMonthlyCost <= c.totalCostMax)
    out.push(`Tổng chi phí ${short(p.totalMonthlyCost)} ≤ ${short(c.totalCostMax)}`);
  else if (c.priceMax != null && p.price <= c.priceMax)
    out.push(`Giá ${short(p.price)} ≤ ${short(c.priceMax)}`);
  if (c.bedroomsMin != null && p.bedrooms != null && p.bedrooms >= c.bedroomsMin)
    out.push(`${p.bedrooms} phòng ngủ`);
  if ((c.areaMin != null || c.areaMax != null) && p.area != null) out.push(`${p.area} m²`);
  if (c.petsAllowed && p.petsAllowed) out.push("Cho nuôi thú cưng");
  for (const a of c.amenities ?? [])
    if (p.amenities.includes(a)) out.push(AMENITIES[a as AmenityKey] ?? a);
  if (c.centerLabel && p.distanceMeters != null)
    out.push(
      // Giữ nguyên chữ hoa: nhãn có thể là tên riêng ("đường Hàm Nghi"), không chỉ "Chỗ làm".
      `Cách ${c.centerLabel} ${(p.distanceMeters / 1000).toFixed(1).replace(".", ",")} km`,
    );
  for (const m of p.matchedPreferences ?? []) out.push(`Có nhắc “${m}”`);
  return out.slice(0, 5);
}
