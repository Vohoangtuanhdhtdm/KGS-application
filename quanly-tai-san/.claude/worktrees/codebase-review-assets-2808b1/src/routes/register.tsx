import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Building, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { ApiError } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GoogleLoginSection } from "@/components/auth/GoogleLoginSection";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Đăng ký — Quản Lý Tài Sản" }] }),
  component: RegisterPage,
});

function passwordStrength(p: string): { score: number; label: string; tone: string } {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const labels = ["Rất yếu", "Yếu", "Trung bình", "Khá", "Mạnh"];
  const tones = ["bg-destructive", "bg-destructive", "bg-warning", "bg-primary", "bg-success"];
  return { score: s, label: labels[s], tone: tones[s] };
}

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    confirm: "",
    phoneNumber: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/.+@.+\..+/.test(form.email)) return setError("Email không hợp lệ.");
    if (!form.name.trim()) return setError("Vui lòng nhập họ tên.");
    if (form.password.length < 8) return setError("Mật khẩu tối thiểu 8 ký tự.");
    if (form.password !== form.confirm) return setError("Xác nhận mật khẩu không khớp.");
    setBusy(true);
    try {
      await register({
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
        phoneNumber: form.phoneNumber.trim() || undefined,
      });
      toast.success("Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.");
      navigate({ to: "/", replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Đăng ký thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building className="h-5 w-5" />
            </div>
            <CardTitle>Tạo tài khoản</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Đăng ký để bắt đầu quản lý tài sản của bạn.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={update("email")}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Họ và tên</Label>
              <Input id="name" value={form.name} onChange={update("name")} disabled={busy} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                Số điện thoại <span className="text-muted-foreground">(tuỳ chọn)</span>
              </Label>
              <Input
                id="phone"
                value={form.phoneNumber}
                onChange={update("phoneNumber")}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={update("password")}
                disabled={busy}
              />
              {form.password && (
                <div className="space-y-1">
                  <div className="flex h-1.5 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded ${i < strength.score ? strength.tone : "bg-muted"}`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">Độ mạnh: {strength.label}</div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Xác nhận mật khẩu</Label>
              <Input
                id="confirm"
                type="password"
                value={form.confirm}
                onChange={update("confirm")}
                disabled={busy}
              />
            </div>
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              Ghi chú (chế độ dev): email xác thực được in ra console của backend. Copy link trong
              console và mở trong trình duyệt để xác thực.
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Đăng ký
            </Button>
            <div className="text-center text-sm">
              Đã có tài khoản?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Đăng nhập
              </Link>
            </div>
          </form>
          <GoogleLoginSection onSuccess={() => navigate({ to: "/", replace: true })} />
        </CardContent>
      </Card>
    </div>
  );
}
