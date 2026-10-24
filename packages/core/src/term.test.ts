import { describe, expect, it } from "vitest";
import { currentTerm, describeTerm, isValidTerm, previousTerm, recentTerms } from "./term";

describe("mã kỳ học", () => {
  it("kiểm tra định dạng", () => {
    expect(isValidTerm("20251")).toBe(true);
    expect(isValidTerm("20253")).toBe(true);
    expect(isValidTerm("20254")).toBe(false);
    expect(isValidTerm("2025")).toBe(false);
  });

  it("mô tả kỳ học", () => {
    expect(describeTerm("20241")).toBe("Kỳ 1 năm học 2024–2025");
    expect(describeTerm("20243")).toBe("Kỳ hè 2024–2025");
    expect(describeTerm("20242", "en")).toBe("Semester 2, 2024–2025");
  });

  it("xác định kỳ hiện tại theo tháng", () => {
    expect(currentTerm(new Date(2026, 9, 24))).toBe("20261");
    expect(currentTerm(new Date(2027, 0, 10))).toBe("20261");
    expect(currentTerm(new Date(2027, 2, 1))).toBe("20262");
    expect(currentTerm(new Date(2027, 6, 15))).toBe("20263");
  });

  it("lùi kỳ đúng thứ tự 1 ← hè năm trước ← 2", () => {
    expect(previousTerm("20251")).toBe("20243");
    expect(previousTerm("20243")).toBe("20242");
    expect(previousTerm("20242")).toBe("20241");
  });

  it("liệt kê các kỳ gần đây, mới nhất trước", () => {
    expect(recentTerms(4, new Date(2026, 9, 24))).toEqual(["20261", "20253", "20252", "20251"]);
  });
});
