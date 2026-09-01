import { useCallback, useEffect, useRef, useState } from "react";

/** Kéo quá ngưỡng này (px) thì nhả tay là đóng. */
const DISTANCE_THRESHOLD = 96;
/** Hoặc vuốt nhanh hơn ngưỡng này (px/ms) thì đóng dù kéo chưa đủ xa. */
const VELOCITY_THRESHOLD = 0.5;

/** Con trỏ có thể đã nhả trước khi ta kịp gọi — bắt/nhả capture không được làm hỏng cử chỉ. */
function safeCapture(el: Element, id: number, release: boolean) {
  try {
    if (release) el.releasePointerCapture(id);
    else el.setPointerCapture(id);
  } catch {
    /* con trỏ không còn hoạt động — bỏ qua */
  }
}

export interface SwipeToClose {
  /** Gắn vào vùng tay cầm (header) — KHÔNG gắn vào vùng nội dung cuộn được. */
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  /** Gắn vào chính tấm sheet. */
  sheetProps: {
    style: React.CSSProperties;
  };
}

/**
 * Vuốt xuống để đóng sheet trên màn cảm ứng.
 *
 * Chỉ gắn vào vùng tay cầm chứ không gắn cả tấm sheet: nội dung bên trong sheet là vùng
 * cuộn dọc, nếu bắt cử chỉ ở đó thì kéo để cuộn danh sách sẽ bị hiểu nhầm thành kéo đóng
 * — đúng loại xung đột cử chỉ đã ghi nhận lúc rà soát.
 *
 * Dùng Pointer Events chứ không phải Touch Events để chuột/bút cũng chạy được, và dùng
 * pointer capture để không mất sự kiện khi ngón tay trượt ra ngoài vùng tay cầm.
 */
export function useSwipeToClose(onClose: () => void, enabled = true): SwipeToClose {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number } | null>(null);

  // Sheet đóng/mở lại phải về đúng vị trí, tránh mở ra đã bị đẩy lệch sẵn
  useEffect(() => {
    if (!enabled) {
      start.current = null;
      setOffset(0);
      setDragging(false);
    }
  }, [enabled]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      start.current = { y: e.clientY, t: e.timeStamp };
      setDragging(true);
      safeCapture(e.currentTarget, e.pointerId, false);
    },
    [enabled],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!start.current) return;
    // Chỉ đi theo chiều xuống; kéo lên giữ nguyên để sheet không bay khỏi màn hình
    setOffset(Math.max(0, e.clientY - start.current.y));
  }, []);

  const finish = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current;
      if (!s) return;
      start.current = null;
      safeCapture(e.currentTarget, e.pointerId, true);
      setDragging(false);

      const distance = e.clientY - s.y;
      const elapsed = Math.max(1, e.timeStamp - s.t);
      const velocity = distance / elapsed;

      if (distance > DISTANCE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
        onClose();
        return;
      }
      setOffset(0); // chưa đủ → bật về chỗ cũ
    },
    [onClose],
  );

  const cancel = useCallback((e: React.PointerEvent) => {
    start.current = null;
    safeCapture(e.currentTarget, e.pointerId, true);
    setDragging(false);
    setOffset(0);
  }, []);

  return {
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: cancel,
    },
    sheetProps: {
      style: {
        transform: offset > 0 ? `translateY(${offset}px)` : undefined,
        // Chỉ có transition lúc bật về; lúc đang kéo phải bám ngón tay theo thời gian thực
        transition: dragging ? "none" : undefined,
      },
    },
  };
}
