import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // *.int.test.ts cần Postgres thật, chạy riêng bằng `pnpm test:int` (vitest.int.config.ts)
  test: { include: ["src/**/*.test.ts"], exclude: ["src/**/*.int.test.ts", "**/node_modules/**"] },
});
