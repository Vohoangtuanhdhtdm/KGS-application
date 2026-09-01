import { useEffect, useState } from "react";

/**
 * Theo dõi một media query ở phía JS.
 *
 * Dùng khi hành vi JS phải khớp CHÍNH XÁC với một breakpoint CSS đang dùng trong markup —
 * `useViewportKind` có ngưỡng riêng (768/1280) nên không thay thế được: lệch ngưỡng sẽ tạo
 * ra dải màn hình mà CSS và JS hiểu khác nhau.
 *
 * Trả `false` lúc SSR và ở lần render đầu để server và client khớp nhau, rồi cập nhật ngay
 * sau khi mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}
