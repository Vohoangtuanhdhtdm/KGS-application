import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  POST_DEMAND_FLAG,
  hasPostDemandFlag,
  takeDemandDraft,
  type DemandDraft,
} from "@/lib/demandDraft";

/**
 * Khách bấm "Đăng nhu cầu" → đăng nhập → quay lại trang: trả bản nháp họ đã điền và cho biết có
 * cần mở lại hộp không. Mở lại khi có bản nháp HOẶC đường dẫn mang cờ `dang_nhu_cau=1` — cờ giữ
 * cho hộp vẫn mở (trống) khi bản nháp mất. Chỉ đọc khi đã đăng nhập, đúng một lần; cờ được gỡ khỏi
 * thanh địa chỉ để tải lại trang không mở hộp lần nữa. `clear` gọi khi hộp đóng.
 */
export function useDemandDraftResume(): [DemandDraft | null, boolean, () => void] {
  const { isAuthenticated, isLoading } = useAuth();
  const [draft, setDraft] = useState<DemandDraft | null>(null);
  const [resume, setResume] = useState(false);
  const taken = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || taken.current) return;
    taken.current = true;
    const d = takeDemandDraft();
    const flagged = hasPostDemandFlag(window.location.search);
    if (flagged) {
      const url = new URL(window.location.href);
      url.searchParams.delete(POST_DEMAND_FLAG);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    setDraft(d);
    setResume(d !== null || flagged);
  }, [isAuthenticated, isLoading]);

  return [
    draft,
    resume,
    () => {
      setDraft(null);
      setResume(false);
    },
  ];
}
