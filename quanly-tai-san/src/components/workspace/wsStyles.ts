import { useAuth } from "@/lib/auth/AuthContext";
import type { Workspace } from "@/lib/workspace";

/** Lớp Tailwind theo không gian. Viết tường minh từng lớp (không ghép chuỗi động) để Tailwind
    quét thấy và sinh ra đủ CSS. */
export const WS_CLASS: Record<
  Workspace,
  { solid: string; soft: string; text: string; dot: string }
> = {
  seeker: {
    solid: "bg-ws-seeker text-ws-foreground",
    soft: "bg-ws-seeker-soft text-ws-seeker",
    text: "text-ws-seeker",
    dot: "bg-ws-seeker",
  },
  owner: {
    solid: "bg-ws-owner text-ws-foreground",
    soft: "bg-ws-owner-soft text-ws-owner",
    text: "text-ws-owner",
    dot: "bg-ws-owner",
  },
  admin: {
    solid: "bg-ws-admin text-ws-foreground",
    soft: "bg-ws-admin-soft text-ws-admin",
    text: "text-ws-admin",
    dot: "bg-ws-admin",
  },
};

/**
 * Những không gian người này được vào.
 *
 * Khách chưa đăng nhập chỉ có "Tìm nhà" — nên với họ không có công tắc nào để hiện. Không
 * gian Quản trị chỉ xuất hiện với tài khoản Admin; người thường không thấy cả sự tồn tại
 * của nó.
 */
export function useAvailableWorkspaces(): Workspace[] {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return ["seeker"];
  return isAdmin ? ["seeker", "owner", "admin"] : ["seeker", "owner"];
}
