import "server-only";
import { type Prisma, prisma } from "@khotl/db";
import type { DocumentRowData } from "@/components/documents/document-row";

/** Điều kiện tài liệu hiển thị công khai. */
export const PUBLIC_DOCUMENT = {
  status: "APPROVED",
  visibility: "PUBLIC",
  deletedAt: null,
} satisfies Prisma.DocumentWhereInput;

export const documentRowSelect = {
  slug: true,
  title: true,
  type: true,
  term: true,
  downloadCount: true,
  ratingCount: true,
  ratingSum: true,
  course: { select: { code: true } },
  currentVersion: { select: { fileKind: true, pageCount: true } },
} satisfies Prisma.DocumentSelect;

type RowRecord = Prisma.DocumentGetPayload<{ select: typeof documentRowSelect }>;

export function toRow(doc: RowRecord): DocumentRowData {
  return {
    slug: doc.slug,
    title: doc.title,
    type: doc.type,
    term: doc.term,
    courseCode: doc.course.code,
    downloadCount: doc.downloadCount,
    ratingCount: doc.ratingCount,
    ratingSum: doc.ratingSum,
    fileKind: doc.currentVersion?.fileKind ?? null,
    pageCount: doc.currentVersion?.pageCount ?? null,
  };
}

export async function latestDocuments(options: { facultyId?: string | null; take?: number } = {}) {
  const docs = await prisma.document.findMany({
    where: {
      ...PUBLIC_DOCUMENT,
      ...(options.facultyId ? { course: { facultyId: options.facultyId } } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: options.take ?? 6,
    select: documentRowSelect,
  });
  return docs.map(toRow);
}
