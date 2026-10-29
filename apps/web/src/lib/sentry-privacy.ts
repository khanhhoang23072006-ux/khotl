/**
 * Sentry chỉ nhận stack trace và metadata, không nhận dữ liệu người dùng:
 * không cookie, header, body, query string, tham số SQL, biến cục bộ.
 */
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} as const;
