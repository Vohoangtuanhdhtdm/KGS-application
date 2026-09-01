import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useSwipeToClose } from "@/hooks/useSwipeToClose";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export interface FeatureSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Wrapper chung cho mọi tính năng phụ mở dạng sheet đè lên bản đồ. */
export function FeatureSheet({ title, onClose, children }: FeatureSheetProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  // Từ `sm:` trở lên sheet nằm giữa màn hình, kéo xuống để đóng là cử chỉ vô nghĩa.
  // Phải bám đúng 640px của Tailwind `sm:` bên dưới, không dùng ngưỡng 768px của
  // useViewportKind — lệch ngưỡng thì dải 640–767px sẽ có tay cầm kéo trên sheet đã ở giữa.
  const isBottomSheet = useMediaQuery("(max-width: 639.98px)");
  const swipe = useSwipeToClose(onClose, isBottomSheet);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Khoá cuộn nền trong lúc sheet mở
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[920] flex items-end justify-center bg-black/35 backdrop-blur-sm sm:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        ref={trapRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-slide-up sm:animate-scale-in sheet-draggable flex h-[88vh] w-full flex-col rounded-t-[28px] bg-background shadow-2xl sm:h-[80vh] sm:max-w-3xl sm:rounded-[28px]"
        style={swipe.sheetProps.style}
      >
        {/* Tay cầm chỉ là dải này, KHÔNG phải cả header: header chứa nút Đóng, mà
            setPointerCapture ở header sẽ nuốt luôn click của nút đó. */}
        {isBottomSheet && (
          <div className="sheet-grab-area shrink-0 pb-2" {...swipe.handleProps}>
            <div className="sheet-grabber" aria-hidden="true" />
          </div>
        )}
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
