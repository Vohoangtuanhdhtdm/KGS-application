import { AMENITIES, type AmenityKey } from "@/constants/enums";
import type { SavedSearchCriteria } from "@/lib/api/savedSearches";
import { formatCurrency } from "@/lib/format";

const short = (v: number) => formatCurrency(v, { compact: true });
const km = (m: number) =>
  m < 1000 ? `${Math.round(m / 100) * 100} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

/**
 * Tóm một nhu cầu tìm nhà thành vài cụm chữ ngắn — thứ chủ tin đọc để quyết định có mời
 * hay không. Chỉ nói những gì người tìm ĐÃ chọn; tiêu chí bỏ trống thì không nhắc tới.
 */
export function describeDemand(
  c: SavedSearchCriteria,
  centerDistanceMeters: number | null = null,
): string[] {
  const out: string[] = [];
  if (c.type === 1) out.push("Mua");
  if (c.type === 2) out.push("Thuê");

  const area = [c.district, c.city].filter(Boolean).join(", ");
  if (area) out.push(area);

  if (c.radiusMeters != null) {
    // centerDistanceMeters là cận trên của một dải thô (1 / 2 / 5 / 10 km) — xem
    // MatchmakingService.DistanceBand. 10 km nghĩa là "trên 5 km".
    const band =
      centerDistanceMeters == null
        ? null
        : centerDistanceMeters >= 10_000
          ? "hơn 5 km"
          : `dưới ${km(centerDistanceMeters)}`;
    out.push(
      band
        ? `Trong ${km(c.radiusMeters)} quanh một điểm cách nhà bạn ${band}`
        : `Trong bán kính ${km(c.radiusMeters)}`,
    );
  }

  if (c.priceMin != null && c.priceMax != null)
    out.push(`Giá ${short(c.priceMin)} – ${short(c.priceMax)}`);
  else if (c.priceMax != null) out.push(`Giá đến ${short(c.priceMax)}`);
  else if (c.priceMin != null) out.push(`Giá từ ${short(c.priceMin)}`);

  if (c.totalCostMax != null) out.push(`Tổng chi phí ≤ ${short(c.totalCostMax)}/tháng`);
  if (c.bedroomsMin != null) out.push(`Từ ${c.bedroomsMin} phòng ngủ`);
  if (c.petsAllowed === true) out.push("Có nuôi thú cưng");
  if (c.curfewFree === true) out.push("Cần giờ giấc tự do");
  if (c.sharedWithOwner === false) out.push("Không ở chung chủ");
  if (c.availableBy) {
    const d = new Date(c.availableBy);
    if (!Number.isNaN(d.getTime()))
      out.push(
        `Dọn vào trước ${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`,
      );
  }
  for (const a of c.amenities ?? []) {
    const label = AMENITIES[a as AmenityKey];
    if (label) out.push(label);
  }
  if (c.keyword) out.push(`“${c.keyword}”`);
  return out;
}
