import { Link, useNavigate } from "@tanstack/react-router";
import { Flag, KeyRound, LogOut, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

/** `compact` = chỉ avatar, không kèm tên — dùng cho icon rail rộng 72px. */
export function UserMenu({ compact = false }: { compact?: boolean } = {}) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const doLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label="Tài khoản"
          className={
            compact
              ? "h-10 w-10 rounded-full p-0 hover:bg-white/10"
              : "flex h-9 items-center gap-2 px-2"
          }
        >
          <Avatar className={compact ? "h-8 w-8" : "h-7 w-7"}>
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
            <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
          </Avatar>
          {!compact && (
            <span className="hidden max-w-[140px] truncate text-sm sm:inline">{user.name}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate">{user.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            {isAdmin && (
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                <ShieldCheck className="h-3 w-3" /> Admin
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Khu quản trị.
            Trước đây menu này chỉ gắn một huy hiệu "Admin" rồi thôi — nói với người dùng
            rằng họ có quyền, nhưng không cho họ đường nào để dùng quyền đó. Hai màn hình
            duyệt tin và xử lý báo vi phạm chỉ vào được qua sheet Tài khoản ở thanh nổi
            dưới đáy, mà thanh đó đã bị ẩn từ md trở lên — nên trên desktop khu quản trị
            hoàn toàn không có lối vào. */}
        {isAdmin && (
          <>
            <DropdownMenuItem asChild>
              <Link to="/admin/listings">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Duyệt tin đăng
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/reports">
                <Flag className="mr-2 h-4 w-4" />
                Báo vi phạm
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem asChild>
          <Link to="/profile">
            <User className="mr-2 h-4 w-4" />
            Hồ sơ cá nhân
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile" hash="doi-mat-khau">
            <KeyRound className="mr-2 h-4 w-4" />
            Đổi mật khẩu
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={doLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
