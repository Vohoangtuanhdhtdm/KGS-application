import { useEffect, useState } from "react";

export type ViewportKind = "mobile" | "tablet" | "desktop";

function kindOf(width: number): ViewportKind {
  if (width < 768) return "mobile";
  if (width < 1280) return "tablet";
  return "desktop";
}

/**
 * Desktop (>=1280px) / Tablet (768-1279px) / Mobile (<768px) — quyết định NHÁNH layout
 * (bố cục khác hẳn nhau, không chỉ CSS breakpoint), nên cần biết ở JS.
 * Mặc định "desktop" lúc SSR/trước khi mount (an toàn, tránh truy cập window) — cập nhật đúng
 * ngay sau mount, chấp nhận 1 lần re-render nhẹ giống các app responsive JS-driven khác.
 */
export function useViewportKind(): ViewportKind {
  const [kind, setKind] = useState<ViewportKind>("desktop");

  useEffect(() => {
    const update = () => setKind(kindOf(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return kind;
}
