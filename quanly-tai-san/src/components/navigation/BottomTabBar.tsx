import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Wallet, Bell, MoreHorizontal } from "lucide-react";
import { useReminderBadge } from "@/hooks/useReminderBadge";
import { MoreSheet, type MoreItem } from "./MoreSheet";

const HOME_PATH = "/";

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
  { id: "home", label: "Vận hành", icon: LayoutDashboard, path: HOME_PATH },
  { id: "hop-dong", label: "Hợp đồng", icon: FileText, path: "/hop-dong", sheetKey: "hop-dong" },
  { id: "thu-chi", label: "Thu chi", icon: Wallet, path: "/thu-chi", sheetKey: "thu-chi" },
  { id: "nhac-lich", label: "Nhắc lịch", icon: Bell, path: "/nhac-lich", sheetKey: "nhac-lich" },
  { id: "more", label: "Thêm", icon: MoreHorizontal, path: "__more__" },
];

/**
 * Thanh tab nổi đáy — hệ điều hướng DUY NHẤT của app.
 *
 * Tab đầu nay là Bàn vận hành chứ không phải Bản đồ. Trước đây mọi tính năng quản lý mở
 * dạng sheet ĐÈ LÊN bản đồ qua `?sheet=`, tức là cấu trúc điều hướng ngầm nói rằng bản đồ
 * là sản phẩm còn hợp đồng với dòng tiền là phụ lục. Nay các tab điều hướng thẳng tới route
 * thật của chúng.
 *
 * Cơ chế `?sheet=` vẫn còn nguyên và vẫn dùng được KHI ĐANG Ở /ban-do — nó giữ bản đồ không
 * bị unmount nên không mất vị trí/zoom. Chỉ thôi làm khung xương chính của app.
 */
export function BottomTabBar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search }) as { sheet?: string };
  const [showMore, setShowMore] = useState(false);
  const reminderBadge = useReminderBadge();

  const onMap = pathname === "/ban-do" || pathname === "/ban-do/";
  const openSheet = onMap ? search?.sheet : undefined;

  const isActive = (tab: TabConfig) => {
    if (tab.id === "more") return false;
    if (tab.id === "home") return pathname === "/" ;
    return openSheet === tab.id || pathname.startsWith(tab.path);
  };

  const handleTab = (tab: TabConfig) => {
    if (tab.id === "more") {
      setShowMore(true);
      return;
    }
    // Đang đứng trên bản đồ thì mở dạng sheet để không mất vị trí/zoom; ngoài ra
    // điều hướng thẳng tới route thật.
    if (onMap && tab.sheetKey) {
      navigate({ to: "/ban-do", search: { sheet: tab.sheetKey } });
      return;
    }
    navigate({ to: tab.path });
  };

  const handleMorePick = (item: MoreItem) => {
    setShowMore(false);
    if (item.external) {
      window.open(item.path, "_blank", "noopener,noreferrer");
      return;
    }
    if (item.sheetKey && onMap) {
      navigate({ to: "/ban-do", search: { sheet: item.sheetKey } });
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
              {tab.id === "nhac-lich" && reminderBadge > 0 && (
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
