/**
 * BlurText — lấy từ React Bits (https://reactbits.dev/text-animations/blur-text, bản TS + Tailwind).
 *
 * Chỉnh so với bản gốc:
 *
 * 1. **Thẻ ngữ nghĩa tuỳ chọn** (`as="h1"`). Bản gốc luôn là `<p>`, nên dùng nó cho tiêu đề
 *    trang là xoá mất h1 — thứ trình đọc màn hình dùng để trả lời "tôi đang ở đâu".
 * 2. **Trình đọc màn hình đọc câu liền.** Chữ bị cắt thành từng span; aria-label trên thẻ bao
 *    giữ nguyên câu, các span con ẩn khỏi cây trợ năng.
 * 3. **Tôn trọng prefers-reduced-motion**: hiện thẳng chữ, không mờ, không trượt.
 * 4. **Biên độ trượt nhỏ hơn** (12px thay vì 50px). Với tiêu đề trang, trượt 50px trông như
 *    giao diện đang giật chứ không phải đang hiện ra.
 */
import { motion, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useRef, useState } from "react";

type Tag = "h1" | "h2" | "p";

interface BlurTextProps {
  text: string;
  as?: Tag;
  /** Độ trễ giữa hai từ, mili giây. */
  delay?: number;
  className?: string;
  stepDuration?: number;
}

const FROM = { filter: "blur(8px)", opacity: 0, y: -12 };
const TO = {
  filter: ["blur(8px)", "blur(3px)", "blur(0px)"],
  opacity: [0, 0.6, 1],
  y: [-12, 2, 0],
};

export default function BlurText({
  text,
  as = "p",
  delay = 90,
  className = "",
  stepDuration = 0.32,
}: BlurTextProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [settled, setSettled] = useState(false);
  const words = text.split(" ");
  const Tag = as;

  useEffect(() => {
    if (!ref.current || reduce) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  // Chốt chặn: hết thời lượng hiệu ứng thì thay bằng chữ tĩnh, bất kể hiệu ứng đã chạy hay
  // chưa. Bản gốc để chữ ở opacity 0 cho tới khi rAF chạy — trình duyệt không vẽ khung hình
  // (tab nền, tiết kiệm pin) thì tiêu đề trang vô hình mãi. Khi hiệu ứng chạy bình thường, lúc
  // chốt chặn kích hoạt nó đã xong, và trạng thái cuối trùng hệt chữ tĩnh nên không thấy bước nhảy.
  useEffect(() => {
    if (reduce) return;
    const ms = words.length * delay + stepDuration * 2 * 1000 + 400;
    const id = setTimeout(() => setSettled(true), ms);
    return () => clearTimeout(id);
  }, [reduce, words.length, delay, stepDuration]);

  if (reduce || settled) return <Tag className={className}>{text}</Tag>;

  const transition = (i: number): Transition => ({
    duration: stepDuration * 2,
    times: [0, 0.5, 1],
    delay: (i * delay) / 1000,
    ease: "easeOut",
  });

  return (
    <Tag
      ref={ref as React.RefObject<never>}
      aria-label={text}
      className={`${className} flex flex-wrap`}
    >
      {words.map((w, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          initial={FROM}
          animate={inView ? TO : FROM}
          transition={transition(i)}
          style={{ display: "inline-block", willChange: "transform, filter, opacity" }}
        >
          {w}
          {i < words.length - 1 && " "}
        </motion.span>
      ))}
    </Tag>
  );
}
