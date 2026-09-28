/**
 * SpotlightCard — lấy từ React Bits (https://reactbits.dev/components/spotlight-card, bản TS + Tailwind).
 *
 * Chỉnh so với bản gốc:
 *
 * 1. **Dùng token của theme.** Bản gốc cứng `bg-neutral-900 border-neutral-800` — một thẻ đen
 *    giữa trang nền sáng. Ở đây nền và viền đi theo `bg-card` / `border`, nên thẻ đúng trong
 *    cả hai theme.
 * 2. **Màu đèn là CSS tuỳ ý**, không bắt buộc dạng rgba(). Nhờ vậy truyền được
 *    `color-mix(in oklch, var(--ws-owner) 20%, transparent)` — đèn mang đúng màu của không
 *    gian làm việc mà thẻ đại diện.
 * 3. **Không tự quyết bo góc và đệm** (bản gốc cứng rounded-3xl p-8); trang dùng tự đặt.
 */
import React, { useRef, useState } from "react";

interface SpotlightCardProps extends React.PropsWithChildren {
  className?: string;
  spotlightColor?: string;
}

export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "color-mix(in oklch, var(--primary) 18%, transparent)",
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  return (
    <div
      ref={divRef}
      onMouseMove={(e) => {
        if (!divRef.current || focused) return;
        const r = divRef.current.getBoundingClientRect();
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onFocus={() => {
        setFocused(true);
        setOpacity(0.9);
      }}
      onBlur={() => {
        setFocused(false);
        setOpacity(0);
      }}
      onMouseEnter={() => setOpacity(0.9)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden border bg-card ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-in-out motion-reduce:transition-none"
        style={{
          opacity,
          background: `radial-gradient(circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
