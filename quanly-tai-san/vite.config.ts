import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { fileURLToPath } from "node:url";

// Cấu hình Vite viết thẳng, không qua gói bọc của nền tảng sinh mã ban đầu: gói đó ép máy chủ
// dev nghe trên MỌI địa chỉ mạng (lộ ra IP mạng LAN), bắt mỗi lần lưu tệp chờ thêm 1 giây mới
// nạp lại, và cài thêm các plugin chỉ có nghĩa trong sandbox của nó.
export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      // Mã trong thư mục server/ hoặc đánh dấu "server-only" không được lọt vào bundle trình duyệt.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },

      // Trỏ entry máy chủ của TanStack Start sang src/server.ts (lớp bọc bắt lỗi SSR).
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
       * gói miễn phí — lúc đó SSR quay lại bằng cách bỏ khối này và thêm nitro preset
       * node-server.
       */
      spa: { enabled: true },
    }),
    viteReact(),
  ],
  resolve: {
    // Đọc "paths" trong tsconfig.json — Vite 8 làm sẵn, không cần plugin riêng.
    tsconfigPaths: true,
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    // Một bản React / React Query duy nhất — hai bản song song làm hook và cache tách đôi.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: {
    // Chỉ máy này truy cập được — không mở ra mạng LAN.
    host: "localhost",
    port: 8080,
  },
  preview: {
    host: "localhost",
  },
});
