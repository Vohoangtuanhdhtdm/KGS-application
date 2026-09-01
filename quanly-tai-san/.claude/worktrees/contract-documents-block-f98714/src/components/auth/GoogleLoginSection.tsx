import { useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { ApiError } from "@/lib/auth/types";

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "";

/**
 * Divider "Hoặc" + nút Google full-width, dùng chung cho /login và /register.
 * Tự bọc GoogleOAuthProvider nên trang dùng không cần bọc lại.
 * Không cấu hình VITE_GOOGLE_CLIENT_ID → không render gì.
 */
export function GoogleLoginSection({ onSuccess }: { onSuccess: () => void }) {
  const { loginWithExternalProvider } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!CLIENT_ID) return null;

  const handleCredential = async (idToken: string | undefined) => {
    if (!idToken) {
      toast.error("Đăng nhập Google thất bại.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await loginWithExternalProvider("Google", idToken);
      toast.success("Đăng nhập thành công");
      onSuccess();
    } catch (err) {
      // 400 từ backend (VD: không lấy được email đã xác thực) → hiện rõ + gợi ý fallback
      const detail =
        err instanceof ApiError && err.detail ? err.detail : "Đăng nhập Google thất bại.";
      setError(`${detail} Bạn có thể thử đăng nhập bằng email/mật khẩu thay thế.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">Hoặc</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleOAuthProvider clientId={CLIENT_ID}>
        <div className="relative flex justify-center">
          <div className={`w-full [&>div]:!w-full ${busy ? "pointer-events-none opacity-60" : ""}`}>
            <GoogleLogin
              onSuccess={(cred) => handleCredential(cred.credential)}
              onError={() => toast.error("Đăng nhập Google thất bại.")}
              width="368"
              text="continue_with"
            />
          </div>
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>
      </GoogleOAuthProvider>
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
