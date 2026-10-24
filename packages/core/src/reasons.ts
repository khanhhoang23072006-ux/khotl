import type { Locale } from "./term";

/** Lý do mẫu khi từ chối hoặc yêu cầu sửa, để kiểm duyệt viên chọn nhanh. */
export const REVIEW_REASON_TEMPLATES: Record<Locale, readonly string[]> = {
  vi: [
    "Sai học phần hoặc sai loại tài liệu",
    "File mờ, thiếu trang hoặc không đọc được",
    "Trùng với tài liệu đã có",
    "Vi phạm bản quyền",
    "Nội dung không phù hợp hoặc quảng cáo",
    "Tiêu đề, mô tả chưa đúng nội dung",
  ],
  en: [
    "Wrong course or document type",
    "Blurry, missing pages or unreadable",
    "Duplicate of an existing document",
    "Copyright violation",
    "Inappropriate content or advertising",
    "Title or description does not match the content",
  ],
};

// Phải khớp enum ReportReason trong schema.prisma.
export const REPORT_REASONS = [
  "COPYRIGHT",
  "WRONG_CATEGORY",
  "LOW_QUALITY",
  "SPAM",
  "INAPPROPRIATE",
  "MALWARE",
  "OTHER",
] as const;
export type ReportReasonKey = (typeof REPORT_REASONS)[number];

const REPORT_REASON_LABELS: Record<Locale, Record<ReportReasonKey, string>> = {
  vi: {
    COPYRIGHT: "Vi phạm bản quyền",
    WRONG_CATEGORY: "Sai học phần hoặc loại",
    LOW_QUALITY: "Chất lượng kém",
    SPAM: "Spam, quảng cáo",
    INAPPROPRIATE: "Nội dung không phù hợp",
    MALWARE: "Nghi có mã độc",
    OTHER: "Khác",
  },
  en: {
    COPYRIGHT: "Copyright violation",
    WRONG_CATEGORY: "Wrong course or type",
    LOW_QUALITY: "Low quality",
    SPAM: "Spam or advertising",
    INAPPROPRIATE: "Inappropriate content",
    MALWARE: "Suspected malware",
    OTHER: "Other",
  },
};

export function reportReasonLabel(reason: ReportReasonKey, locale: Locale = "vi"): string {
  return REPORT_REASON_LABELS[locale][reason];
}
