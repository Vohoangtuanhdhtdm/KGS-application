import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Map as MapIcon, FileText, Wallet, Bell, MoreHorizontal } from "lucide-react";
import { useReminderBadge } from "@/hooks/useReminderBadge";
import { MoreSheet, type MoreItem } from "./MoreSheet";

const MAP_PATH = "/ban-do";

interface TabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  /** Route thật của tính năng (dùng cho URL trực tiếp + tô active). */
  path: string;
  /** Khoá `?sheet=` khi mở đè lên bản đồ. Bỏ trống = điều hướng thật. */
  sheetKey?: string;
}

const TABS: TabConfig[] = [
  { id: "map", label: "Bản đồ", icon: MapIcon, path: MAP_PATH },
  { id: "contracts", label: "Hợp đồng", icon: FileText, path: "/hop-dong", sheetKey: "hop-dong" },
  { id: "finance", label: "Thu chi", icon: Wallet, path: "/thu-chi", sheetKey: "thu-chi" },
  { id: "reminders", label: "Nhắc lịch", icon: Bell, path: "/nhac-lich", sheetKey: "nhac-lich" },
  { id: "more", label: "Thêm", icon: MoreHorizontal, path: "__more__" },
];

/**
 * Thanh tab nổi đáy — hệ điều hướng DUY NHẤT của app (đã thay hẳn icon rail).
 *
 * Tính năng phụ mở dạng sheet đè lên bản đồ bằng search param `?sheet=` trên chính route
 * /ban-do, thay vì pattern `backgroundLocation` của React Router (dự án dùng TanStack
 * Router, không có API đó). Cách này giữ đúng 3 điều quan trọng: URL đổi và chia sẻ được,
 * nút Back đóng sheet, và bản đồ KHÔNG bị unmount nên giữ nguyên vị trí/zoom.
 */
export function BottomTabBar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search }) as { sheet?: string };
  const [showMore, setShowMore] = useState(false);
  const reminderBadge = useReminderBadge();

  const onMap = pathname === MAP_PATH || pathname === MAP_PATH + "/";
  const openSheet = onMap ? search?.sheet : undefined;

  const isActive = (tab: TabConfig) => {
    if (tab.id === "more") return false;
    if (tab.sheetKey) return openSheet === tab.sheetKey || pathname.startsWith(tab.path);
    // Tab "Bản đồ" chỉ sáng khi đang ở bản đồ và KHÔNG có sheet nào đè lên
    return onMap && !openSheet;
  };

  const handleTab = (tab: TabConfig) => {
    if (tab.id === "more") {
      setShowMore(true);
      return;
    }
    if (!tab.sheetKey) {
      // Về hẳn bản đồ, đóng mọi sheet đang mở
      navigate({ to: MAP_PATH, search: {} });
      return;
    }
    if (onMap) {
      // Đè sheet lên bản đồ đang có sẵn — không unmount bản đồ
      navigate({ to: MAP_PATH, search: { sheet: tab.sheetKey } });
    } else {
      // Không có bản đồ nền phía sau → mở trang đầy đủ như bình thường
      navigate({ to: tab.path });
    }
  };

  const handleMorePick = (item: MoreItem) => {
    setShowMore(false);
    if (item.external) {
      window.open(item.path, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.sheetKey && onMap) {
      navigate({ to: MAP_PATH, search: { sheet: item.sheetKey } });
      return;
    }
    navigate({ to: item.path });
  };

  return (
    <>
      <nav
        role="tablist"
        aria-label="Điều hướng chính"
        className="bottom-tabbar fixed bottom-5 left-1/2 z-[900] flex -translate-x-1/2 items-center gap-1 px-2 py-2"
      >
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={tab.label}
              onClick={() => handleTab(tab)}
              className={`relative flex h-14 w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[20px] transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                active
                  ? "bg-[#1E2761] text-white"
                  : "text-[#5A6B87] hover:bg-black/5 active:scale-95 dark:text-muted-foreground dark:hover:bg-white/10"
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] leading-none font-medium">{tab.label}</span>
              {tab.id === "reminders" && reminderBadge > 0 && (
                <span className="absolute top-1 right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F2A93B] px-1 text-[9px] leading-none font-bold text-white">
                  {reminderBadge > 9 ? "9+" : reminderBadge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {showMore && <MoreSheet onClose={() => setShowMore(false)} onPick={handleMorePick} />}
    </>
  );
}
