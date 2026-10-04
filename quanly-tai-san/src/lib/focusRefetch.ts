import { focusManager } from "@tanstack/react-query";

/**
 * Coi việc CỬA SỔ được focus là "quay lại trang", không chỉ việc tab hết ẩn.
 *
 * TanStack Query v5 chỉ nghe visibilitychange. Hai cửa sổ trình duyệt đặt cạnh nhau (một bên
 * admin, một bên chủ tin) luôn "hiện", nên bấm sang cửa sổ kia không làm mới gì cả. Đây là
 * lưới an toàn khi kênh thời gian thực chưa nối được.
 */
export function installWindowFocusRefetch() {
  focusManager.setEventListener((handleFocus) => {
    if (typeof window === "undefined") return;
    const onVisibility = () => handleFocus(document.visibilityState === "visible");
    // Phải báo cả lúc MẤT focus: focusManager chỉ làm mới khi trạng thái đổi từ false → true.
    const onFocus = () => handleFocus(true);
    const onBlur = () => handleFocus(false);
    window.addEventListener("visibilitychange", onVisibility, false);
    window.addEventListener("focus", onFocus, false);
    window.addEventListener("blur", onBlur, false);
    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  });
}
