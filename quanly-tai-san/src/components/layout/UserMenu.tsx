import { Link, useNavigate } from "@tanstack/react-router";
import { Check, KeyRound, LogOut, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { WORKSPACES } from "@/lib/workspace";
import { WS_CLASS, useAvailableWorkspaces } from "@/components/workspace/wsStyles";
import { useCurrentWorkspace } from "@/components/workspace/useCurrentWorkspace";
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
  const current = useCurrentWorkspace();
  const spaces = useAvailableWorkspaces();
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
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded bg-ws-admin-soft px-1.5 py-0.5 text-[10px] font-medium text-ws-admin">
                <ShieldCheck className="h-3 w-3" /> Admin
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Chuyển không gian.
            Trước đây menu này liệt kê rời từng màn hình quản trị ngay cạnh "Hồ sơ cá nhân",
            như thể duyệt tin là một mục cài đặt tài khoản. Giờ mỗi không gian là MỘT lựa
            chọn, có màu định danh riêng và dấu tích ở không gian đang đứng — người dùng
            thấy mình đang ở vai trò nào và đổi vai trò bằng một cú bấm. */}
        <DropdownMenuLabel className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Chuyển không gian
        </DropdownMenuLabel>
        {spaces.map((id) => {
          const ws = WORKSPACES[id];
          const Icon = ws.icon;
          const here = id === current;
          return (
            <DropdownMenuItem key={id} asChild>
              <Link to={ws.home} aria-current={here ? "page" : undefined}>
                <span
                  className={`mr-2 flex h-5 w-5 items-center justify-center rounded ${WS_CLASS[id].solid}`}
                  aria-hidden="true"
                >
                  <Icon className="h-3 w-3" />
                </span>
                <span className="flex-1">{ws.label}</span>
                {here && <Check className="ml-2 h-4 w-4 text-muted-foreground" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />

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
