import path from "node:path";
import { defineConfig } from "vitest/config";

/** Test tích hợp với Postgres thật (cần DATABASE_URL đã áp migration). */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.int.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
