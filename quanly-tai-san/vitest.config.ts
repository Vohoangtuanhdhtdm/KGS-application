import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Chỉ dùng cho hàm thuần (không DOM): môi trường node, alias "@" giống vite.config.ts.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
