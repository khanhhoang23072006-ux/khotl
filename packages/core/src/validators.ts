import { z } from "zod";
import { DOCUMENT_TYPES, FILE_KINDS } from "./document-types";
import { USERNAME_PATTERN } from "./email";
import { REPORT_REASONS } from "./reasons";
import { TERM_PATTERN } from "./term";
import { COURSE_CODE_PATTERN } from "./vn";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const uploadStartSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  fileSize: z.number().int().positive(),
});
export type UploadStartInput = z.infer<typeof uploadStartSchema>;

export const uploadSubmitSchema = z.object({
  token: z.string().min(20),
  courseId: z.string().min(1, "Chọn học phần"),
  type: z.enum(DOCUMENT_TYPES),
  term: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || TERM_PATTERN.test(value), "Mã kỳ dạng 20251")
    .transform((value) => (value ? value : undefined)),
  title: z.string().trim().min(5, "Tiêu đề quá ngắn").max(200),
  description: optionalText(2000),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  isAnonymous: z.boolean().default(false),
  copyrightAccepted: z.literal(true, { message: "Cần xác nhận quyền chia sẻ" }),
});
export type UploadSubmitInput = z.infer<typeof uploadSubmitSchema>;

export const moderationDecisionSchema = z
  .object({
    documentIds: z.array(z.string().min(1)).min(1).max(50),
    decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES"]),
    reason: optionalText(1000),
    internalNote: optionalText(2000),
  })
  .refine((data) => data.decision === "APPROVE" || Boolean(data.reason), {
    message: "Cần ghi lý do để người đăng biết",
    path: ["reason"],
  });
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;

export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_PATTERN, "3–30 ký tự: chữ thường, số, dấu chấm, gạch dưới"),
  displayName: optionalText(60),
  facultyId: z.string().min(1, "Chọn Viện/Trường"),
  cohort: z.coerce.number().int().min(40, "Khóa từ K40").max(99),
  studentCode: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{8}$/.test(value), "Mã sinh viên gồm 8 chữ số")
    .transform((value) => (value ? value : undefined)),
  acceptTerms: z.literal(true, { message: "Cần đồng ý điều khoản" }),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const SEARCH_SORTS = ["relevance", "newest", "popular", "rating"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).catch(""),
  faculty: z.string().trim().max(40).optional().catch(undefined),
  course: z.string().trim().max(40).optional().catch(undefined),
  type: z.enum(DOCUMENT_TYPES).optional().catch(undefined),
  term: z.string().regex(TERM_PATTERN).optional().catch(undefined),
  format: z.enum(FILE_KINDS).optional().catch(undefined),
  sort: z.enum(SEARCH_SORTS).catch("relevance"),
  page: z.coerce.number().int().min(1).max(50).catch(1),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const courseSchema = z.object({
  code: z.string().trim().toUpperCase().regex(COURSE_CODE_PATTERN, "Mã dạng IT3011"),
  name: z.string().trim().min(2).max(200),
  nameEn: optionalText(200),
  credits: z.coerce.number().int().min(0).max(20).optional(),
  facultyId: z.string().min(1, "Chọn Viện/Trường"),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const takedownSchema = z.object({
  email: z.email("Email không hợp lệ"),
  fullName: z.string().trim().min(2).max(100),
  documentUrl: z.string().trim().min(3).max(500),
  details: z.string().trim().min(20, "Mô tả ít nhất 20 ký tự").max(4000),
  declaration: z.literal(true, { message: "Cần xác nhận cam kết" }),
});
export type TakedownInput = z.infer<typeof takedownSchema>;

export const reportSchema = z.object({
  documentId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  details: optionalText(2000),
});
export type ReportInput = z.infer<typeof reportSchema>;

/** Gom lỗi zod theo tên trường để hiện cạnh ô nhập. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
