import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Search, Megaphone, FileText, MoreHorizontal } from "lucide-react";
import { MoreSheet, type MoreItem } from "./MoreSheet";

interface TabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

/**
 * Điều hướng chính — nay xoay quanh MARKETPLACE, không phải quản lý tài sản.
 *
 * Trước Giai đoạn 1, bốn tab đầu là Vận hành / Hợp đồng / Thu chi / Nhắc lịch, tức là
 * cấu trúc điều hướng nói rằng sản phẩm này là một công cụ quản lý nội bộ. Với định vị
 * "nền tảng hỗ trợ tìm kiếm và kết nối bất động sản" thì bốn thứ đó thuộc Giai đoạn 4 và
 * lùi hết vào menu Thêm, dưới mục Quản lý tài sản.
 */
const TABS: TabConfig[] = [
  { id: "home", label: "Trang chủ", icon: Home, path: "/" },
  { id: "search", label: "Tìm kiếm", icon: Search, path: "/tin-dang" },
  { id: "post", label: "Đăng tin", icon: Megaphone, path: "/dang-tin" },
  { id: "mine", label: "Tin của tôi", icon: FileText, path: "/tin-cua-toi" },
  { id: "more", label: "Thêm", icon: MoreHorizontal, path: "__more__" },
];

export function BottomTabBar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [showMore, setShowMore] = useState(false);

  const isActive = (tab: TabConfig) => {
    if (tab.id === "more") return false;
    if (tab.path === "/") return pathname === "/";
    return pathname.startsWith(tab.path);
  };

  const handleTab = (tab: TabConfig) => {
    if (tab.id === "more") {
      setShowMore(true);
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
            </button>
          );
        })}
      </nav>

      {showMore && <MoreSheet onClose={() => setShowMore(false)} onPick={handleMorePick} />}
    </>
  );
}
