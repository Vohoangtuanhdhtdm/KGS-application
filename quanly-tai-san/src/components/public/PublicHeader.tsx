import { Link, useRouterState } from "@tanstack/react-router";
import { Building, Heart, LogIn, Plus, Search, User } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * Header riêng cho trang marketplace công khai — không có user menu nội bộ.
 *
 * Trên màn hình hẹp, điều hướng nằm ở thanh nổi dưới đáy. Trên màn hình rộng thì thanh
 * nổi đó vừa che nội dung vừa nằm sai chỗ theo thói quen của người dùng desktop, nên nó
 * bị ẩn — và phần điều hướng chuyển lên đây, vào khoảng trống vốn đang bỏ không giữa
 * logo và nút bên phải.
 */

const NAV = [
  { to: "/tin-dang", label: "Tìm nhà", icon: Search, authOnly: false },
  { to: "/da-luu", label: "Đã lưu", icon: Heart, authOnly: true },
  { to: "/tin-cua-toi", label: "Tin của tôi", icon: User, authOnly: true },
] as const;

export function PublicHeader() {
  const { isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
        {/* Logo về trang chủ. Trước đây nó trỏ sang /tin-dang: người dùng bấm logo để "về
            đầu" theo phản xạ và bị đưa tới một trang khác trang chủ. */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building className="h-4.5 w-4.5" />
          </div>
          {/* Tên sản phẩm kèm một dòng nói nó làm gì. "Marketplace Bất Động Sản" là tên
              của một THỂ LOẠI, không phải của sản phẩm này — nó đúng với mọi sàn tin đăng
              và vì thế không phân biệt được cái nào với cái nào. */}
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold">KGS</span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              Tìm nhà theo tổng chi phí
            </span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 pl-4 md:flex" aria-label="Điều hướng">
          {NAV.filter((n) => !n.authOnly || isAuthenticated).map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
            <Button size="sm" asChild>
              <Link to="/dang-tin">
                <Plus className="h-4 w-4 mr-1.5" />
                Đăng tin
              </Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/login">
                <LogIn className="h-4 w-4 mr-1.5" />
                Đăng nhập
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
