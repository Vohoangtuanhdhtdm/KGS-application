import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const searchSchema = z.object({ userId: z.string().optional(), token: z.string().optional() });

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Đặt lại mật khẩu — Quản Lý Tài Sản" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { userId, token } = useSearch({ from: "/reset-password" });
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = !userId || !token;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Mật khẩu tối thiểu 8 ký tự.");
    if (password !== confirm) return setError("Xác nhận mật khẩu không khớp.");
    setBusy(true);
    try {
      await api("/account/reset-password", {
        method: "POST",
        body: { userId, token, newPassword: password },
        skipAuth: true,
      });
      toast.success("Đặt lại mật khẩu thành công. Vui lòng đăng nhập.");
      navigate({ to: "/login", replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Không đặt lại được mật khẩu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Đặt lại mật khẩu</CardTitle>
        </CardHeader>
        <CardContent>
          {missing ? (
            <div className="space-y-3">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                Liên kết không hợp lệ hoặc thiếu tham số. Vui lòng yêu cầu lại email đặt lại mật khẩu.
              </div>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">Yêu cầu lại</Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Mật khẩu mới</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Xác nhận mật khẩu mới</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} />
              </div>
              {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Đặt lại mật khẩu
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
