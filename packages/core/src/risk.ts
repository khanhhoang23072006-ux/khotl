import { normalizeVietnamese } from "./vn";

export interface ContentSignals {
  text: string;
  pageCount: number | null;
  /** true nếu file là PDF/Office đã chuyển PDF (có văn bản để đánh giá) */
  hasTextLayer: boolean;
  bannedWords: readonly string[];
}

export interface RiskResult {
  /** 0–100, càng cao càng cần xem kỹ */
  score: number;
  reasons: string[];
  linkCount: number;
  charCount: number;
}

export type RiskLevel = "low" | "medium" | "high";

const URL_PATTERN = /https?:\/\/[^\s)>\]]+/gi;
const SHORTENER_PATTERN =
  /\b(bit\.ly|tinyurl\.com|goo\.gl|t\.ly|shorturl\.at|cutt\.ly|rb\.gy|is\.gd)\b/i;
// Cụm hay gặp trong tài liệu "mồi" dẫn người đọc sang trang khác hoặc quảng cáo.
const SPAM_PHRASES = [
  "tai them tai",
  "tai full tai",
  "link tai",
  "lien he zalo",
  "inbox de nhan",
  "mua tai lieu",
  "nhan lam bai",
];

/**
 * Chấm điểm rủi ro nội dung bằng các tín hiệu đơn giản. Điểm chỉ dùng để xếp hàng chờ
 * và gợi ý cho kiểm duyệt viên, không tự từ chối tài liệu.
 */
export function assessContentRisk(signals: ContentSignals): RiskResult {
  const reasons: string[] = [];
  let score = 0;

  const links = signals.text.match(URL_PATTERN) ?? [];
  const linkCount = links.length;
  if (linkCount > 10) {
    score += 35;
    reasons.push(`Nhiều liên kết ngoài (${linkCount})`);
  } else if (linkCount >= 4) {
    score += 15;
    reasons.push(`Có ${linkCount} liên kết ngoài`);
  }

  if (links.some((link) => SHORTENER_PATTERN.test(link))) {
    score += 20;
    reasons.push("Có link rút gọn");
  }

  const normalized = normalizeVietnamese(signals.text);
  const spamHits = SPAM_PHRASES.filter((phrase) => normalized.includes(phrase));
  if (spamHits.length > 0) {
    score += 15;
    reasons.push("Có cụm từ quảng cáo hoặc dẫn link");
  }

  const bannedHits = signals.bannedWords
    .map((word) => normalizeVietnamese(word))
    .filter((word) => word.length > 0 && containsWord(normalized, word));
  if (bannedHits.length > 0) {
    score += Math.min(60, 40 * bannedHits.length);
    reasons.push(`Có từ ngữ không phù hợp (${bannedHits.length})`);
  }

  const charCount = signals.text.trim().length;
  if (signals.hasTextLayer && signals.pageCount && signals.pageCount > 0) {
    const perPage = charCount / signals.pageCount;
    if (perPage < 50) {
      score += 10;
      reasons.push("Rất ít chữ, có thể là ảnh scan");
    }
  }

  return { score: Math.min(100, score), reasons, linkCount, charCount };
}

export function riskLevel(score: number): RiskLevel {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function containsWord(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}
