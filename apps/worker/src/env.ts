import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

// Đọc .env ở thư mục gốc repo (biến đã đặt sẵn trong môi trường được ưu tiên).
loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

function intFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const config = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  concurrency: intFromEnv("WORKER_CONCURRENCY", 2),
  clamav: process.env.CLAMAV_HOST
    ? { host: process.env.CLAMAV_HOST, port: intFromEnv("CLAMAV_PORT", 3310) }
    : null,
  clamavRequired: process.env.CLAMAV_REQUIRED === "true",
  limits: {
    maxMb: intFromEnv("UPLOAD_MAX_MB", 50),
    zipMaxMb: intFromEnv("UPLOAD_ZIP_MAX_MB", 100),
  },
  guestPreviewPages: intFromEnv("GUEST_PREVIEW_PAGES", 3),
  maxAttempts: 3,
};
