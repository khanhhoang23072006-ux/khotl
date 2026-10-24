export function parseDomains(csv: string): string[] {
  return csv
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/** Chỉ chấp nhận email có domain đúng bằng một domain trong danh sách (không nhận subdomain lạ). */
export function isAllowedEmail(email: string, domains: readonly string[]): boolean {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domains.includes(domain);
}

/** Gợi ý username từ phần trước @ của email trường, ví dụ "anh.vd190001" → "anh.vd190001". */
export function suggestUsername(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 24);
  return cleaned.length >= 3 ? cleaned : `sv${cleaned}`.padEnd(3, "0");
}

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,30}$/;
