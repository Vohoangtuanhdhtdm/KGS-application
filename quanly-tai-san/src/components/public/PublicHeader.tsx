import { Link } from "@tanstack/react-router";
import { Building, LogIn, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/button";

/** Header riêng cho trang marketplace công khai — không có user menu nội bộ. */
export function PublicHeader() {
  const { isAuthenticated } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 px-4">
        <Link to="/tin-dang" className="flex items-center gap-2.5">
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
        {isAuthenticated ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/">
              <LayoutDashboard className="h-4 w-4 mr-1.5" />
              Vào trang quản lý
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
    </header>
  );
}
