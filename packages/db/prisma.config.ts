import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 không tự đọc .env: nạp .env của package (nếu có) rồi .env ở thư mục gốc repo.
config({ path: [".env", "../../.env"] });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Không dùng env() vì nó báo lỗi khi thiếu biến, làm `prisma generate` thất bại lúc cài đặt.
    url: process.env.DATABASE_URL ?? "",
  },
});
