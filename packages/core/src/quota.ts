/**
 * Bậc uy tín: 0 = mới, 1 = thường, 2 = uy tín, 3 = rất uy tín.
 * Quyết định hạn mức upload mỗi ngày và độ ưu tiên trong hàng chờ kiểm duyệt.
 * Các ngưỡng là mặc định; Giai đoạn 2 sẽ cho admin chỉnh trong SystemSetting.
 */
export interface TrustInput {
  approvedCount: number;
  violationCount: number;
}

export function computeTrustLevel({ approvedCount, violationCount }: TrustInput): number {
  if (violationCount >= 3) return 0;
  if (approvedCount >= 30 && violationCount === 0) return 3;
  if (approvedCount >= 10) return 2;
  if (approvedCount >= 3) return 1;
  return 0;
}

const DAILY_UPLOAD_LIMITS = [3, 10, 30, 50] as const;

export function dailyUploadLimit(trustLevel: number): number {
  const level = Math.min(Math.max(Math.trunc(trustLevel), 0), DAILY_UPLOAD_LIMITS.length - 1);
  return DAILY_UPLOAD_LIMITS[level] ?? DAILY_UPLOAD_LIMITS[0];
}

/** Độ ưu tiên trong hàng chờ: người uy tín được xếp trước. */
export function queuePriority(trustLevel: number): number {
  return Math.max(0, Math.trunc(trustLevel)) * 10;
}

/** Điểm uy tín cộng khi tài liệu được duyệt. */
export const REPUTATION_FOR_APPROVAL = 10;
