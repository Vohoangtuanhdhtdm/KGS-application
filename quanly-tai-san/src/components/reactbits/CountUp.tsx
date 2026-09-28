/**
 * CountUp — lấy từ React Bits (https://reactbits.dev/text-animations/count-up, bản TS + Tailwind).
 *
 * Chỉnh so với bản gốc, và vì sao:
 *
 * 1. **Tôn trọng prefers-reduced-motion.** Bản gốc luôn chạy lò xo. Người đã bật giảm chuyển
 *    động (thường vì chóng mặt hoặc để đọc cho dễ) giờ thấy thẳng con số cuối.
 * 2. **Định dạng theo vi-VN.** Bản gốc dựng chuỗi theo en-US rồi thay dấu phẩy — với số thập
 *    phân kiểu Việt (dấu phẩy thập phân, dấu chấm hàng nghìn) cách đó cho ra số sai. Ở đây
 *    gọi thẳng Intl với vi-VN.
 * 3. **Có nhãn cho trình đọc màn hình.** Nội dung chữ bị ghi đè hàng chục lần mỗi giây trong
 *    lúc chạy; trình đọc màn hình sẽ đọc một chuỗi số rác. aria-label giữ giá trị cuối, còn
 *    phần số đang chạy bị ẩn khỏi cây trợ năng.
 */
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useCallback, useEffect, useRef } from "react";

interface CountUpProps {
  to: number;
  from?: number;
  delay?: number;
  duration?: number;
  className?: string;
  /** Số chữ số thập phân hiển thị. Mặc định 0. */
  decimals?: number;
  /** Chuỗi gắn sau số, ví dụ " ₫". */
  suffix?: string;
}

export default function CountUp({
  to,
  from = 0,
  delay = 0,
  duration = 1.2,
  className = "",
  decimals = 0,
  suffix = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(from);

  const springValue = useSpring(motionValue, {
    damping: 20 + 40 * (1 / duration),
    stiffness: 100 * (1 / duration),
  });

  const isInView = useInView(ref, { once: true, margin: "0px" });

  const format = useCallback(
    (v: number) =>
      new Intl.NumberFormat("vi-VN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(v) + suffix,
    [decimals, suffix],
  );

  /** Lò xo đã phát ít nhất một khung hình chưa. */
  const started = useRef(false);

  // Trạng thái nghỉ: nếu giảm chuyển động thì hiện luôn số cuối, không đi qua số khởi điểm.
  useEffect(() => {
    if (ref.current) ref.current.textContent = format(reduce ? to : from);
  }, [from, to, reduce, format]);

  useEffect(() => {
    if (reduce || !isInView) return;
    const id = setTimeout(() => motionValue.set(to), delay * 1000);
    return () => clearTimeout(id);
  }, [isInView, reduce, motionValue, to, delay]);

  // Chốt chặn — thêm vào so với bản gốc, và là thay đổi quan trọng nhất.
  //
  // Lò xo chạy bằng requestAnimationFrame. Khi trình duyệt không vẽ khung hình (tab nền,
  // chế độ tiết kiệm pin, cửa sổ bị che), rAF không chạy và bản gốc đứng yên ở số KHỞI ĐIỂM —
  // với một con số giá, nghĩa là hiện "0 ₫" dưới nhãn "Giá ước tính". Hiệu ứng hỏng thì chấp
  // nhận được; một con số SAI thì không. setTimeout vẫn chạy khi rAF bị treo, nên hết thời
  // lượng mà lò xo chưa phát khung nào thì đặt thẳng số cuối.
  useEffect(() => {
    if (reduce) return;
    const guard = setTimeout(
      () => {
        if (!started.current && ref.current) ref.current.textContent = format(to);
      },
      (delay + duration) * 1000 + 250,
    );
    return () => clearTimeout(guard);
  }, [to, delay, duration, reduce, format]);

  useEffect(() => {
    if (reduce) return;
    return springValue.on("change", (latest: number) => {
      started.current = true;
      if (ref.current) ref.current.textContent = format(latest);
    });
  }, [springValue, format, reduce]);

  return (
    <span className={className} role="text" aria-label={format(to)}>
      <span ref={ref} aria-hidden="true" />
    </span>
  );
}
