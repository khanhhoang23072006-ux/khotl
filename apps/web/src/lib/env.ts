import "server-only";
import { parseDomains } from "@khotl/core";

function intFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Cấu hình phía server, đọc một lần từ biến môi trường (xem .env.example). */
export const serverEnv = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  authSecret: process.env.BETTER_AUTH_SECRET ?? "",
  allowedDomains: parseDomains(process.env.ALLOWED_EMAIL_DOMAINS ?? "sis.hust.edu.vn,hust.edu.vn"),
  adminEmails: parseDomains(process.env.ADMIN_EMAILS ?? ""),
  microsoft:
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ? {
          clientId: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          tenantId: process.env.MICROSOFT_TENANT_ID || "organizations",
        }
      : null,
  uploadLimits: {
    maxMb: intFromEnv("UPLOAD_MAX_MB", 50),
    zipMaxMb: intFromEnv("UPLOAD_ZIP_MAX_MB", 100),
  },
  guestPreviewPages: intFromEnv("GUEST_PREVIEW_PAGES", 3),
};
