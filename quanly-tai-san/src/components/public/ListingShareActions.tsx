import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flag, Loader2, Share2 } from "lucide-react";
import { listingsApi, REPORT_REASON, type ReportReasonCode } from "@/lib/api/listings";
import { getErrorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/** Chia sẻ và báo vi phạm — hai hành động phụ, đặt cạnh nhau dưới tiêu đề tin. */
export function ListingShareActions({ slug, title }: { slug: string; title: string }) {
  return (
    <div className="flex items-center gap-1">
      <ShareButton title={title} />
      <ReportButton slug={slug} />
    </div>
  );
}

function ShareButton({ title }: { title: string }) {
  const share = async () => {
    // Trên máy tính thì chỉ có ô địa chỉ để copy; trên điện thoại thì bảng chia sẻ của hệ
    // điều hành mở thẳng ra Zalo/Messenger — nơi tin nhà đất thật sự được chuyền tay nhau
    // ở Việt Nam. Web Share API không có ở mọi trình duyệt nên vẫn phải có đường lui.
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        // Người dùng đóng bảng chia sẻ — không phải lỗi, đừng làm phiền họ bằng toast.
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Thất bại vì lý do khác thì rơi xuống nhánh copy bên dưới.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Đã sao chép liên kết tin đăng");
    } catch {
      toast.error("Không sao chép được — hãy copy từ thanh địa chỉ.");
    }
  };

  return (
    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={share}>
      <Share2 className="h-4 w-4" />
      Chia sẻ
    </Button>
  );
}

function ReportButton({ slug }: { slug: string }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReasonCode>(2);
  const [detail, setDetail] = useState("");

  const report = useMutation({
    mutationFn: () => listingsApi.report(slug, reason, detail.trim() || null),
    onSuccess: () => {
      setOpen(false);
      setDetail("");
      toast.success("Đã gửi phản ánh. Bộ phận kiểm duyệt sẽ xem lại tin này.");
    },
    onError: (e) => toast.error(getErrorMessage(e, "Không gửi được phản ánh")),
  });

  const openDialog = () => {
    if (!isAuthenticated) {
      toast.info("Đăng nhập để gửi phản ánh về tin đăng này.");
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={openDialog}
      >
        <Flag className="h-4 w-4" />
        Báo tin sai
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Báo tin đăng có vấn đề</DialogTitle>
            <DialogDescription>
              Chọn lý do sát nhất. Phản ánh của bạn giúp gỡ những tin đã cho thuê rồi hoặc
              sai sự thật khỏi kết quả tìm kiếm của người khác.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup
              value={String(reason)}
              onValueChange={(v) => setReason(Number(v) as ReportReasonCode)}
              className="gap-2"
            >
              {(Object.keys(REPORT_REASON) as unknown as ReportReasonCode[])
                .map(Number)
                .map((code) => (
                  <div key={code} className="flex items-center gap-2">
                    <RadioGroupItem value={String(code)} id={`reason-${code}`} />
                    <Label htmlFor={`reason-${code}`} className="font-normal cursor-pointer">
                      {REPORT_REASON[code as ReportReasonCode]}
                    </Label>
                  </div>
                ))}
            </RadioGroup>

            <div className="space-y-1.5">
              <Label htmlFor="report-detail">Mô tả thêm (không bắt buộc)</Label>
              <Textarea
                id="report-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Ví dụ: gọi hỏi thì chủ nhà nói phòng đã cho thuê từ tháng trước."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button disabled={report.isPending} onClick={() => report.mutate()}>
              {report.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Gửi phản ánh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
