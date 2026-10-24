import { describe, expect, it } from "vitest";
import { createUploadToken, verifyUploadToken } from "./upload-token";

const payload = {
  key: "originals/u1/abc.pdf",
  userId: "u1",
  fileName: "de-thi.pdf",
  size: 1234,
  contentType: "application/pdf",
  kind: "PDF",
  exp: 2_000_000_000,
};

describe("upload token", () => {
  it("ký và xác minh được", () => {
    const token = createUploadToken(payload, "secret");
    expect(verifyUploadToken(token, "secret", 1_000)).toEqual({ ok: true, payload });
  });

  it("từ chối khi sửa nội dung hoặc sai khóa", () => {
    const token = createUploadToken(payload, "secret");
    const [, signature] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ ...payload, size: 1 })).toString("base64url")}.${signature}`;
    expect(verifyUploadToken(forged, "secret")).toEqual({ ok: false, reason: "signature" });
    expect(verifyUploadToken(token, "other")).toEqual({ ok: false, reason: "signature" });
  });

  it("từ chối token hết hạn hoặc sai dạng", () => {
    const token = createUploadToken({ ...payload, exp: 10 }, "secret");
    expect(verifyUploadToken(token, "secret", 11_000)).toEqual({ ok: false, reason: "expired" });
    expect(verifyUploadToken("abc", "secret")).toEqual({ ok: false, reason: "malformed" });
    expect(verifyUploadToken("a.b.c", "secret")).toEqual({ ok: false, reason: "malformed" });
  });
});
