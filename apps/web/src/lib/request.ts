import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "./env";

export async function clientIp(): Promise<string> {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown";
}

/** Băm IP kèm secret: đủ để chống lạm dụng mà không lưu IP thật. */
export async function hashedIp(): Promise<string> {
  const ip = await clientIp();
  return createHash("sha256").update(`${serverEnv.authSecret}:${ip}`).digest("hex").slice(0, 32);
}
