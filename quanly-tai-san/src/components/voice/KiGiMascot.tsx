import type { VoiceState } from "@/lib/voice/useGeminiLive";

const LABEL: Record<VoiceState, string> = {
  idle: "KiGi đang chờ",
  connecting: "KiGi đang kết nối",
  ready: "KiGi đang chờ bạn chạm để nói",
  listening: "KiGi đang nghe",
  thinking: "KiGi đang nghĩ",
  speaking: "KiGi đang nói",
  error: "KiGi đang gặp trục trặc",
};

/**
 * KiGi — ngôi nhà nhỏ có mặt. Chỉ vẽ theo `state` và `level` (0..1), không biết gì về kết nối.
 *
 * Hoạt ảnh bằng CSS trong SVG, không thêm thư viện. Người dùng bật "giảm chuyển động" thì mọi
 * keyframes tắt; miệng vẫn mấp máy theo âm lượng vì đó là thông tin, không phải trang trí.
 */
export function KiGiMascot({
  state,
  level,
  size = 160,
}: {
  state: VoiceState;
  level: number;
  size?: number;
}) {
  const lv = Math.max(0, Math.min(1, level));
  const mouthH = state === "speaking" ? 2 + lv * 14 : 0;
  const eyeY = state === "thinking" ? 88 : 92;

  return (
    <svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      role="img"
      aria-label={LABEL[state]}
      className={`kigi kigi-${state}`}
    >
      <style>{`
        .kigi .body { transform-origin: 80px 140px; }
        .kigi-idle .body, .kigi-ready .body { animation: kigi-breathe 3s ease-in-out infinite; }
        .kigi-connecting .eyes { animation: kigi-look 1.6s ease-in-out infinite; }
        .kigi-thinking .dot { animation: kigi-dot 1.2s ease-in-out infinite; }
        .kigi-thinking .dot:nth-child(2) { animation-delay: .2s; }
        .kigi-thinking .dot:nth-child(3) { animation-delay: .4s; }
        .kigi-ready .mic { animation: kigi-blink 1.4s ease-in-out infinite; }
        .kigi-listening .ring { transition: r .1s linear, opacity .1s linear; }
        @keyframes kigi-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.02); } }
        @keyframes kigi-look { 0%,100% { transform: translateX(0); } 30% { transform: translateX(-4px); } 70% { transform: translateX(4px); } }
        @keyframes kigi-dot { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
        @keyframes kigi-blink { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .kigi * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {state === "listening" && (
        <g fill="none" stroke="var(--primary)">
          <circle
            className="ring"
            cx="80"
            cy="96"
            r={62 + lv * 14}
            strokeOpacity={0.15 + lv * 0.5}
            strokeWidth="3"
          />
          <circle
            className="ring"
            cx="80"
            cy="96"
            r={70 + lv * 8}
            strokeOpacity={0.1 + lv * 0.3}
            strokeWidth="2"
          />
        </g>
      )}

      <g className="body">
        {/* Ống khói + mái + thân nhà */}
        <rect x="104" y="30" width="12" height="24" rx="3" fill="var(--primary)" />
        <path
          d="M80 22 L142 72 Q146 76 140 78 L20 78 Q14 76 18 72 Z"
          fill="var(--primary)"
          stroke="var(--primary)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <rect
          x="30"
          y="66"
          width="100"
          height="74"
          rx="16"
          fill="var(--card)"
          stroke="var(--primary)"
          strokeWidth="4"
        />

        {/* Má hồng */}
        <circle cx="50" cy="108" r="6" fill="#f472b6" fillOpacity="0.35" />
        <circle cx="110" cy="108" r="6" fill="#f472b6" fillOpacity="0.35" />

        {/* Mắt */}
        <g className="eyes" fill="var(--foreground)">
          {state === "error" ? (
            <>
              <rect x="56" y={eyeY - 1} width="12" height="3" rx="1.5" />
              <rect x="92" y={eyeY - 1} width="12" height="3" rx="1.5" />
            </>
          ) : (
            <>
              <circle cx="62" cy={eyeY} r="6" />
              <circle cx="98" cy={eyeY} r="6" />
              <circle cx="64" cy={eyeY - 2} r="2" fill="var(--card)" />
              <circle cx="100" cy={eyeY - 2} r="2" fill="var(--card)" />
            </>
          )}
        </g>

        {/* Miệng */}
        {state === "speaking" ? (
          <ellipse cx="80" cy="118" rx="10" ry={mouthH / 2 + 1} fill="var(--foreground)" />
        ) : state === "error" ? (
          <path
            d="M70 122 Q80 114 90 122"
            fill="none"
            stroke="var(--foreground)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : state === "listening" ? (
          <circle cx="80" cy="118" r="4" fill="var(--foreground)" />
        ) : (
          <path
            d="M70 114 Q80 124 90 114"
            fill="none"
            stroke="var(--foreground)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
      </g>

      {state === "thinking" && (
        <g fill="var(--primary)">
          <circle className="dot" cx="64" cy="12" r="4" />
          <circle className="dot" cx="80" cy="8" r="4" />
          <circle className="dot" cx="96" cy="12" r="4" />
        </g>
      )}

      {state === "ready" && (
        <g className="mic" transform="translate(124 120)">
          <circle r="14" fill="var(--primary)" />
          <rect x="-4" y="-8" width="8" height="12" rx="4" fill="var(--primary-foreground)" />
          <path
            d="M-7 1 Q0 10 7 1 M0 6 V9"
            fill="none"
            stroke="var(--primary-foreground)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}
