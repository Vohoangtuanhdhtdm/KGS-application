import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Đếm từ 0 lên `target` bằng ease-out cubic. Tôn trọng prefers-reduced-motion:
 * khi người dùng yêu cầu giảm chuyển động thì trả thẳng giá trị cuối, không đếm.
 */
export function useCountUp(target: number, duration = 500): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    // Reset TRƯỚC khi đếm lại: card không unmount khi đổi marker, thiếu dòng này thì
    // giá trị cũ đứng nguyên tới khung hình đầu tiên rồi mới nhảy — mất hẳn cảm giác đếm.
    setValue(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Chốt an toàn: tab ẩn thì trình duyệt không chạy rAF, số sẽ đứng mãi ở 0 — tức hiện
    // SAI giá trị. Timer vẫn chạy (dù bị giảm nhịp) nên dùng nó để chốt về giá trị thật.
    const settle = setTimeout(() => setValue(target), duration + 100);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [target, duration]);

  return value;
}
