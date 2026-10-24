import { describe, expect, it } from "vitest";
import {
  detectedTypeMatches,
  maxUploadBytes,
  uploadRuleForFile,
} from "./document-types";
import { isAllowedEmail, parseDomains, suggestUsername } from "./email";
import { formatBytes, formatCount, vietnamDay } from "./format";
import { normalizeTagInput, suggestTags } from "./tags";
import { moderationDecisionSchema, searchQuerySchema, uploadSubmitSchema } from "./validators";

describe("email trường", () => {
  const domains = parseDomains("sis.hust.edu.vn, @hust.edu.vn");

  it("chỉ chấp nhận đúng domain", () => {
    expect(isAllowedEmail("anh.vd190001@sis.hust.edu.vn", domains)).toBe(true);
    expect(isAllowedEmail("gv@hust.edu.vn", domains)).toBe(true);
    expect(isAllowedEmail("x@gmail.com", domains)).toBe(false);
    expect(isAllowedEmail("x@evil.sis.hust.edu.vn", domains)).toBe(false);
    expect(isAllowedEmail("khong-co-a-cong", domains)).toBe(false);
  });

  it("gợi ý username từ email", () => {
    expect(suggestUsername("Anh.VD190001@sis.hust.edu.vn")).toBe("anh.vd190001");
    expect(suggestUsername("a@hust.edu.vn").length).toBeGreaterThanOrEqual(3);
  });
});

describe("loại file", () => {
  it("nhận đuôi hợp lệ, từ chối SVG và Office cũ", () => {
    expect(uploadRuleForFile("De-Thi.PDF")?.kind).toBe("PDF");
    expect(uploadRuleForFile("slide.pptx")?.kind).toBe("PPTX");
    expect(uploadRuleForFile("logo.svg")).toBeNull();
    expect(uploadRuleForFile("bai.doc")).toBeNull();
  });

  it("đối chiếu magic bytes với đuôi khai báo", () => {
    expect(detectedTypeMatches("PDF", "pdf")).toBe(true);
    expect(detectedTypeMatches("DOCX", "zip")).toBe(false);
    expect(detectedTypeMatches("IMAGE", "png")).toBe(true);
    expect(detectedTypeMatches("PDF", undefined)).toBe(false);
  });

  it("ZIP có giới hạn dung lượng riêng", () => {
    const limits = { maxMb: 50, zipMaxMb: 100 };
    expect(maxUploadBytes("PDF", limits)).toBe(50 * 1024 * 1024);
    expect(maxUploadBytes("ZIP", limits)).toBe(100 * 1024 * 1024);
  });
});

describe("định dạng số", () => {
  it("rút gọn số lượt", () => {
    expect(formatCount(860)).toBe("860");
    expect(formatCount(1234)).toBe("1,2k");
    expect(formatCount(1234, "en")).toBe("1.2k");
    expect(formatCount(2000)).toBe("2k");
  });

  it("hiển thị dung lượng", () => {
    expect(formatBytes(2.4 * 1024 * 1024)).toBe("2,4 MB");
  });

  it("lấy ngày theo giờ Việt Nam", () => {
    // 23:30 UTC ngày 1 là 06:30 sáng ngày 2 ở Việt Nam
    expect(vietnamDay(new Date("2026-10-01T23:30:00Z")).toISOString()).toBe(
      "2026-10-02T00:00:00.000Z",
    );
  });
});

describe("tag", () => {
  it("gợi ý cụm hai âm tiết lặp lại và nhận ra đáp án", () => {
    const text = "Đáp án. Cây nhị phân là cây mà mỗi nút có hai con. ".repeat(4);
    const tags = suggestTags(text);
    expect(tags.map((tag) => tag.slug)).toContain("dap-an");
    expect(tags.map((tag) => tag.slug)).toContain("nhi-phan");
  });

  it("chuẩn hóa tag người dùng nhập", () => {
    expect(normalizeTagInput("  #Ôn   Thi ")).toEqual({ name: "ôn thi", slug: "on-thi" });
    expect(normalizeTagInput("a")).toBeNull();
  });
});

describe("validators", () => {
  it("bắt buộc xác nhận bản quyền khi gửi tài liệu", () => {
    const result = uploadSubmitSchema.safeParse({
      token: "x".repeat(30),
      courseId: "c1",
      type: "EXAM_FINAL",
      title: "Đề thi cuối kỳ",
      copyrightAccepted: false,
    });
    expect(result.success).toBe(false);
  });

  it("từ chối cần lý do, duyệt thì không", () => {
    expect(
      moderationDecisionSchema.safeParse({ documentIds: ["a"], decision: "APPROVE" }).success,
    ).toBe(true);
    expect(
      moderationDecisionSchema.safeParse({ documentIds: ["a"], decision: "REJECT" }).success,
    ).toBe(false);
  });

  it("tham số tìm kiếm sai được thay bằng mặc định thay vì báo lỗi", () => {
    const query = searchQuerySchema.parse({ q: " giai tich ", sort: "abc", page: "-3" });
    expect(query).toMatchObject({ q: "giai tich", sort: "relevance", page: 1 });
  });
});
