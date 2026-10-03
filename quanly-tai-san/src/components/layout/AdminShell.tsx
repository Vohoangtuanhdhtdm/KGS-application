import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Flag, ListChecks, Search, ShieldCheck, Users } from "lucide-react";
import { adminApi } from "@/lib/api/admin";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";

/**
 * Khung của không gian **Quản trị**.
 *
 * Đây là khung duy nhất có thanh bên, và thanh bên đó sẫm màu ở cả hai theme. Lựa chọn có
 * chủ ý: quản trị viên phải biết TỨC THÌ rằng mình đang ở nơi mà một cú bấm "Từ chối" sẽ
 * gửi email tới người thật. Trước đây trang duyệt tin mang đúng header của sàn giao dịch —
 * nhìn lướt thì không phân biệt được đang xem tin với tư cách người mua hay người duyệt.
 *
 * Số tin chờ duyệt nằm ngay trên mục menu, vì đó là câu hỏi đầu tiên quản trị viên đặt ra
 * khi mở khu này. Dùng chung khoá truy vấn ["admin-stats"] với trang duyệt tin, nên không
 * có thêm lượt gọi API nào, và duyệt xong một tin thì con số tự giảm theo.
 */
/**
 * API trả trạng thái dạng CHUỖI ("Pending") dù kiểu TypeScript khai báo là số — trang duyệt
 * tin (admin.listings.tsx) cũng so theo chuỗi vì lẽ đó. Chấp nhận cả hai để con số không
 * lặng lẽ biến mất nếu một ngày backend đổi sang serialize enum dạng số.
 */
const isPending = (status: unknown) => status === 1 || String(status) === "Pending";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats(),
    staleTime: 30_000,
    retry: 1,
  });
  const pending = stats.data?.byStatus.find((s) => isPending(s.status))?.count ?? 0;

  const nav = [
    { to: "/admin/listings", label: "Duyệt tin đăng", icon: ShieldCheck, badge: pending },
    { to: "/admin/reports", label: "Báo vi phạm", icon: Flag, badge: 0 },
    { to: "/admin/all-listings", label: "Tất cả tin đăng", icon: ListChecks, badge: 0 },
    { to: "/admin/users", label: "Người dùng", icon: Users, badge: 0 },
  ];

  const item = (n: (typeof nav)[number], layout: "side" | "top") => {
    const active = pathname.startsWith(n.to);
    return (
      <Link
        key={n.to}
        to={n.to}
        aria-current={active ? "page" : undefined}
        className={
          layout === "side"
            ? `relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/10 text-ws-admin-ink-foreground"
                  : "text-ws-admin-ink-foreground/70 hover:bg-white/5 hover:text-ws-admin-ink-foreground"
              }`
            : `inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                active ? "bg-white/10" : "text-ws-admin-ink-foreground/70"
              }`
        }
      >
        {/* Vạch chỉ báo bên trái — dấu hiệu "đang ở đây" không phụ thuộc riêng vào màu nền. */}
        {layout === "side" && active && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-ws-admin-accent"
          />
        )}
        <n.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{n.label}</span>
        {n.badge > 0 && (
          <span className="rounded-full bg-ws-admin-accent px-1.5 py-px text-[11px] font-semibold text-ws-admin-ink tabular-nums">
            {n.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      {/* ---- Desktop: thanh bên cố định ---- */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ws-admin-ink text-ws-admin-ink-foreground md:flex">
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ws-admin-accent text-ws-admin-ink">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">KGS Quản trị</div>
            <div className="text-[11px] text-ws-admin-ink-foreground/60">Kiểm duyệt nội dung</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 px-2" aria-label="Điều hướng quản trị">
          {nav.map((n) => item(n, "side"))}
        </nav>

        <div className="mt-auto space-y-0.5 border-t border-white/10 px-2 py-3">
          <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-ws-admin-ink-foreground/50 uppercase">
            Rời khu quản trị
          </p>
          <Link
            to="/tin-dang"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ws-admin-ink-foreground/70 hover:bg-white/5 hover:text-ws-admin-ink-foreground"
          >
            <Search className="h-4 w-4" /> Về Tìm nhà
          </Link>
          <Link
            to="/tin-cua-toi"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ws-admin-ink-foreground/70 hover:bg-white/5 hover:text-ws-admin-ink-foreground"
          >
            <Building2 className="h-4 w-4" /> Về Chủ nhà
          </Link>
          <div className="flex items-center gap-1 px-1 pt-2">
            <div className="min-w-0 flex-1">
              <UserMenu />
            </div>
            <NotificationBell tone="dark" />
          </div>
        </div>
      </aside>

      {/* ---- Mobile: dải trên cùng, cùng màu mực ---- */}
      <header className="sticky top-0 z-30 bg-ws-admin-ink text-ws-admin-ink-foreground md:hidden">
        <div className="flex h-12 items-center gap-2 px-3">
          <ShieldCheck className="h-4.5 w-4.5 text-ws-admin-accent" />
          <span className="text-sm font-semibold">KGS Quản trị</span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell tone="dark" />
            <UserMenu compact />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Điều hướng quản trị">
          {nav.map((n) => item(n, "top"))}
        </nav>
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
