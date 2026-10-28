import type { SavedSearchDto } from "@/lib/api/savedSearches";

/**
 * Trạng thái một nhu cầu như người tìm thấy ở "Nhu cầu của tôi".
 * - open: đã duyệt, chủ nhà phù hợp đang thấy.
 * - pending / rejected: mở cho chủ nhà nhưng đang chờ duyệt / bị từ chối — chủ nhà CHƯA thấy.
 * - expired: tắt vì hết hạn 30 ngày. alerts: chỉ nhận báo tin mới.
 */
export type DemandState = "open" | "pending" | "rejected" | "expired" | "alerts";

export function demandState(
  s: Pick<SavedSearchDto, "discoverableByOwners" | "discoverableUntil" | "demandReview">,
): DemandState {
  if (s.discoverableByOwners) {
    if (s.demandReview === 2) return "pending";
    if (s.demandReview === 3) return "rejected";
    return "open";
  }
  if (s.discoverableUntil && new Date(s.discoverableUntil) <= new Date()) return "expired";
  return "alerts";
}
