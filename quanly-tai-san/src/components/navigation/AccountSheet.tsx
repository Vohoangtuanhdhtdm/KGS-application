import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  FileText,
  Flag,
  Inbox,
  LogIn,
  BarChart3,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { ENABLE_ASSET_MANAGEMENT } from "@/lib/features";

export interface AccountItem {
  label: string;
  icon: React.ElementType;
  path: string;
  external?: boolean;
}

interface Group {
  title: string;
  items: AccountItem[];
}

/**
 * Sheet tài khoản — thay cho menu "Thêm" cũ.
 *
 * Menu cũ là một lưới phẳng bốn ô trộn lẫn ba nhóm việc hoàn toàn khác nhau: thứ của người
 * đi tìm nhà (tin đã lưu), thứ của người đăng tin (quản lý tài sản), và thứ của quản trị
 * viên. Một lưới phẳng buộc người dùng phải đọc hết mọi nhãn mới tìm được cái mình cần, và
 * nó không nói gì về việc mục nào dành cho ai.
 *
 * Chia nhóm theo VAI TRÒ, và mỗi nhóm chỉ hiện khi người đó thật sự có vai trò đó.
 */
export function AccountSheet({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (item: AccountItem) => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const swipe = useSwipeToClose(onClose);
  const { isAdmin, isAuthenticated } = useAuth();

  const groups: Group[] = [];

  if (isAuthenticated) {
    groups.push({
      title: "Tìm nhà",
      items: [{ label: "Yêu cầu đã gửi", icon: Inbox, path: "/yeu-cau" }],
    });

    groups.push({
      title: "Cho thuê / bán",
      items: [
        { label: "Tin của tôi", icon: FileText, path: "/tin-cua-toi" },
        { label: "Thống kê tin", icon: BarChart3, path: "/thong-ke-tin" },
      ],
    });

    // Khu quản lý tài sản thuộc Giai đoạn 4. Ẩn mặc định để người thử sản phẩm ở Giai đoạn 1
    // không gặp một menu trộn lẫn hai sản phẩm khác nhau — xem lib/features.ts.
    if (ENABLE_ASSET_MANAGEMENT) {
      groups[groups.length - 1].items.push({
        label: "Quản lý tài sản",
        icon: Building2,
        path: "/quan-ly",
      });
    }
  }

  if (isAdmin) {
    groups.push({
      title: "Quản trị",
      items: [
        { label: "Duyệt tin đăng", icon: ShieldCheck, path: "/admin/listings" },
        { label: "Báo vi phạm", icon: Flag, path: "/admin/reports" },
      ],
    });
  }

  groups.push({
    title: "Tài khoản",
    items: isAuthenticated
      ? [{ label: "Hồ sơ cá nhân", icon: User, path: "/profile" }]
      : [{ label: "Đăng nhập / Đăng ký", icon: LogIn, path: "/login" }],
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[950] flex items-end justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        ref={trapRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Tài khoản"
        className="animate-slide-up sheet-draggable mx-4 mb-24 w-full max-w-md rounded-3xl bg-background px-5 pt-1 pb-5 shadow-2xl"
        style={swipe.sheetProps.style}
      >
        <div className="sheet-grab-area -mx-5 px-5 pb-1" {...swipe.handleProps}>
          <div className="sheet-grabber" aria-hidden="true" />
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Tài khoản</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.title}
              </p>
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onPick(item)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
