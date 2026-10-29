import * as Sentry from "@sentry/node";

/** Bật Sentry khi có SENTRY_DSN; không có thì mọi hàm ở đây không làm gì. */
export const monitoringEnabled = Boolean(process.env.SENTRY_DSN);

if (monitoringEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "production",
    release: process.env.SENTRY_RELEASE,
    // Không gửi dữ liệu người dùng: chỉ stack trace và metadata
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, databaseQueryData: false, queues: false, stackFrameVariables: false },
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    initialScope: { tags: { service: "worker" } },
  });
}

export function reportError(message: string, fields?: Record<string, unknown>) {
  if (!monitoringEnabled) return;
  const error = fields?.error instanceof Error ? fields.error : new Error(message);
  Sentry.captureException(error, { extra: { message, ...fields } });
}

/** Gửi hết lỗi còn trong hàng đợi trước khi tiến trình dừng. */
export async function flushMonitoring() {
  if (monitoringEnabled) await Sentry.flush(2000);
}
