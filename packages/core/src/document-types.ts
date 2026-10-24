import type { Locale } from "./term";

// Phải khớp enum DocumentType / FileKind trong schema.prisma.
export const DOCUMENT_TYPES = [
  "EXAM_FINAL",
  "EXAM_MIDTERM",
  "SLIDE",
  "SOLUTION",
  "TEXTBOOK",
  "SYLLABUS",
  "NOTES",
  "OTHER",
] as const;
export type DocumentTypeKey = (typeof DOCUMENT_TYPES)[number];

const DOCUMENT_TYPE_LABELS: Record<Locale, Record<DocumentTypeKey, string>> = {
  vi: {
    EXAM_FINAL: "Đề cuối kỳ",
    EXAM_MIDTERM: "Đề giữa kỳ",
    SLIDE: "Slide",
    SOLUTION: "Bài giải",
    TEXTBOOK: "Giáo trình",
    SYLLABUS: "Đề cương",
    NOTES: "Ghi chú",
    OTHER: "Khác",
  },
  en: {
    EXAM_FINAL: "Final exam",
    EXAM_MIDTERM: "Midterm exam",
    SLIDE: "Slides",
    SOLUTION: "Solutions",
    TEXTBOOK: "Textbook",
    SYLLABUS: "Syllabus",
    NOTES: "Notes",
    OTHER: "Other",
  },
};

export function documentTypeLabel(type: DocumentTypeKey, locale: Locale = "vi"): string {
  return DOCUMENT_TYPE_LABELS[locale][type];
}

export function isDocumentType(value: string): value is DocumentTypeKey {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export const FILE_KINDS = ["PDF", "DOCX", "PPTX", "XLSX", "IMAGE", "ZIP"] as const;
export type FileKindKey = (typeof FILE_KINDS)[number];

interface UploadRule {
  kind: FileKindKey;
  mimes: readonly string[];
}

/** Đuôi file cho phép upload. Không nhận SVG (có thể chứa script) và định dạng Office cũ. */
export const UPLOAD_RULES: Record<string, UploadRule> = {
  pdf: { kind: "PDF", mimes: ["application/pdf"] },
  docx: {
    kind: "DOCX",
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  pptx: {
    kind: "PPTX",
    mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  },
  xlsx: {
    kind: "XLSX",
    mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
  jpg: { kind: "IMAGE", mimes: ["image/jpeg"] },
  jpeg: { kind: "IMAGE", mimes: ["image/jpeg"] },
  png: { kind: "IMAGE", mimes: ["image/png"] },
  webp: { kind: "IMAGE", mimes: ["image/webp"] },
  zip: { kind: "ZIP", mimes: ["application/zip", "application/x-zip-compressed"] },
};

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function uploadRuleForFile(fileName: string): UploadRule | null {
  return UPLOAD_RULES[fileExtension(fileName)] ?? null;
}

export function contentTypeForFile(fileName: string): string {
  return uploadRuleForFile(fileName)?.mimes[0] ?? "application/octet-stream";
}

export interface UploadLimits {
  maxMb: number;
  zipMaxMb: number;
}

export function maxUploadBytes(kind: FileKindKey, limits: UploadLimits): number {
  const mb = kind === "ZIP" ? limits.zipMaxMb : limits.maxMb;
  return mb * 1024 * 1024;
}

/**
 * So khớp đuôi do thư viện nhận diện magic bytes trả về (file-type) với loại file khai báo.
 * DOCX/PPTX/XLSX đều là ZIP bên trong nên file-type có thể trả về chính xác loại hoặc "zip".
 */
export function detectedTypeMatches(kind: FileKindKey, detectedExt: string | undefined): boolean {
  if (!detectedExt) return false;
  switch (kind) {
    case "PDF":
      return detectedExt === "pdf";
    case "DOCX":
      return detectedExt === "docx";
    case "PPTX":
      return detectedExt === "pptx";
    case "XLSX":
      return detectedExt === "xlsx";
    case "IMAGE":
      return ["jpg", "png", "webp"].includes(detectedExt);
    case "ZIP":
      return detectedExt === "zip";
  }
}
