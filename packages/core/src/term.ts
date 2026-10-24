export type Locale = "vi" | "en";

/** Mã kỳ học HUST: năm bắt đầu năm học + số kỳ (1, 2, 3 = kỳ hè). Ví dụ 20251. */
export const TERM_PATTERN = /^\d{4}[1-3]$/;

export function isValidTerm(term: string): boolean {
  return TERM_PATTERN.test(term);
}

export function describeTerm(term: string, locale: Locale = "vi"): string {
  if (!isValidTerm(term)) return term;
  const year = Number(term.slice(0, 4));
  const semester = Number(term.slice(4));
  const span = `${year}–${year + 1}`;
  if (locale === "en") {
    return semester === 3 ? `Summer term ${span}` : `Semester ${semester}, ${span}`;
  }
  return semester === 3 ? `Kỳ hè ${span}` : `Kỳ ${semester} năm học ${span}`;
}

/** Kỳ học đang diễn ra: tháng 9–1 là kỳ 1, tháng 2–6 là kỳ 2, tháng 7–8 là kỳ hè. */
export function currentTerm(now: Date = new Date()): string {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 9) return `${year}1`;
  if (month === 1) return `${year - 1}1`;
  if (month <= 6) return `${year - 1}2`;
  return `${year - 1}3`;
}

/** Danh sách kỳ gần đây (mới nhất trước), dùng cho ô chọn kỳ khi upload. */
export function recentTerms(count = 12, now: Date = new Date()): string[] {
  const terms: string[] = [];
  let term = currentTerm(now);
  for (let i = 0; i < count; i++) {
    terms.push(term);
    term = previousTerm(term);
  }
  return terms;
}

export function previousTerm(term: string): string {
  const year = Number(term.slice(0, 4));
  const semester = Number(term.slice(4));
  if (semester === 1) return `${year - 1}3`;
  return `${year}${semester - 1}`;
}
