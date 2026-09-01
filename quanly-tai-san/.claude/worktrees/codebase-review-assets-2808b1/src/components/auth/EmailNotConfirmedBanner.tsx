import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthContext";
import { api } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";

export function EmailNotConfirmedBanner() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  if (!user || user.emailConfirmed) return null;

  const resend = async () => {
    setSending(true);
    try {
      await api("/account/resend-confirmation", { method: "POST", body: { email: user.email }, skipAuth: true });
      toast.success("Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.detail : "Không gửi được email xác thực.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-b border-warning/40 bg-warning/15 px-4 py-2 text-sm text-warning-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <span>Email của bạn chưa được xác thực.</span>
        <Button size="sm" variant="outline" onClick={resend} disabled={sending}>
          {sending ? "Đang gửi..." : "Gửi lại email xác thực"}
        </Button>
      </div>
    </div>
  );
}
