import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection } from "@/lib/sentry-privacy";

// Lỗi JavaScript phía trình duyệt. Chỉ bật khi đặt NEXT_PUBLIC_SENTRY_DSN lúc build.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    dataCollection: { ...sentryDataCollection, httpBodies: [] },
    tracesSampleRate: 0,
  });
}

export const onRouterTransitionStart = dsn ? Sentry.captureRouterTransitionStart : undefined;
