import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Monorepo: biến môi trường đặt ở .env của thư mục gốc, dùng chung cho web, worker và Prisma.
const repoRoot = path.resolve(process.cwd(), "../..");
loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production");

const isDev = process.env.NODE_ENV !== "production";

/** Origin của kho file (trình duyệt PUT file và tải PDF trực tiếp từ đây bằng URL ký sẵn). */
function storageOrigin(): string {
  const endpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT;
  if (!endpoint) return "https://*.r2.cloudflarestorage.com";
  try {
    const url = new URL(endpoint);
    // Với virtual-hosted style (R2/S3 thật) bucket nằm ở subdomain
    return process.env.S3_FORCE_PATH_STYLE === "true"
      ? url.origin
      : `${url.protocol}//*.${url.host}`;
  } catch {
    return "";
  }
}

const storage = storageOrigin();

const csp = [
  "default-src 'self'",
  // Next.js chèn script inline để hydrate; 'unsafe-eval' chỉ cần khi dev (React Refresh)
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${storage}`,
  "font-src 'self'",
  `connect-src 'self' ${storage}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://login.microsoftonline.com",
]
  .join("; ")
  .replace(/\s+/g, " ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

/** Host của web khi chạy sau proxy (Codespaces, reverse proxy) để server action chấp nhận Origin. */
const appHost = (() => {
  try {
    return new URL(process.env.APP_URL ?? "").host;
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  poweredByHeader: false,
  // Các package trong workspace là mã TypeScript chưa build
  transpilePackages: ["@khotl/core", "@khotl/db", "@khotl/adapters"],
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb", allowedOrigins: appHost ? [appHost] : [] },
  },
  // S3_PROXY_TARGET: cho trình duyệt dùng kho file qua đường /s3 của chính web
  // (khi kho file không mở ra ngoài, ví dụ Codespaces). Bình thường để trống.
  async rewrites() {
    const target = process.env.S3_PROXY_TARGET;
    return target ? [{ source: "/s3/:path*", destination: `${target.replace(/\/$/, "")}/:path*` }] : [];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(nextConfig);
