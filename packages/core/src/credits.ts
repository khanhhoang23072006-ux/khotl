import { normalizeVietnamese } from "./vn";

/**
 * Hạn mức tải xuống và lượt thưởng.
 * Mỗi sinh viên có `dailyFree` lượt miễn phí mỗi ngày (reset 00:00 giờ Việt Nam). Hết lượt miễn phí thì
 * trừ vào lượt thưởng, kiếm được khi tài liệu mình đăng được DUYỆT. Lượt thưởng cộng dồn nhưng hết hạn
 * sau `creditTtlDays` ngày; dùng lô sắp hết hạn trước.
 * Mọi giá trị nằm trong SystemSetting (khóa CREDIT_SETTINGS_KEY) để admin chỉnh không cần deploy.
 */
export interface CreditSettings {
  /** lượt tải miễn phí mỗi ngày */
  dailyFree: number;
  /** lượt thưởng khi một tài liệu được duyệt */
  uploadReward: number;
  /** cứ mỗi bấy nhiêu lượt tải (người khác tải, không tính tải lại) thì người đăng được thưởng */
  milestoneEvery: number;
  milestoneReward: number;
  /** học phần có ít hơn bấy nhiêu tài liệu đã duyệt được coi là đang thiếu */
  scarceCourseThreshold: number;
  scarceCourseBonus: number;
  /** bình luận đạt bấy nhiêu lượt thích thì người viết được thưởng (một lần mỗi bình luận) */
  helpfulCommentLikes: number;
  helpfulCommentReward: number;
  /** tối đa lượt thưởng kiếm được mỗi ngày, chống farm */
  dailyEarnCap: number;
  /** lượt thưởng hết hạn sau bấy nhiêu ngày */
  creditTtlDays: number;
  /** tải lại cùng tài liệu trong khoảng này không bị trừ */
  redownloadWindowHours: number;
  /** giới hạn số lần gọi API tải mỗi giờ */
  rateLimitPerHourUser: number;
  rateLimitPerHourIp: number;
  rateLimitPerHourDevice: number;
  /** link tải dùng một lần, hết hạn sau bấy nhiêu giây */
  linkTtlSeconds: number;
  /** một thiết bị đăng nhập bấy nhiêu tài khoản trong 30 ngày thì tạm dừng cộng thưởng cho các tài khoản đó */
  multiAccountThreshold: number;
  /** bị gỡ tài liệu vì vi phạm bấy nhiêu lần thì khóa cơ chế thưởng */
  violationLockThreshold: number;
}

export const CREDIT_SETTINGS_KEY = "downloads.credits";

export const DEFAULT_CREDIT_SETTINGS: CreditSettings = {
  dailyFree: 10,
  uploadReward: 5,
  milestoneEvery: 20,
  milestoneReward: 1,
  scarceCourseThreshold: 5,
  scarceCourseBonus: 3,
  helpfulCommentLikes: 5,
  helpfulCommentReward: 1,
  dailyEarnCap: 30,
  creditTtlDays: 90,
  redownloadWindowHours: 24,
  rateLimitPerHourUser: 60,
  rateLimitPerHourIp: 120,
  rateLimitPerHourDevice: 60,
  linkTtlSeconds: 60,
  multiAccountThreshold: 3,
  violationLockThreshold: 3,
};

/** Giới hạn hợp lệ cho từng giá trị, dùng cho form quản trị và khi đọc từ DB. */
export const CREDIT_SETTINGS_BOUNDS: Record<keyof CreditSettings, [number, number]> = {
  dailyFree: [0, 1000],
  uploadReward: [0, 100],
  milestoneEvery: [1, 100000],
  milestoneReward: [0, 100],
  scarceCourseThreshold: [0, 1000],
  scarceCourseBonus: [0, 100],
  helpfulCommentLikes: [1, 1000],
  helpfulCommentReward: [0, 100],
  dailyEarnCap: [0, 10000],
  creditTtlDays: [1, 3650],
  redownloadWindowHours: [0, 720],
  rateLimitPerHourUser: [1, 100000],
  rateLimitPerHourIp: [1, 100000],
  rateLimitPerHourDevice: [1, 100000],
  linkTtlSeconds: [10, 3600],
  multiAccountThreshold: [2, 100],
  violationLockThreshold: [1, 100],
};

/** Đọc cấu hình từ JSON trong DB: thiếu hoặc sai kiểu thì dùng mặc định, vượt giới hạn thì kẹp lại. */
export function parseCreditSettings(value: unknown): CreditSettings {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const result = { ...DEFAULT_CREDIT_SETTINGS };
  for (const key of Object.keys(DEFAULT_CREDIT_SETTINGS) as (keyof CreditSettings)[]) {
    const raw = source[key];
    const number = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (typeof number === "number" && Number.isFinite(number)) {
      const [min, max] = CREDIT_SETTINGS_BOUNDS[key];
      result[key] = Math.min(max, Math.max(min, Math.trunc(number)));
    }
  }
  return result;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** 00:00 giờ Việt Nam kế tiếp (thời điểm lượt miễn phí được làm mới). Việt Nam không đổi giờ theo mùa. */
export function nextVietnamMidnight(now: Date = new Date()): Date {
  const local = now.getTime() + VN_OFFSET_MS;
  const day = Math.floor(local / 86_400_000) + 1;
  return new Date(day * 86_400_000 - VN_OFFSET_MS);
}

/** Đầu ngày giờ Việt Nam chứa `now`, dạng mốc thời gian thật (UTC). */
export function startOfVietnamDay(now: Date = new Date()): Date {
  return new Date(nextVietnamMidnight(now).getTime() - 86_400_000);
}

export function creditExpiry(now: Date, settings: Pick<CreditSettings, "creditTtlDays">): Date {
  return new Date(now.getTime() + settings.creditTtlDays * 86_400_000);
}

/** Số lượt thưởng thực sự được cộng sau khi áp trần mỗi ngày. */
export function capGrant(requested: number, earnedToday: number, dailyCap: number): number {
  if (requested <= 0) return 0;
  return Math.max(0, Math.min(requested, dailyCap - earnedToday));
}

/** Một lô lượt thưởng còn dùng được. */
export interface CreditLot {
  id: bigint | number | string;
  remaining: number;
  expiresAt: Date | null;
}

/** Lô sắp hết hạn được dùng trước; lô không hạn dùng sau cùng. */
export function sortLotsForSpending<T extends CreditLot>(lots: T[]): T[] {
  return [...lots].sort((a, b) => {
    const ta = a.expiresAt ? a.expiresAt.getTime() : Number.POSITIVE_INFINITY;
    const tb = b.expiresAt ? b.expiresAt.getTime() : Number.POSITIVE_INFINITY;
    return ta - tb;
  });
}

/** Lấy `amount` lượt từ các lô theo thứ tự; trả về phần lấy được ở từng lô và phần thiếu. */
export function takeFromLots<T extends CreditLot>(
  lots: T[],
  amount: number,
): { takes: { lot: T; take: number }[]; shortfall: number } {
  let left = amount;
  const takes: { lot: T; take: number }[] = [];
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(lot.remaining, left);
    if (take > 0) {
      takes.push({ lot, take });
      left -= take;
    }
  }
  return { takes, shortfall: Math.max(0, left) };
}

export type ChargeDecision = "REPEAT" | "FREE" | "BONUS" | "DENIED";

/** Thứ tự trừ: tải lại trong 24 giờ thì miễn phí, rồi lượt miễn phí trong ngày, rồi lượt thưởng. */
export function decideCharge(input: {
  repeatWithinWindow: boolean;
  usedToday: number;
  dailyFree: number;
  bonusBalance: number;
}): ChargeDecision {
  if (input.repeatWithinWindow) return "REPEAT";
  if (input.usedToday < input.dailyFree) return "FREE";
  if (input.bonusBalance > 0) return "BONUS";
  return "DENIED";
}

/** Các mốc lượt tải mới vượt qua khi số lượt tải tăng từ `before` lên `after`. */
export function crossedMilestones(before: number, after: number, every: number): number[] {
  if (every <= 0) return [];
  const result: number[] = [];
  for (let mark = (Math.floor(before / every) + 1) * every; mark <= after; mark += every) {
    result.push(mark);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Phát hiện nội dung gần giống (SimHash 64 bit trên cụm 5 từ đã bỏ dấu)
// ---------------------------------------------------------------------------

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = (1n << 64n) - 1n;

function fnv1a64(input: string): bigint {
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK64;
  }
  return hash;
}

/** Số ký tự chữ tối thiểu để SimHash đủ tin cậy; ngắn hơn thì không so khớp gần giống. */
export const SIMHASH_MIN_CHARS = 400;

/**
 * SimHash của văn bản, trả về số có dấu 64 bit (vừa cột BIGINT của Postgres).
 * Trả về null khi văn bản quá ngắn để so sánh.
 */
export function simhash(text: string, shingleSize = 5): bigint | null {
  const words = normalizeVietnamese(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
  if (words.join("").length < SIMHASH_MIN_CHARS || words.length < shingleSize) return null;
  const weights = new Array<number>(64).fill(0);
  for (let i = 0; i + shingleSize <= words.length; i++) {
    const hash = fnv1a64(words.slice(i, i + shingleSize).join(" "));
    for (let bit = 0; bit < 64; bit++) {
      weights[bit] = (weights[bit] ?? 0) + (((hash >> BigInt(bit)) & 1n) === 1n ? 1 : -1);
    }
  }
  let result = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if ((weights[bit] ?? 0) > 0) result |= 1n << BigInt(bit);
  }
  return BigInt.asIntN(64, result);
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = BigInt.asUintN(64, a ^ b);
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/** Hai tài liệu coi là gần giống khi SimHash lệch không quá ngần này bit. */
export const NEAR_DUPLICATE_MAX_DISTANCE = 3;

/**
 * Tài liệu trống hoặc quá ngắn: file có lớp chữ nhưng gần như không có chữ, chỉ 1 trang.
 * Ảnh và bản scan (không có lớp chữ) không bị loại theo quy tắc này mà để kiểm duyệt viên xem.
 */
export function isTooShort(input: { text: string; pageCount: number | null; hasTextLayer: boolean }): boolean {
  if (!input.hasTextLayer) return false;
  const letters = input.text.replace(/\s+/g, "").length;
  return (input.pageCount ?? 1) <= 1 && letters < 80;
}
