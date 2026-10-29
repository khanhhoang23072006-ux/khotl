import { reportError } from "./monitoring";

type Level = "info" | "warn" | "error";

/** Log dạng JSON một dòng, dễ gom bằng Loki/CloudWatch. */
function write(level: Level, message: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, service: "worker", message, ...fields }, (_key, value) =>
    value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value,
  );
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (message: string, fields?: Record<string, unknown>) => write("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => {
    write("error", message, fields);
    reportError(message, fields);
  },
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
