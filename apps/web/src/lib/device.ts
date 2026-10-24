import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv } from "./env";

const DEVICE_COOKIE = "hd_dev";

/**
 * Mã thiết bị: cookie ngẫu nhiên (httpOnly, 1 năm), lưu dạng băm kèm secret.
 * Chỉ gọi trong route handler hoặc server action (nơi được phép đặt cookie).
 */
export async function deviceHash(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(DEVICE_COOKIE)?.value;
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    id = randomBytes(18).toString("base64url");
    jar.set(DEVICE_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: serverEnv.appUrl.startsWith("https://"),
      path: "/",
      maxAge: 365 * 86_400,
    });
  }
  return createHash("sha256").update(`${serverEnv.authSecret}:device:${id}`).digest("hex").slice(0, 32);
}
