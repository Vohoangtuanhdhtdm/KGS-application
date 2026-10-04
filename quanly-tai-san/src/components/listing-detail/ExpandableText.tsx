import { useLayoutEffect, useRef, useState } from "react";

/** Mô tả dài thu lại còn vài dòng, có nút "Xem thêm" — chỉ hiện nút khi thật sự bị cắt. */
export function ExpandableText({ text, lines = 6 }: { text: string; lines?: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setClamped(el.scrollHeight > el.clientHeight + 2);
  }, [text, open]);

  return (
    <div>
      <p
        ref={ref}
        className="whitespace-pre-wrap text-[15px] leading-relaxed"
        style={
          open
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
      >
        {text}
      </p>
      {(clamped || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-sm font-medium text-primary hover:underline"
        >
          {open ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
    </div>
  );
}
