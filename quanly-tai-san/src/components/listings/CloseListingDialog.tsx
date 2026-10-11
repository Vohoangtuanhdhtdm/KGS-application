import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OWNER_CLOSE_REASONS, type ListingCloseReasonCode } from "@/constants/enums";

/**
 * Đóng tin kèm lý do. Lý do là điểm cuối của chuỗi kết nối: chỉ nhờ nó hệ thống mới biết tin
 * đóng vì đã có khách nhờ KGS hay vì lý do khác — thứ số lượt xem không bao giờ nói được.
 * Bắt buộc chọn, nhưng chỉ một cú bấm.
 */
export function CloseListingDialog({
  title,
  open,
  busy,
  onOpenChange,
  onConfirm,
}: {
  title: string | null;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: ListingCloseReasonCode) => void;
}) {
  const [reason, setReason] = useState<ListingCloseReasonCode | null>(null);
  useEffect(() => {
    if (open) setReason(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Đóng tin</DialogTitle>
          <DialogDescription>
            {title ? <>“{title}” sẽ rời trang tìm kiếm. </> : null}
            Vì sao bạn đóng tin? Câu trả lời giúp KGS biết nền tảng có thật sự giúp bạn tìm được
            khách.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Lý do đóng tin" className="space-y-2">
          {OWNER_CLOSE_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={reason === r.value}
              onClick={() => setReason(r.value)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                reason === r.value ? "border-primary bg-primary/5" : "hover:bg-accent"
              }`}
            >
              <span className="block text-sm font-medium">{r.label}</span>
              <span className="block text-xs text-muted-foreground">{r.hint}</span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button disabled={reason == null || busy} onClick={() => reason && onConfirm(reason)}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Đóng tin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
