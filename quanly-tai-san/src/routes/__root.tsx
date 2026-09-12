import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { StoreProvider } from "@/lib/store";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { EmailNotConfirmedBanner } from "@/components/auth/EmailNotConfirmedBanner";
import { UserMenu } from "@/components/layout/UserMenu";
import { BottomTabBar } from "@/components/navigation/BottomTabBar";
import { CompareBar } from "@/components/public/CompareBar";
import { Toaster } from "@/components/ui/sonner";
import { isPublicPath } from "@/lib/publicPaths";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Không tìm thấy trang</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Trang bạn tìm không tồn tại hoặc đã được di chuyển.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Không tải được trang</h1>
        <p className="mt-2 text-sm text-muted-foreground">Đã có lỗi xảy ra. Bạn có thể thử lại.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Thử lại
          </button>
          <a
            href="/"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "KGS — Tìm kiếm và kết nối bất động sản" },
      {
        name: "description",
        content:
          "Nền tảng tìm kiếm và kết nối bất động sản: nhà trọ, phòng cho thuê, căn hộ và nhà đất. Xem đầy đủ chi phí, nội quy và tiện nghi trước khi đi xem.",
      },
      { property: "og:title", content: "KGS — Tìm kiếm và kết nối bất động sản" },
      {
        property: "og:description",
        content:
          "Nền tảng tìm kiếm và kết nối bất động sản: nhà trọ, phòng cho thuê, căn hộ và nhà đất. Xem đầy đủ chi phí, nội quy và tiện nghi trước khi đi xem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "KGS — Tìm kiếm và kết nối bất động sản" },
      {
        name: "twitter:description",
        content:
          "Nền tảng tìm kiếm và kết nối bất động sản: nhà trọ, phòng cho thuê, căn hộ và nhà đất. Xem đầy đủ chi phí, nội quy và tiện nghi trước khi đi xem.",
      },
      // Không khai báo og:image mặc định.
      //
      // Chỗ này từng trỏ tới một ảnh chụp màn hình bản xem thử do công cụ dựng khung sinh
      // ra, nằm trên bucket của bên thứ ba. Ảnh đó không còn phản ánh sản phẩm, và mọi lần
      // chia sẻ trang chủ đều hiện nó. Trang chi tiết tin đăng tự đặt og:image bằng ảnh
      // thật của tin (xem tin-dang.$slug.tsx); các trang khác thà không có ảnh xem trước
      // còn hơn có một ảnh sai.
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StoreProvider>
          <AppShell />
          <Toaster position="top-right" richColors />
        </StoreProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/** Route mà bản đồ phải chiếm trọn viewport — rail thu gọn, không header, không banner. */
const MAP_PATH = "/quan-ly/ban-do";

/** Điều hướng desktop cho các trang nội bộ (đã đăng nhập, ngoài marketplace công khai). */
const SHELL_NAV = [
  { to: "/tin-dang", label: "Tìm nhà" },
  { to: "/dang-tin", label: "Đăng tin" },
  { to: "/tin-cua-toi", label: "Tin của tôi" },
  { to: "/da-luu", label: "Đã lưu" },
  { to: "/yeu-cau", label: "Yêu cầu" },
] as const;

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAuthenticated } = useAuth();
  const isMapPage = pathname === MAP_PATH || pathname === MAP_PATH + "/";

  // Trang cong khai tu lo header rieng (PublicHeader). Nguoi da dang nhap van thay thanh
  // dieu huong de di tiep sang Dang tin / Tin cua toi ma khong phai quay ve.
  if (isPublicPath(pathname)) {
    // CompareBar chỉ nổi ở những trang có LƯỚI tin (trang chủ, kết quả tìm kiếm, chính
    // trang so sánh) — nơi người dùng thật sự bấm nút "so sánh" trên nhiều thẻ liên tiếp.
    // Trang chi tiết một tin (/tin-dang/$slug) đã có sẵn thanh liên hệ cố định ở đáy trên
    // mobile; chồng thêm một thanh nổi thứ ba vào đúng khu vực đó chỉ khiến ba thanh
    // tranh chỗ nhau, nên trang đó dùng một lối vào so sánh khác, không phải thanh nổi.
    const showCompareBar =
      pathname === "/" ||
      pathname === "/tin-dang" ||
      pathname === "/tin-dang/" ||
      pathname === "/so-sanh";
    return (
      <>
        <Outlet />
        {showCompareBar && <CompareBar />}
        {isAuthenticated && <BottomTabBar />}
      </>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      {/* Màn bản đồ chiếm trọn viewport: không header, không banner. Các trang khác giữ
          header mảnh. Điều hướng chung nằm ở BottomTabBar nổi đáy. */}
      {!isMapPage && (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur">
          {/* Tên sản phẩm là LỐI VỀ trang chủ, không phải một dòng chữ trang trí. Trước đây
              nó là <div>: người dùng bấm theo phản xạ và không có gì xảy ra, mà từ các
              trang nội bộ cũng không còn đường nào quay lại marketplace. */}
          <Link to="/" className="text-sm font-semibold hover:underline">
            KGS
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Nền tảng bất động sản
          </span>
          {/* Desktop không còn thanh nổi dưới đáy, nên điều hướng chính chuyển lên đây. */}
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Điều hướng">
            {SHELL_NAV.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <UserMenu />
          </div>
        </header>
      )}
      {!isMapPage && <EmailNotConfirmedBanner />}
      <main className={isMapPage ? "h-screen min-w-0" : "min-w-0 flex-1 pb-28"}>
        <ProtectedRoute>
          <Outlet />
        </ProtectedRoute>
      </main>
      <BottomTabBar />
    </div>
  );
}
