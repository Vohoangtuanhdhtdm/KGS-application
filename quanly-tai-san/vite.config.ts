// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  /**
   * Tắt nitro. Nitro là tầng máy chủ dùng để đóng gói ứng dụng SSR cho một nền tảng cụ thể
   * (mặc định của gói cấu hình này là Cloudflare). Bản dựng SPA bên dưới không có tầng máy
   * chủ nào để đóng gói — nó chỉ sinh ra HTML, CSS, JS tĩnh.
   *
   * Không tắt thì hai bên giẫm chân nhau và bản dựng hỏng thật: nitro ghi kết quả vào
   * .output/, trong khi bước prerender của chế độ SPA đi tìm dist/server/server.js và dừng
   * với ERR_MODULE_NOT_FOUND.
   */
  nitro: false,

  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },

    /**
     * Chế độ SPA — dựng ra tệp tĩnh để phát qua S3 + CloudFront.
     *
     * Ứng dụng này KHÔNG dùng server function nào (đã kiểm: không có createServerFn,
     * createServerRoute hay server route nào trong src/). Mọi dữ liệu đều lấy từ API .NET
     * bằng fetch phía trình duyệt, nên tầng máy chủ của TanStack Start chỉ đang dựng sẵn
     * HTML mà không thêm dữ liệu gì vào đó.
     *
     * Đổi sang SPA vì hạ tầng: giữ SSR nghĩa là phải nuôi thêm một tiến trình Node ngay
     * trên EC2 — trên máy chỉ có vài GB RAM đang phải gánh cả .NET lẫn LightGBM. Bản tĩnh
     * nằm trên S3, CloudFront phát đi, không tốn RAM nào của máy chủ và gần người dùng hơn.
     *
     * Đánh đổi đã biết: HTML trả về ban đầu chỉ là khung rỗng, nên công cụ tìm kiếm nào
     * không chạy JavaScript sẽ không đọc được nội dung tin đăng. Với một sàn bất động sản
     * thì SEO có giá trị thật, và đây là khoản nợ cần trả khi hệ thống rời khỏi phạm vi
     * gói miễn phí — lúc đó SSR quay lại bằng cách bỏ khối này và chạy nitro preset
     * node-server.
     */
    spa: { enabled: true },
  },
});
