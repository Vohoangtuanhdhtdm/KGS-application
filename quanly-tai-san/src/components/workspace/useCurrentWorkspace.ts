import { useRouterState } from "@tanstack/react-router";
import { resolveWorkspace, type Workspace } from "@/lib/workspace";

/**
 * Không gian của trang đang mở.
 *
 * Tính ngay trong `select` để trả về một chuỗi: select trả về object mới ở mỗi lần router đổi
 * trạng thái sẽ khiến mọi component dùng hook này vẽ lại theo từng lần di chuột qua link.
 */
export function useCurrentWorkspace(): Workspace {
  return useRouterState({
    select: (s) =>
      resolveWorkspace(
        s.location.pathname,
        (s.location.search as Record<string, unknown> | undefined)?.tab as string | undefined,
      ),
  });
}
