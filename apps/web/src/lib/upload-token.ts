import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token upload: server ký (HMAC-SHA256) thông tin file khi cấp URL ký sẵn, trình duyệt gửi lại
 * khi nộp metadata. Nhờ vậy không cần tạo bản ghi nháp trước khi upload xong, và người dùng
 * không thể đổi khóa file hay khai gian dung lượng.
 */
export interface UploadTokenPayload {
  /** khóa object trong bucket */
  key: string;
  userId: string;
  fileName: string;
  size: number;
  contentType: string;
  kind: string;
  /** hết hạn, tính bằng giây Unix */
  exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", `${secret}:upload-token`).update(data).digest("base64url");
}

export function createUploadToken(payload: UploadTokenPayload, secret: string): string {
  if (!secret) throw new Error("Thiếu BETTER_AUTH_SECRET để ký token upload");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export type VerifyResult =
  | { ok: true; payload: UploadTokenPayload }
  | { ok: false; reason: "malformed" | "signature" | "expired" };

export function verifyUploadToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): VerifyResult {
  const [data, signature, extra] = token.split(".");
  if (!data || !signature || extra !== undefined) return { ok: false, reason: "malformed" };
  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "signature" };
  }
  let payload: UploadTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as UploadTokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 < now) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}
