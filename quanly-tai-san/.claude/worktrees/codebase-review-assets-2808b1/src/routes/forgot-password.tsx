import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth/api";
import { ApiError } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Quên mật khẩu — Quản Lý Tài Sản" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/account/forgot-password", { method: "POST", body: { email }, skipAuth: true });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Không gửi được yêu cầu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Quên mật khẩu</CardTitle>
          <p className="text-sm text-muted-foreground">Nhập email để nhận hướng dẫn đặt lại mật khẩu.</p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
                Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.
              </div>
              <Link to="/login" className="text-sm text-primary hover:underline">← Về trang đăng nhập</Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
              </div>
              {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gửi yêu cầu
              </Button>
              <div className="text-center text-sm">
                <Link to="/login" className="text-primary hover:underline">← Về trang đăng nhập</Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
