import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface SectionLink {
  id: string;
  label: string;
}

/**
 * Thanh mục dính ở đầu trang chi tiết: nhảy thẳng tới Chi phí, Tiện nghi, Vị trí… thay vì
 * cuộn qua cả trang. Mục đang xem được tô đậm (IntersectionObserver), nên nó cũng là chỉ
 * báo "mình đang ở đâu" trên một trang dài.
 */
export function SectionNav({ sections }: { sections: SectionLink[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((e): e is HTMLElement => e !== null);
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Coi một mục là "đang xem" khi nó chiếm dải giữa phía trên màn hình.
      { rootMargin: "-120px 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Các mục của tin"
      className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 backdrop-blur lg:mx-0 lg:px-0"
    >
      <ul className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById(s.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActive(s.id);
              }}
              className={cn(
                "inline-block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
                active === s.id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
