import { describe, expect, it } from "vitest";
import { computeTrustLevel, dailyUploadLimit, queuePriority } from "./quota";

describe("bậc uy tín và hạn mức", () => {
  it("tăng bậc theo số tài liệu được duyệt", () => {
    expect(computeTrustLevel({ approvedCount: 0, violationCount: 0 })).toBe(0);
    expect(computeTrustLevel({ approvedCount: 3, violationCount: 0 })).toBe(1);
    expect(computeTrustLevel({ approvedCount: 10, violationCount: 1 })).toBe(2);
    expect(computeTrustLevel({ approvedCount: 30, violationCount: 0 })).toBe(3);
  });

  it("vi phạm làm mất bậc cao nhất và về 0 khi vi phạm nhiều", () => {
    expect(computeTrustLevel({ approvedCount: 30, violationCount: 1 })).toBe(2);
    expect(computeTrustLevel({ approvedCount: 50, violationCount: 3 })).toBe(0);
  });

  it("hạn mức upload theo bậc 3 / 10 / 30 / 50", () => {
    expect([0, 1, 2, 3].map(dailyUploadLimit)).toEqual([3, 10, 30, 50]);
    expect(dailyUploadLimit(-1)).toBe(3);
    expect(dailyUploadLimit(9)).toBe(50);
  });

  it("người uy tín được xếp trước trong hàng chờ", () => {
    expect(queuePriority(2)).toBeGreaterThan(queuePriority(0));
  });
});
