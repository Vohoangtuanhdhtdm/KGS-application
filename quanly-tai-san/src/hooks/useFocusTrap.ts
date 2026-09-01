import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // offsetParent null = đang bị ẩn (display:none hoặc ancestor ẩn)
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Giam focus bên trong một lớp modal và trả focus về đúng chỗ cũ khi đóng.
 *
 * `aria-modal="true"` KHÔNG tự làm việc này: thiếu trap, người dùng bàn phím Tab được
 * ra nền đang bị lớp phủ che, và khi đóng thì focus rơi vào phần tử ngẫu nhiên.
 *
 * Dùng chung cho mọi lớp modal (FeatureSheet, MoreSheet, AssetDetailDialog,
 * AssetListOverlay) — sửa một chỗ thay vì lặp logic ở từng component.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    // Nhớ phần tử đã mở modal để trả focus về khi đóng
    const opener = document.activeElement as HTMLElement | null;

    // Hoãn sang task kế tiếp: khi modal mount ĐỒNG BỘ ngay trong sự kiện click (ví dụ
    // MoreSheet mở bằng setState cục bộ), focus đặt lúc này sẽ bị chính sự kiện click
    // đang dở ghi đè lại về nút vừa bấm. setTimeout(0) chạy sau khi click kết thúc — và
    // vẫn hoạt động ở tab ẩn, khác requestAnimationFrame.
    const focusTimer = setTimeout(() => {
      // Nội dung có thể tải bất đồng bộ nên chưa chắc đã có phần tử focus được —
      // khi đó focus chính container (đã gắn tabIndex={-1}).
      const first = focusablesIn(container)[0];
      (first ?? container).focus({ preventScroll: true });
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusablesIn(container);
      if (list.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      const inside = container.contains(document.activeElement);

      if (e.shiftKey) {
        if (!inside || document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (!inside || document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    // Capture: chặn trước khi trình duyệt xử lý Tab mặc định
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown, true);

      // Chỉ trả focus khi focus VẪN thuộc về modal này (hoặc đã rơi về body). Nếu một
      // modal khác vừa mở và giành focus rồi — đúng luồng "MoreSheet → chọn mục →
      // FeatureSheet mở" — thì không được cướp lại, nếu không focus sẽ nhảy ra ngoài
      // lớp modal mới.
      const ae = document.activeElement as HTMLElement | null;
      const focusStillOurs = !ae || ae === document.body || container.contains(ae);
      if (focusStillOurs && opener && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return ref;
}
