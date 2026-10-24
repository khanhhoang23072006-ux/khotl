/**
 * Chuẩn hóa tiếng Việt cho tìm kiếm: chữ thường, bỏ dấu, "đ" → "d", gộp khoảng trắng.
 * Phải cho kết quả giống hàm SQL vn_norm() để truy vấn và dữ liệu khớp nhau.
 */
export function normalizeVietnamese(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Tạo slug ASCII cho URL từ tiêu đề tiếng Việt. */
export function slugify(input: string, maxLength = 80): string {
  const base = normalizeVietnamese(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const trimmed = base.slice(0, maxLength).replace(/-+$/g, "");
  return trimmed || "tai-lieu";
}

/**
 * Biến chuỗi người dùng đang gõ thành tsquery tiền tố an toàn, ví dụ "cau tr" → "cau:* & tr:*".
 * Chỉ giữ [a-z0-9] nên không thể chèn toán tử tsquery.
 */
export function toPrefixTsQuery(input: string): string | null {
  const tokens = normalizeVietnamese(input)
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 6);
  if (tokens.length === 0) return null;
  return tokens.map((token) => `${token}:*`).join(" & ");
}

/** Mã học phần HUST: 2–4 chữ cái + 4 chữ số, có thể thêm một chữ cái (IT3011, MI1111, SSH1111, IT4409E). */
export const COURSE_CODE_PATTERN = /^[A-Z]{2,4}\d{4}[A-Z]?$/;

export function looksLikeCourseCode(input: string): boolean {
  return COURSE_CODE_PATTERN.test(input.trim().toUpperCase());
}
