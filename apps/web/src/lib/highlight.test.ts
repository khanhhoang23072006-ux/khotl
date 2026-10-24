import { describe, expect, it } from "vitest";
import { highlightSegments, queryTerms } from "./highlight";

describe("queryTerms", () => {
  it("bỏ dấu, bỏ toán tử và token ngắn", () => {
    expect(queryTerms('Giải tích -"đề thi" a')).toEqual(["giai", "tich"]);
    expect(queryTerms('đề thi "giải tích" -slide')).toEqual(["giai", "tich", "thi", "de"]);
  });
});

describe("highlightSegments", () => {
  it("khớp không dấu với chuỗi có dấu", () => {
    expect(highlightSegments("Đề thi Giải tích I", ["giai", "tich"])).toEqual([
      { text: "Đề thi ", match: false },
      { text: "Giải", match: true },
      { text: " ", match: false },
      { text: "tích", match: true },
      { text: " I", match: false },
    ]);
  });

  it("chỉ khớp đầu từ", () => {
    expect(highlightSegments("Toán an toàn", ["an"])).toEqual([
      { text: "Toán ", match: false },
      { text: "an", match: true },
      { text: " toàn", match: false },
    ]);
  });

  it("không có từ khóa thì trả nguyên chuỗi", () => {
    expect(highlightSegments("abc", [])).toEqual([{ text: "abc", match: false }]);
  });
});
