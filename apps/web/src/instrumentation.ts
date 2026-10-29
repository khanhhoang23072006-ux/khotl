import type { Instrumentation } from "next";
import { sentryDataCollection } from "@/lib/sentry-privacy";

/**
 * Theo dõi lỗi phía máy chủ bằng Sentry. Chỉ bật khi có SENTRY_DSN; không có thì không tải SDK.
 * Next.js gọi register() một lần khi khởi động mỗi runtime.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,
    dataCollection: { ...sentryDataCollection, httpBodies: [] },
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    initialScope: { tags: { service: "web", runtime: process.env.NEXT_RUNTIME ?? "nodejs" } },
  });
}

/** Lỗi trong server component, route handler, server action. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, request, context);
};
