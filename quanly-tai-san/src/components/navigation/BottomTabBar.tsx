import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Heart, Home, Plus, Search, User } from "lucide-react";
import { AccountSheet, type AccountItem } from "./AccountSheet";

interface TabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

/**
 * Điều hướng chính.
 *
 * Bản trước là: Trang chủ · Tìm kiếm · Đăng tin · Tin của tôi · Thêm. Ba vấn đề:
 *
 * 1. **Hai trong năm tab phục vụ người ĐĂNG tin** (Đăng tin, Tin của tôi), trong khi phần
 *    lớn lượt truy cập là người ĐI TÌM nhà. Nhóm đông nhất bị chia đúng hai tab, mà hai tab
 *    đó lại gần trùng nhau về mục đích.
 *
 * 2. **"Tin đã lưu" và "Yêu cầu xem nhà" bị chôn dưới menu Thêm.** Đó chính là hai thứ kéo
 *    người tìm nhà QUAY LẠI — người ta hiếm khi tìm được nhà trong một buổi. Giấu đúng hai
 *    móc giữ chân vào menu phụ là làm ngược.
 *
 * 3. **"Đăng tin" trông giống hệt bốn tab còn lại** dù nó là hành động chính, không phải
 *    một nơi để tới.
 *
 * Bản này: hai tab cho việc TÌM (trang chủ, tìm kiếm), một nút hành động nổi ở giữa cho
 * việc ĐĂNG, một tab cho móc quay lại (đã lưu), một tab tài khoản gom mọi thứ còn lại theo
 * nhóm vai trò. "Tin của tôi" và "Thống kê" chuyển vào Tài khoản — đúng chỗ người đăng tin
 * tìm chúng, và không chiếm chỗ của nhóm đông hơn.
 */
const LEFT_TABS: TabConfig[] = [
  { id: "home", label: "Trang chủ", icon: Home, path: "/" },
  { id: "search", label: "Tìm kiếm", icon: Search, path: "/tin-dang" },
];

const RIGHT_TABS: TabConfig[] = [
  { id: "saved", label: "Đã lưu", icon: Heart, path: "/da-luu" },
  { id: "account", label: "Tài khoản", icon: User, path: "__account__" },
];

export function BottomTabBar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [showAccount, setShowAccount] = useState(false);

  const isActive = (tab: TabConfig) => {
    if (tab.path.startsWith("__")) return false;
    if (tab.path === "/") return pathname === "/";
    return pathname.startsWith(tab.path);
  };

  const handleTab = (tab: TabConfig) => {
    if (tab.path === "__account__") {
      setShowAccount(true);
      return;
    }
    navigate({ to: tab.path });
  };

  const handlePick = (item: AccountItem) => {
    setShowAccount(false);
    if (item.external) {
      window.open(item.path, "_blank", "noopener,noreferrer");
      return;
    }
    navigate({ to: item.path });
  };

  const renderTab = (tab: TabConfig) => {
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
  };

  const postActive = pathname.startsWith("/dang-tin");

  return (
    <>
      <nav
        role="tablist"
        aria-label="Điều hướng chính"
        className="bottom-tabbar fixed bottom-5 left-1/2 z-[900] flex -translate-x-1/2 items-center gap-1 px-2 py-2"
      >
        {LEFT_TABS.map(renderTab)}

        {/* Đăng tin là HÀNH ĐỘNG, không phải một nơi để tới — nên nó có hình dạng khác hẳn
            bốn tab kia. Người dùng nhận ra nút hành động chính mà không cần đọc nhãn. */}
        <button
          type="button"
          aria-label="Đăng tin"
          onClick={() => navigate({ to: "/dang-tin" })}
          className={`mx-0.5 flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-lg transition-all duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 ${
            postActive
              ? "bg-[#1E2761] text-white ring-2 ring-[#1E2761]/30"
              : "bg-primary text-primary-foreground hover:brightness-110"
          }`}
        >
          <Plus className="h-6 w-6" />
        </button>

        {RIGHT_TABS.map(renderTab)}
      </nav>

      {showAccount && (
        <AccountSheet onClose={() => setShowAccount(false)} onPick={handlePick} />
      )}
    </>
  );
}
