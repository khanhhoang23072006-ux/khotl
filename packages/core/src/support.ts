import { z } from "zod";

/** Loại phiếu góp ý, báo lỗi. Trùng enum FeedbackKind trong Prisma. */
export const FEEDBACK_KINDS = ["BUG", "ACCOUNT", "CONTENT", "IDEA", "OTHER"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ["OPEN", "ANSWERED", "CLOSED"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/**
 * Thời gian phản hồi dự kiến (giờ) theo loại phiếu. Hiện cho người gửi và dùng
 * để đánh dấu phiếu quá hạn trong trang quản trị.
 */
export const FEEDBACK_SLA_HOURS: Record<FeedbackKind, number> = {
  BUG: 24,
  ACCOUNT: 24,
  CONTENT: 48,
  IDEA: 72,
  OTHER: 72,
};

/** Hạn phản hồi của một phiếu. */
export function feedbackDueAt(kind: FeedbackKind, createdAt: Date): Date {
  return new Date(createdAt.getTime() + FEEDBACK_SLA_HOURS[kind] * 3600_000);
}

/** Phiếu còn mở và đã quá hạn phản hồi. */
export function isFeedbackOverdue(item: { kind: FeedbackKind; status: FeedbackStatus; createdAt: Date }, now = new Date()): boolean {
  return item.status === "OPEN" && feedbackDueAt(item.kind, item.createdAt).getTime() < now.getTime();
}

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // bỏ 0, 1, I, O cho dễ đọc

/** Mã phiếu dạng GY-7K3Q9P: ngắn, đọc qua điện thoại được, không đoán ra thứ tự. */
export function feedbackCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return `GY-${out}`;
}

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS, { message: "Chọn loại góp ý" }),
  subject: z.string().trim().min(5, "Tiêu đề ít nhất 5 ký tự").max(150),
  body: z.string().trim().min(20, "Mô tả ít nhất 20 ký tự").max(5000),
  email: z.email("Email không hợp lệ").max(200),
  pageUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined)),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

export const feedbackReplySchema = z.object({
  id: z.string().min(1),
  reply: z.string().trim().min(5, "Trả lời ít nhất 5 ký tự").max(5000),
  close: z.boolean().default(false),
});
export type FeedbackReplyInput = z.infer<typeof feedbackReplySchema>;
