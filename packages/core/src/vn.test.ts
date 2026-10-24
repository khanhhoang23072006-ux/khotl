import { describe, expect, it } from "vitest";
import { looksLikeCourseCode, normalizeVietnamese, slugify, toPrefixTsQuery } from "./vn";

describe("normalizeVietnamese", () => {
  it("bỏ dấu, đổi đ thành d và về chữ thường", () => {
    expect(normalizeVietnamese("Đề thi Giải tích I")).toBe("de thi giai tich i");
    expect(normalizeVietnamese("Cấu trúc dữ liệu, Ưu tiên")).toBe("cau truc du lieu, uu tien");
  });

  it("gộp khoảng trắng thừa", () => {
    expect(normalizeVietnamese("  mạng   máy\ttính ")).toBe("mang may tinh");
  });

  it("chuỗi không dấu giữ nguyên ở dạng chữ thường", () => {
    expect(normalizeVietnamese("IT3011")).toBe("it3011");
  });
});

describe("slugify", () => {
  it("tạo slug ASCII từ tiêu đề tiếng Việt", () => {
    expect(slugify("Đề thi cuối kỳ IT3011 kỳ 20241, có đáp án")).toBe(
      "de-thi-cuoi-ky-it3011-ky-20241-co-dap-an",
    );
  });

  it("cắt theo độ dài và không để gạch nối ở cuối", () => {
    const slug = slugify("Bài giải Vật lý đại cương I chương một", 20);
    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("chuỗi không có ký tự hợp lệ trả về giá trị mặc định", () => {
    expect(slugify("!!!")).toBe("tai-lieu");
  });
});

describe("toPrefixTsQuery", () => {
  it("biến chuỗi đang gõ thành truy vấn tiền tố", () => {
    expect(toPrefixTsQuery("cấu tr")).toBe("cau:* & tr:*");
  });

  it("loại bỏ ký tự có thể chèn toán tử tsquery", () => {
    expect(toPrefixTsQuery("a | b & !c")).toBe("a:* & b:* & c:*");
  });

  it("trả về null khi không còn từ nào", () => {
    expect(toPrefixTsQuery("  !! ")).toBeNull();
  });
});

describe("looksLikeCourseCode", () => {
  it("nhận ra mã học phần", () => {
    expect(looksLikeCourseCode("IT3011")).toBe(true);
    expect(looksLikeCourseCode("ssh1111")).toBe(true);
    expect(looksLikeCourseCode("IT4409E")).toBe(true);
  });

  it("không nhầm từ khóa thường", () => {
    expect(looksLikeCourseCode("giai tich")).toBe(false);
    expect(looksLikeCourseCode("IT30")).toBe(false);
  });
});
