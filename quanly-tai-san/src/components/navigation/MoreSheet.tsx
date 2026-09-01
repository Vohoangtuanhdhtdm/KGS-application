import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, Tag, Megaphone, Globe, X, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";

export interface MoreItem {
  label: string;
  icon: React.ElementType;
  /** Khoá sheet (mở đè lên bản đồ) — bỏ trống nếu là link ngoài/route thật. */
  sheetKey?: string;
  path: string;
  external?: boolean;
}

const BASE_ITEMS: MoreItem[] = [
  { label: "Sổ đối tác", icon: Users, sheetKey: "doi-tac", path: "/doi-tac" },
  { label: "Rao bán", icon: Tag, sheetKey: "rao-ban", path: "/rao-ban" },
  { label: "Tin đăng của tôi", icon: Megaphone, sheetKey: "my-listings", path: "/my-listings" },
  { label: "Marketplace", icon: Globe, path: "/tin-dang", external: true },
];

export interface MoreSheetProps {
  onClose: () => void;
  onPick: (item: MoreItem) => void;
}

export function MoreSheet({ onClose, onPick }: MoreSheetProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  // Sheet này neo đáy màn hình ở mọi kích thước nên vuốt xuống luôn có nghĩa
  const swipe = useSwipeToClose(onClose);
  const { isAdmin } = useAuth();
  const items = isAdmin
    ? [
        ...BASE_ITEMS,
        { label: "Duyệt tin đăng", icon: ShieldCheck, path: "/admin/properties" } as MoreItem,
      ]
    : BASE_ITEMS;

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
        aria-label="Thêm"
        className="animate-slide-up sheet-draggable mx-4 mb-28 w-full max-w-md rounded-3xl bg-background px-5 pt-1 pb-5 shadow-2xl"
        style={swipe.sheetProps.style}
      >
        {/* Tay cầm tách riêng khỏi header vì header chứa nút Đóng — pointer capture ở
            header sẽ nuốt mất click của nút. */}
        <div className="sheet-grab-area -mx-5 px-5 pb-1" {...swipe.handleProps}>
          <div className="sheet-grabber" aria-hidden="true" />
        </div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Thêm</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onPick(item)}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-[#1E2761] dark:text-foreground">
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-center text-xs leading-tight text-muted-foreground">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
