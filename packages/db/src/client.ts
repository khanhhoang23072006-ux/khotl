import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// Giữ một PrismaClient duy nhất cho mỗi tiến trình (kể cả khi Next.js hot-reload ở dev).
const globalForPrisma = globalThis as unknown as { __khotlPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Thiếu biến môi trường DATABASE_URL");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__khotlPrisma) {
    globalForPrisma.__khotlPrisma = createClient();
  }
  return globalForPrisma.__khotlPrisma;
}

/**
 * Client dùng chung. Tạo trễ ở lần truy cập đầu tiên để việc import module
 * (ví dụ lúc `next build` thu thập trang) không đòi DATABASE_URL.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
