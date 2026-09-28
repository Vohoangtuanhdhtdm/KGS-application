import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, Calculator, FileText, Heart, Inbox, Plus, Search, User } from "lucide-react";
import { AccountSheet, type AccountItem } from "./AccountSheet";
import { useCurrentWorkspace } from "@/components/workspace/useCurrentWorkspace";
import type { Workspace } from "@/lib/workspace";

interface TabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

/**
 * Điều hướng chính trên điện thoại — MỖI KHÔNG GIAN MỘT BỘ TAB.
 *
 * Bố cục giữ nguyên từ bản trước: hai tab trái, nút hành động tròn ở giữa, hai tab phải
 * (tab cuối luôn là Tài khoản). Cái đổi là NỘI DUNG của bốn tab, theo không gian đang đứng:
 *
 * • **Tìm nhà**: Tìm nhà · Định giá · (+) · Đã lưu · Tài khoản. Tab "Trang chủ" nhường chỗ cho
 *   Định giá — logo ở header đã là lối về trang chủ, còn công cụ định giá thì trước đây
 *   hoàn toàn không có lối vào trên điện thoại. "Đã lưu" giữ nguyên vì đó là móc kéo người
 *   tìm nhà quay lại. Chỉ số giá nằm trong sheet Tài khoản, nhóm "Tra cứu thị trường".
 * • **Chủ nhà**: Tin của tôi · Người hỏi · (+) · Hiệu quả · Tài khoản — đúng ba việc chủ nhà
 *   làm hằng ngày.
 * • **Quản trị**: không có thanh đáy; AdminShell có dải điều hướng riêng.
 *
 * Màu tab đang chọn đi theo --primary, nên tự đổi theo màu của không gian.
 */
const TABS: Record<Exclude<Workspace, "admin">, { left: TabConfig[]; right: TabConfig[] }> = {
  seeker: {
    left: [
      { id: "search", label: "Tìm nhà", icon: Search, path: "/tin-dang" },
      { id: "valuation", label: "Định giá", icon: Calculator, path: "/dinh-gia" },
    ],
    right: [
      { id: "saved", label: "Đã lưu", icon: Heart, path: "/da-luu" },
      { id: "account", label: "Tài khoản", icon: User, path: "__account__" },
    ],
  },
  owner: {
    left: [
      { id: "mine", label: "Tin của tôi", icon: FileText, path: "/tin-cua-toi" },
      { id: "inquiries", label: "Người hỏi", icon: Inbox, path: "/yeu-cau" },
    ],
    right: [
      { id: "stats", label: "Hiệu quả", icon: BarChart3, path: "/thong-ke-tin" },
      { id: "account", label: "Tài khoản", icon: User, path: "__account__" },
    ],
  },
};

export function BottomTabBar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ws = useCurrentWorkspace();
  const [showAccount, setShowAccount] = useState(false);

  if (ws === "admin") return null;
  const { left, right } = TABS[ws];

  const isActive = (tab: TabConfig) => {
    if (tab.path.startsWith("__")) return false;
    return pathname === tab.path || pathname.startsWith(tab.path + "/");
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
    navigate({ to: item.path, search: item.search });
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
            ? "bg-primary text-primary-foreground"
            : "text-[#5A6B87] hover:bg-black/5 active:scale-95 dark:text-muted-foreground dark:hover:bg-white/10"
        }`}
      >
        <tab.icon className="h-5 w-5" />
        <span className="text-[10px] leading-none font-medium whitespace-nowrap">{tab.label}</span>
      </button>
    );
  };

  const postActive = pathname.startsWith("/dang-tin");

  return (
    <>
      <nav
        role="tablist"
        aria-label="Điều hướng chính"
        // md:hidden — trên desktop điều hướng nằm ở header.
        className="bottom-tabbar fixed bottom-5 left-1/2 z-[900] flex -translate-x-1/2 items-center gap-1 px-2 py-2 md:hidden"
      >
        {left.map(renderTab)}

        {/* Đăng tin là HÀNH ĐỘNG, không phải một nơi để tới — nên nó có hình dạng khác hẳn
            bốn tab kia. Ở không gian Tìm nhà, bấm nút này cũng là bước sang không gian Chủ
            nhà: màu cả trang đổi theo, người dùng thấy ngay mình vừa đổi vai. */}
        <button
          type="button"
          aria-label="Đăng tin"
          onClick={() => navigate({ to: "/dang-tin" })}
          className={`mx-0.5 flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200 ease-out hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95 ${
            postActive ? "ring-2 ring-primary/30 ring-offset-2" : ""
          }`}
        >
          <Plus className="h-6 w-6" />
        </button>

        {right.map(renderTab)}
      </nav>

      {showAccount && <AccountSheet onClose={() => setShowAccount(false)} onPick={handlePick} />}
    </>
  );
}
