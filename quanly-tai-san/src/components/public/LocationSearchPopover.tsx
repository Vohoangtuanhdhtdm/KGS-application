import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocateFixed, Loader2, X } from "lucide-react";

// Rộng bằng đúng w-64 (16rem) của popover cũ — dùng để tự căn lại khi gần mép phải viewport.
const POPOVER_WIDTH = 256;
const VIEWPORT_MARGIN = 12;

interface LocationSearchPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usingMyLocation: boolean;
  myLocationRadiusKm: number;
  radiusInput: string;
  onRadiusInputChange: (v: string) => void;
  pending: boolean;
  onSubmit: () => void;
  onClear: () => void;
}

/**
 * Render bằng createPortal thẳng vào document.body, định vị bằng toạ độ tuyệt đối
 * (getBoundingClientRect của nút) thay vì Radix Popover — vì Radix Popover tuy cũng
 * portal ra ngoài nhưng z-index chỉ 50, trong khi các pane của Leaflet (marker/tooltip/
 * popup...) dùng z-index 400-700 và không nằm trong stacking context riêng nào (container
 * Leaflet chỉ có position:relative, không set z-index → không tạo stacking context mới),
 * nên panes của map đè lên popover bất cứ khi nào 2 vùng đó chồng lên nhau trên màn hình.
 * z-index 1000 ở đây luôn cao hơn mức cao nhất Leaflet dùng (700).
 */
export function LocationSearchPopover({
  open,
  onOpenChange,
  usingMyLocation,
  myLocationRadiusKm,
  radiusInput,
  onRadiusInputChange,
  pending,
  onSubmit,
  onClear,
}: LocationSearchPopoverProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const computePosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    let left = rect.left;
    // Popover sẽ tràn mép phải viewport → căn theo mép phải nút thay vì mép trái
    if (left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
      left = Math.max(VIEWPORT_MARGIN, rect.right - POPOVER_WIDTH);
    }
    setCoords({ top: rect.bottom + 8, left });
  };

  useLayoutEffect(() => {
    if (open) computePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleReposition = () => computePosition();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        ref={buttonRef}
        size="sm"
        variant={usingMyLocation ? "secondary" : "outline"}
        className="h-8"
        onClick={() => onOpenChange(!open)}
      >
        <LocateFixed className="h-3.5 w-3.5 mr-1.5" />
        {usingMyLocation
          ? `Đang tìm quanh vị trí của bạn (${myLocationRadiusKm}km)`
          : "Tìm quanh vị trí hiện tại của tôi"}
      </Button>
      {usingMyLocation && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label="Xoá bộ lọc vị trí"
          onClick={onClear}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: POPOVER_WIDTH,
              zIndex: 1000,
            }}
            className="rounded-md border bg-popover p-4 text-popover-foreground shadow-md space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <LocateFixed className="h-4 w-4" />
              Tìm quanh vị trí hiện tại
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Trong bán kính (km)</Label>
              <Input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={radiusInput}
                onChange={(e) => onRadiusInputChange(e.target.value)}
                autoFocus
              />
            </div>
            {pending && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Đang xin quyền vị trí...
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button size="sm" onClick={onSubmit} disabled={pending}>
                Tìm kiếm
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
