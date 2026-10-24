import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "./rate-limit";
import { contentDisposition } from "./storage";

describe("MemoryRateLimiter", () => {
  it("chặn khi vượt giới hạn trong cửa sổ", async () => {
    const limiter = new MemoryRateLimiter();
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.hit("otp:a@b", 3, 60));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[3]?.remaining).toBe(0);
  });

  it("các khóa khác nhau đếm riêng", async () => {
    const limiter = new MemoryRateLimiter();
    await limiter.hit("a", 1, 60);
    expect((await limiter.hit("b", 1, 60)).ok).toBe(true);
  });
});

describe("contentDisposition", () => {
  it("giữ tên tiếng Việt qua filename* và có tên ASCII dự phòng", () => {
    const header = contentDisposition("Đề thi Giải tích.pdf", false);
    expect(header.startsWith("attachment;")).toBe(true);
    expect(header).toContain('filename="de thi Giai tich.pdf"');
    expect(header).toContain("filename*=UTF-8''%C4%90%E1%BB%81%20thi");
  });

  it("không để dấu ngoặc kép phá header", () => {
    expect(contentDisposition('a"b.pdf', true)).toContain('filename="a_b.pdf"');
  });
});
