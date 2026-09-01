// Bottom sheet danh sách cho Mobile (<768px) — dùng thẳng `vaul` (đã có sẵn trong package.json,
// là thư viện đứng sau components/ui/drawer.tsx) thay vì component Drawer chung của shadcn, vì
// Drawer generic có overlay tối che nền (dùng cho dialog) — ở đây cần sheet LUÔN hiện, không che
// bản đồ phía sau, user vẫn thao tác map được ngay cả khi sheet đang mở (modal={false}).
import { Drawer } from "vaul";
import type { ReactNode } from "react";

// 3 mức: peek (chỉ thanh kéo + tổng số) / half (~50%, xem 2-3 card) / full (~90%, toàn danh sách)
const SNAP_POINTS: (number | string)[] = ["80px", 0.5, 0.92];

interface MobileListSheetProps {
  totalCount: number;
  activeSnap: number | string | null;
  onActiveSnapChange: (snap: number | string | null) => void;
  children: ReactNode;
}

export function MobileListSheet({
  totalCount,
  activeSnap,
  onActiveSnapChange,
  children,
}: MobileListSheetProps) {
  return (
    <Drawer.Root
      open
      dismissible={false}
      modal={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={activeSnap}
      setActiveSnapPoint={onActiveSnapChange}
    >
      <Drawer.Portal>
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-40 flex h-[92vh] flex-col rounded-t-2xl border bg-background shadow-[0_-4px_16px_rgba(0,0,0,0.12)] outline-none">
          <Drawer.Title className="sr-only">Danh sách bất động sản</Drawer.Title>
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <div className="px-4 pt-2 pb-1 text-sm font-medium shrink-0">
            {totalCount} bất động sản
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
