import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { api } from "@/lib/auth/api";
import { ApiError, type AuthUser } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Hồ sơ cá nhân — Quản Lý Tài Sản" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, updateUser, logoutAll } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", bio: "", phoneNumber: "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await api<AuthUser>("/account/me");
        setForm({ name: me.name || "", bio: me.bio || "", phoneNumber: me.phoneNumber || "" });
        updateUser(me);
      } catch {
        /* handled by interceptor */
      }
    })();
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api("/account/me", {
        method: "PUT",
        body: { name: form.name, bio: form.bio || null, phoneNumber: form.phoneNumber || null },
      });
      updateUser({ name: form.name });
      toast.success("Đã lưu hồ sơ");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Không lưu được hồ sơ.");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 8) return toast.error("Mật khẩu mới tối thiểu 8 ký tự.");
    if (pw.next !== pw.confirm) return toast.error("Xác nhận mật khẩu không khớp.");
    setSavingPw(true);
    try {
      await api("/account/change-password", {
        method: "POST",
        body: { currentPassword: pw.current, newPassword: pw.next },
      });
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Đã đổi mật khẩu");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Không đổi được mật khẩu.");
    } finally {
      setSavingPw(false);
    }
  };

  const doLogoutAll = async () => {
    setLoadingAll(true);
    try {
      await logoutAll();
      toast.success("Đã đăng xuất mọi thiết bị");
      navigate({ to: "/login", replace: true });
    } catch {
      toast.error("Không đăng xuất được.");
    } finally {
      setLoadingAll(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Hồ sơ cá nhân</h1>
        <p className="text-sm text-muted-foreground">Quản lý thông tin tài khoản và bảo mật.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin cá nhân</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={user.email} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Họ tên</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Số điện thoại</Label>
                <Input
                  id="phone"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Giới thiệu</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Lưu thay đổi
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card id="doi-mat-khau">
        <CardHeader>
          <CardTitle>Đổi mật khẩu</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw-cur">Mật khẩu hiện tại</Label>
              <Input
                id="pw-cur"
                type="password"
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pw-new">Mật khẩu mới</Label>
                <Input
                  id="pw-new"
                  type="password"
                  value={pw.next}
                  onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-cfm">Xác nhận</Label>
                <Input
                  id="pw-cfm"
                  type="password"
                  value={pw.confirm}
                  onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                />
              </div>
            </div>
            <Button type="submit" disabled={savingPw}>
              {savingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cập nhật mật khẩu
            </Button>
          </form>
        </CardContent>
      </Card>

      <NotificationSection />

      <Card>
        <CardHeader>
          <CardTitle>Bảo mật phiên đăng nhập</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Đăng xuất khỏi tất cả các thiết bị và trình duyệt đang mở phiên của bạn.
          </p>
          <Button variant="destructive" onClick={doLogoutAll} disabled={loadingAll}>
            {loadingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Đăng xuất mọi thiết bị
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationSection() {
  const { isSupported, isSubscribed, permissionDenied, busy, subscribe, unsubscribe } =
    usePushNotifications();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông báo</CardTitle>
      </CardHeader>
      <CardContent>
        {!isSupported ? (
          <p className="text-sm text-muted-foreground">
            Trình duyệt của bạn không hỗ trợ thông báo đẩy.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Nhận thông báo đẩy trên trình duyệt này</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nhắc lịch đến hạn sẽ hiện thông báo kể cả khi tab đang đóng.
                </p>
              </div>
              <Switch
                checked={isSubscribed}
                disabled={busy || (permissionDenied && !isSubscribed)}
                onCheckedChange={(v) => (v ? subscribe() : unsubscribe())}
              />
            </div>
            {permissionDenied && !isSubscribed && (
              <p className="text-xs text-warning-foreground bg-warning/10 border border-warning/40 rounded-md px-3 py-2">
                Bạn đã chặn thông báo cho trang này — vào cài đặt trình duyệt (biểu tượng ổ khoá
                cạnh thanh địa chỉ) để bật lại quyền thông báo.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
