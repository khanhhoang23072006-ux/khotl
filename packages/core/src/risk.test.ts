import { describe, expect, it } from "vitest";
import { assessContentRisk, riskLevel } from "./risk";

const base = { pageCount: 4, hasTextLayer: true, bannedWords: [] as string[] };
const lecture =
  "Chương 3. Cây nhị phân tìm kiếm. Định nghĩa: mỗi nút có tối đa hai con. ".repeat(20);

describe("assessContentRisk", () => {
  it("tài liệu học tập bình thường có rủi ro thấp", () => {
    const result = assessContentRisk({ ...base, text: lecture });
    expect(result.score).toBe(0);
    expect(riskLevel(result.score)).toBe("low");
  });

  it("nhiều liên kết và link rút gọn làm tăng rủi ro", () => {
    const links = Array.from({ length: 12 }, (_, i) => `https://example.com/${i}`).join(" ");
    const result = assessContentRisk({ ...base, text: `${lecture} ${links} https://bit.ly/abc` });
    expect(result.linkCount).toBe(13);
    expect(result.score).toBeGreaterThanOrEqual(55);
  });

  it("phát hiện cụm quảng cáo không phụ thuộc dấu", () => {
    const result = assessContentRisk({ ...base, text: `${lecture} Tải FULL tại đây, liên hệ Zalo` });
    expect(result.reasons).toContain("Có cụm từ quảng cáo hoặc dẫn link");
  });

  it("từ cấm làm điểm rủi ro cao", () => {
    const result = assessContentRisk({ ...base, text: `${lecture} cá độ`, bannedWords: ["cá độ"] });
    expect(riskLevel(result.score)).not.toBe("low");
  });

  it("không bắt nhầm từ cấm nằm trong từ khác", () => {
    const result = assessContentRisk({
      ...base,
      pageCount: null,
      text: "phương pháp xác định",
      bannedWords: ["xa"],
    });
    expect(result.score).toBe(0);
  });

  it("ít chữ mỗi trang được đánh dấu là có thể là bản scan", () => {
    const result = assessContentRisk({ ...base, text: "Trang 1", pageCount: 10 });
    expect(result.reasons).toContain("Rất ít chữ, có thể là ảnh scan");
  });
});
