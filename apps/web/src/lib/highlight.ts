import { normalizeVietnamese } from "@khotl/core";

export interface Segment {
  text: string;
  match: boolean;
}

/** Bỏ dấu từng ký tự (giữ nguyên độ dài) để vị trí trong chuỗi chuẩn hóa khớp với chuỗi gốc. */
function foldChars(text: string): string {
  let result = "";
  for (const char of text) {
    const folded = normalizeVietnamese(char);
    // Ký tự khoảng trắng hoặc ký tự bị bỏ hẳn: giữ một ký tự để không lệch vị trí
    result += folded.length === 1 ? folded : folded.length === 0 ? " " : char.toLowerCase();
  }
  return result;
}

/** Tách từ khóa tìm kiếm thành các token đã chuẩn hóa, bỏ token quá ngắn và toán tử. */
export function queryTerms(query: string): string[] {
  // Bỏ phần bị loại trừ (-"cụm từ", -từ) vì kết quả không chứa chúng
  const positive = query.replace(/-"[^"]*"/g, " ").replace(/(^|\s)-\S+/g, " ");
  const tokens = normalizeVietnamese(positive)
    .replace(/"/g, " ")
    .split(" ")
    .filter((token) => token && token !== "or")
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 2);
  return [...new Set(tokens)].sort((a, b) => b.length - a.length);
}

/**
 * Chia chuỗi thành các đoạn có/không khớp từ khóa, so khớp không phân biệt dấu.
 * Chỉ khớp ở đầu từ để "an" không tô sáng giữa chữ "toan".
 */
export function highlightSegments(text: string, terms: readonly string[]): Segment[] {
  if (!text || terms.length === 0) return [{ text, match: false }];
  const chars = Array.from(text);
  const folded = Array.from(foldChars(text));
  if (folded.length !== chars.length) return [{ text, match: false }];
  const marks = new Array<boolean>(chars.length).fill(false);
  const haystack = folded.join("");

  for (const term of terms) {
    let from = 0;
    while (from <= haystack.length - term.length) {
      const index = haystack.indexOf(term, from);
      if (index === -1) break;
      const before = index === 0 ? " " : (haystack[index - 1] ?? " ");
      if (!/[a-z0-9]/.test(before)) {
        for (let i = index; i < index + term.length; i++) marks[i] = true;
      }
      from = index + 1;
    }
  }

  const segments: Segment[] = [];
  for (let i = 0; i < chars.length; i++) {
    const match = marks[i] ?? false;
    const last = segments[segments.length - 1];
    if (last && last.match === match) last.text += chars[i];
    else segments.push({ text: chars[i] ?? "", match });
  }
  return segments;
}
