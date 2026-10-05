import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Box, Building, Building2, FileText, Inbox, Plus, Search } from "lucide-react";
import { ENABLE_ASSET_MANAGEMENT } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { WorkspaceBadge } from "@/components/workspace/WorkspaceBadge";

/**
 * Header của không gian **Chủ nhà**.
 *
 * Cùng bố cục với header Tìm nhà — người dùng không phải học lại chỗ đặt logo hay menu tài
 * khoản — nhưng bốn thứ đổi để không thể nhầm hai không gian với nhau:
 *
 * 1. Dải màu đồng thau chạy dọc mép trên, cùng màu với logo và nhãn "Chủ nhà".
 * 2. Menu chỉ còn việc của người đăng tin: tin của tôi, người hỏi thuê/mua, hiệu quả tin.
 * 3. Mọi nút chính trong trang đổi sang màu đồng thau (qua data-workspace ở gốc — xem
 *    styles.css), nên ngay cả khi cuộn khỏi header vẫn thấy mình đang ở đâu.
 * 4. Có lối về "Tìm nhà" luôn hiện, vì chủ nhà cũng hay quay lại xem tin của người khác để
 *    so giá.
 */
const NAV = [
  { to: "/tin-cua-toi", label: "Tin của tôi", icon: FileText },
  { to: "/yeu-cau", label: "Người hỏi thuê/mua", icon: Inbox },
  { to: "/thong-ke-tin", label: "Hiệu quả tin", icon: BarChart3 },
  // Toà nhà / khu trọ nhiều căn: dựng mô hình 3D và đăng tin theo từng căn.
  { to: "/toa-nha", label: "Toà nhà", icon: Box },
  ...(ENABLE_ASSET_MANAGEMENT
    ? [{ to: "/quan-ly", label: "Quản lý tài sản", icon: Building2 }]
    : []),
];

export function OwnerHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
      <div aria-hidden="true" className="h-1 bg-ws-owner" />
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
        <Link to="/tin-cua-toi" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ws-owner text-ws-foreground">
            <Building className="h-4.5 w-4.5" />
          </div>
          <span className="text-sm font-semibold">KGS</span>
        </Link>
        <WorkspaceBadge ws="owner" />

        <nav
          className="hidden flex-1 items-center gap-1 pl-2 md:flex"
          aria-label="Điều hướng Chủ nhà"
        >
          {NAV.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-ws-owner-soft text-ws-owner"
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
          <Link
            to="/tin-dang"
            className="hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-ws-seeker/30 px-3 py-1.5 text-sm font-medium text-ws-seeker transition-colors hover:bg-ws-seeker-soft xl:inline-flex"
          >
            <Search className="h-4 w-4" />
            Về Tìm nhà
          </Link>
          <Button size="sm" asChild>
            {/* Điện thoại: chỉ còn biểu tượng — đủ chữ thì thanh đầu tràn ngang ở 375px. */}
            <Link to="/dang-tin" aria-label="Đăng tin">
              <Plus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Đăng tin</span>
            </Link>
          </Button>
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
