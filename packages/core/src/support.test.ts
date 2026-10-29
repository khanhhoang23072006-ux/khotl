import { describe, expect, it } from "vitest";
import { feedbackCode, feedbackDueAt, feedbackSchema, isFeedbackOverdue } from "./support";

describe("góp ý, báo lỗi", () => {
  it("mã phiếu dạng GY- và 6 ký tự dễ đọc", () => {
    const code = feedbackCode();
    expect(code).toMatch(/^GY-[2-9A-HJ-NP-Z]{6}$/);
  });

  it("hạn phản hồi theo loại phiếu", () => {
    const created = new Date("2026-10-29T10:00:00Z");
    expect(feedbackDueAt("BUG", created).toISOString()).toBe("2026-10-30T10:00:00.000Z");
    expect(feedbackDueAt("IDEA", created).toISOString()).toBe("2026-11-01T10:00:00.000Z");
  });

  it("chỉ phiếu đang mở mới bị tính quá hạn", () => {
    const created = new Date("2026-10-01T00:00:00Z");
    const now = new Date("2026-10-29T00:00:00Z");
    expect(isFeedbackOverdue({ kind: "BUG", status: "OPEN", createdAt: created }, now)).toBe(true);
    expect(isFeedbackOverdue({ kind: "BUG", status: "ANSWERED", createdAt: created }, now)).toBe(false);
    expect(isFeedbackOverdue({ kind: "BUG", status: "OPEN", createdAt: now }, now)).toBe(false);
  });

  it("kiểm tra nội dung phiếu", () => {
    expect(feedbackSchema.safeParse({ kind: "BUG", subject: "Lỗi", body: "ngắn", email: "x" }).success).toBe(false);
    const ok = feedbackSchema.safeParse({ kind: "BUG", subject: "Không tải được PDF", body: "Bấm tải xuống thì báo lỗi 500 ở trang tài liệu MI1111.", email: "a@sis.hust.edu.vn", pageUrl: "" });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.pageUrl).toBeUndefined();
  });
});
