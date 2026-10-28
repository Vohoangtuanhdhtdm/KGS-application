import { toast } from "sonner";
import type { SavedSearchDto } from "@/lib/api/savedSearches";

/**
 * Nhu cầu vừa mở bị bộ lọc tự động giữ lại chờ quản trị duyệt: báo cho người tìm biết vì sao, để
 * họ không tưởng chủ nhà đã thấy. Trả `true` khi đã báo (nơi gọi bỏ qua toast "đã đăng").
 */
export function toastIfPendingReview(s: SavedSearchDto): boolean {
  if (!s.discoverableByOwners || s.demandReview !== 2) return false;
  toast.info("Đã gửi — đang chờ duyệt", {
    description: `Lý do: ${s.demandReviewReason ?? "cần kiểm tra thêm"}. Bạn sẽ nhận thông báo khi có kết quả.`,
  });
  return true;
}
