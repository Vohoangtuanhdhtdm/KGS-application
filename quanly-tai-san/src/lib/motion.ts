/** Người dùng có bật "giảm chuyển động" ở hệ điều hành hay không. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
