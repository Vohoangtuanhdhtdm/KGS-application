import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { takeDemandDraft, type DemandDraft } from "@/lib/demandDraft";

/**
 * Khách bấm "Đăng nhu cầu" → đăng nhập → quay lại trang: trả bản nháp họ đã điền để trang mở lại
 * hộp. Chỉ đọc (và xoá) bản nháp khi đã đăng nhập, đúng một lần. `clear` để trang bỏ bản nháp
 * sau khi hộp đóng — lần mở sau dùng bộ lọc hiện tại.
 */
export function useDemandDraftResume(): [DemandDraft | null, () => void] {
  const { isAuthenticated, isLoading } = useAuth();
  const [draft, setDraft] = useState<DemandDraft | null>(null);
  const taken = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || taken.current) return;
    taken.current = true;
    setDraft(takeDemandDraft());
  }, [isAuthenticated, isLoading]);

  return [draft, () => setDraft(null)];
}
