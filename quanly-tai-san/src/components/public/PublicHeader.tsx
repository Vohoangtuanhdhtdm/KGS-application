import { Link, useRouterState } from "@tanstack/react-router";
import {
  Building,
  Building2,
  Calculator,
  Heart,
  LineChart,
  LogIn,
  Plus,
  Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { WorkspaceBadge } from "@/components/workspace/WorkspaceBadge";

/**
 * Header của không gian **Tìm nhà** — khung mà khách và người đi tìm nhà nhìn thấy.
 *
 * Trên màn hình hẹp, điều hướng nằm ở thanh nổi dưới đáy. Trên màn hình rộng thì thanh
 * nổi đó vừa che nội dung vừa nằm sai chỗ theo thói quen của người dùng desktop, nên nó
 * bị ẩn — và phần điều hướng chuyển lên đây.
 *
 * Bản trước có "Tin của tôi" nằm chung hàng với "Tìm nhà" và "Đã lưu": việc của người đăng
 * tin trộn vào menu của người đi tìm. Nay nó thuộc không gian Chủ nhà, và chỗ trống đó dành
 * cho hai công cụ tra cứu — thứ người đi tìm nhà thật sự cần: một căn như vầy đáng giá bao
 * nhiêu, và thị trường đang lên hay xuống.
 */

const NAV = [
  { to: "/tin-dang", label: "Tìm nhà", icon: Search, authOnly: false },
  { to: "/dinh-gia", label: "Định giá", icon: Calculator, authOnly: false },
  { to: "/chi-so-gia", label: "Chỉ số giá", icon: LineChart, authOnly: false },
  { to: "/da-luu", label: "Đã lưu", icon: Heart, authOnly: true },
] as const;

export function PublicHeader() {
  const { isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ws-seeker text-ws-foreground">
            <Building className="h-4.5 w-4.5" />
          </div>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold">KGS</span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              Tìm nhà theo tổng chi phí
            </span>
          </span>
        </Link>

        {/* Nhãn không gian chỉ hiện với người đã đăng nhập — họ là người duy nhất có không
            gian khác để chuyển sang. Với khách, một nhãn "Tìm nhà" chỉ là chữ thừa. */}
        {isAuthenticated && <WorkspaceBadge ws="seeker" className="hidden lg:inline-flex" />}

        <nav className="hidden flex-1 items-center gap-1 pl-2 md:flex" aria-label="Điều hướng">
          {NAV.filter((n) => !n.authOnly || isAuthenticated).map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated ? (
            <>
              {/* Lối sang không gian Chủ nhà, mang màu của chính không gian đó — người dùng
                  thấy trước rằng bấm vào là sang một nơi khác, không phải thêm một trang. */}
              <Link
                to="/tin-cua-toi"
                className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-ws-owner/40 px-3 py-1.5 text-sm font-medium text-ws-owner transition-colors hover:bg-ws-owner-soft lg:inline-flex"
              >
                <Building2 className="h-4 w-4" />
                Chủ nhà
              </Link>
              <Button size="sm" asChild>
                <Link to="/dang-tin">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Đăng tin
                </Link>
              </Button>
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <Button size="sm" asChild>
              <Link to="/login">
                <LogIn className="mr-1.5 h-4 w-4" />
                Đăng nhập
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
