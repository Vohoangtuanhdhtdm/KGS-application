// Nguồn dùng chung cho danh sách route công khai (không cần đăng nhập).
// Dùng ở __root.tsx (quyết định layout) VÀ lib/auth/api.ts (chặn redirect /login
// khỏi các trang công khai khi phiên hết hạn) — một nguồn duy nhất, tránh lệch nhau.
export const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/confirm-email",
  "/403",
  "/tin-dang",
];

export function isPublicPath(p: string): boolean {
  return PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(x + "/"));
}
