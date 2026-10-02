import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Calculator, Handshake, Heart, Inbox, LineChart, LogIn, User, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { WORKSPACES } from "@/lib/workspace";
import { WS_CLASS, useAvailableWorkspaces } from "@/components/workspace/wsStyles";
import { useCurrentWorkspace } from "@/components/workspace/useCurrentWorkspace";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";

export interface AccountItem {
  label: string;
  icon: React.ElementType;
  path: string;
  search?: Record<string, string>;
  external?: boolean;
}

interface Group {
  title: string;
  items: AccountItem[];
}

/**
 * Sheet tài khoản trên điện thoại.
 *
 * Bản trước chia nhóm theo vai trò nhưng trộn chung trong một danh sách: "Duyệt tin đăng"
 * nằm ngay dưới "Tin của tôi", cùng một kiểu hàng, cùng một màu. Giờ đầu sheet là khối
 * CHUYỂN KHÔNG GIAN — mỗi không gian một ô màu riêng, ô đang đứng được đánh dấu — còn phía
 * dưới chỉ là những thứ dùng chung ở mọi không gian: tra cứu thị trường và tài khoản.
 * Việc riêng của từng không gian (tin của tôi, duyệt tin...) nằm trong chính không gian đó.
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
  const { isAuthenticated } = useAuth();
  const current = useCurrentWorkspace();
  const spaces = useAvailableWorkspaces();

  const groups: Group[] = [];

  // Khách cũng dùng được hai công cụ này — trang định giá và chỉ số giá đều công khai.
  groups.push({
    title: "Tra cứu thị trường",
    items: [
      { label: "Định giá bất động sản", icon: Calculator, path: "/dinh-gia" },
      { label: "Chỉ số giá theo tuần", icon: LineChart, path: "/chi-so-gia" },
    ],
  });

  if (isAuthenticated && current === "seeker") {
    groups.push({
      title: "Tìm nhà",
      items: [
        { label: "Tin đã lưu", icon: Heart, path: "/da-luu" },
        { label: "Yêu cầu xem nhà đã gửi", icon: Inbox, path: "/yeu-cau", search: { tab: "sent" } },
        { label: "Lời mời xem nhà", icon: Handshake, path: "/yeu-cau", search: { tab: "invites" } },
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

        {/* Khối chuyển không gian — chỉ hiện khi có ít nhất hai không gian để chọn. */}
        {spaces.length > 1 && (
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Không gian
            </p>
            <div className={`grid gap-2 ${spaces.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {spaces.map((id) => {
                const ws = WORKSPACES[id];
                const Icon = ws.icon;
                const here = id === current;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={here}
                    onClick={() => onPick({ label: ws.label, icon: Icon, path: ws.home })}
                    className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                      here ? `${WS_CLASS[id].soft} border-transparent` : "hover:bg-accent"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${WS_CLASS[id].solid}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {ws.label}
                    {here && <span className="sr-only">(đang ở đây)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
