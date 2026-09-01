import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Users,
  Wallet,
  Bell,
  Tag,
  Building,
  ShieldCheck,
  Megaphone,
  Globe,
  ExternalLink,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth/AuthContext";

const items = [
  { title: "Tổng quan", url: "/", icon: LayoutDashboard },
  { title: "Tài sản", url: "/tai-san", icon: Building2 },
  { title: "Hợp đồng", url: "/hop-dong", icon: FileText },
  { title: "Sổ đối tác", url: "/doi-tac", icon: Users },
  { title: "Sổ thu chi", url: "/thu-chi", icon: Wallet },
  { title: "Nhắc lịch", url: "/nhac-lich", icon: Bell },
  { title: "Rao bán", url: "/rao-ban", icon: Tag },
  { title: "Tin đăng của tôi", url: "/my-listings", icon: Megaphone },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { isAdmin } = useAuth();
  const isActive = (u: string) => (u === "/" ? pathname === "/" : pathname.startsWith(u));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Building className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">Quản Lý Tài Sản</span>
            <span className="text-[11px] text-sidebar-foreground/60">Prototype v1</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Điều hướng</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                {/* Trang công khai — mở tab mới để xem song song lúc đang thao tác nội bộ */}
                <SidebarMenuButton asChild tooltip="Xem trang công khai">
                  <a href="/tin-dang" target="_blank" rel="noopener noreferrer">
                    <Globe />
                    <span>Marketplace</span>
                    <ExternalLink className="ml-auto h-3 w-3 opacity-50 group-data-[collapsible=icon]:hidden" />
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Quản trị</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip="Duyệt tin đăng">
                    <Link to="/admin/properties">
                      <ShieldCheck />
                      <span>Duyệt tin đăng</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
