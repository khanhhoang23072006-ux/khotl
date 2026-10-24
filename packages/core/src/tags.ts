import { normalizeVietnamese, slugify } from "./vn";

// Từ dừng tiếng Việt (đã bỏ dấu) xuất hiện nhiều nhưng không mang chủ đề.
const STOPWORDS = new Set(
  [
    "va", "cua", "cho", "cac", "nhung", "mot", "la", "co", "khong", "duoc", "trong", "voi",
    "nay", "do", "the", "thi", "ma", "nen", "neu", "khi", "de", "tu", "den", "theo", "tren",
    "duoi", "ve", "ra", "vao", "len", "xuong", "bang", "nhu", "hay", "hoac", "tai", "sau",
    "truoc", "da", "dang", "se", "can", "phai", "moi", "nhieu", "it", "rat", "cung", "con",
    "ta", "ban", "toi", "chung", "ho", "no", "gi", "nao", "sao", "bao", "trang", "cau",
    "bai", "hinh", "ham", "so", "gia", "tri", "x", "y", "n", "i", "a", "b", "c", "d",
  ],
);

export interface TagSuggestion {
  name: string;
  slug: string;
}

/**
 * Gợi ý tag từ văn bản trích xuất: lấy các cụm hai âm tiết xuất hiện nhiều nhất
 * (phần lớn từ ghép tiếng Việt có hai âm tiết, ví dụ "cây nhị phân" → "nhị phân").
 */
export function suggestTags(text: string, max = 5): TagSuggestion[] {
  // Tách theo dấu câu trước để không ghép âm tiết của hai câu khác nhau.
  const segments = text
    .slice(0, 200_000)
    .toLowerCase()
    .split(/[.,;:!?()[\]{}"“”'\n\r\t–—-]+/u);

  const counts = new Map<string, { count: number; display: string }>();
  for (const segment of segments) {
    const words = segment.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length - 1; i++) {
      const first = words[i] ?? "";
      const second = words[i + 1] ?? "";
      const a = normalizeVietnamese(first);
      const b = normalizeVietnamese(second);
      if (!isMeaningful(a) || !isMeaningful(b)) continue;
      const key = `${a} ${b}`;
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { count: 1, display: `${first} ${second}` });
    }
  }

  const result: TagSuggestion[] = [];
  if (/\b(dap an|loi giai|huong dan giai)\b/.test(normalizeVietnamese(text))) {
    result.push({ name: "đáp án", slug: "dap-an" });
  }

  const ranked = [...counts.values()]
    .filter((entry) => entry.count >= 3)
    .sort((x, y) => y.count - x.count);
  for (const entry of ranked) {
    if (result.length >= max) break;
    const slug = slugify(entry.display);
    if (!result.some((tag) => tag.slug === slug)) {
      result.push({ name: entry.display, slug });
    }
  }
  return result.slice(0, max);
}

/** Chuẩn hóa tag người dùng nhập: chữ thường, gọn khoảng trắng, bỏ dấu # ở đầu. */
export function normalizeTagInput(raw: string): TagSuggestion | null {
  const name = raw.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 40);
  if (name.length < 2) return null;
  return { name, slug: slugify(name, 40) };
}

function isMeaningful(token: string): boolean {
  if (token.length < 2) return false;
  if (/^\d+$/.test(token)) return false;
  return !STOPWORDS.has(token);
}
