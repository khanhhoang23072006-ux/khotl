import { DOCUMENT_TYPES, type DocumentTypeKey, documentTypeLabel, isDocumentType } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DocumentRow } from "@/components/documents/document-row";
import { buttonVariants } from "@/components/ui/button";
import { Cell, EmptyState } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { documentRowSelect, PUBLIC_DOCUMENT, toRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Params = Promise<{ code: string }>;

async function getCourse(code: string) {
  return prisma.course.findUnique({
    where: { code: code.toUpperCase() },
    include: { faculty: { select: { slug: true, name: true, nameEn: true, shortName: true } } },
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const course = await getCourse((await params).code);
  if (!course) return {};
  return {
    title: `${course.code} ${course.name}`,
    description: `Đề thi, slide, bài giải và tài liệu học phần ${course.code} ${course.name}.`,
  };
}

interface GradingItem {
  label: string;
  weight: number;
}

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ loai?: string; ky?: string }>;
}) {
  const { code } = await params;
  const { loai, ky } = await searchParams;
  const course = await getCourse(code);
  if (!course) notFound();
  // URL chuẩn dùng mã viết hoa
  if (course.code !== code) redirect(`/hoc-phan/${course.code}`);
  const t = await getTranslations("course");
  const locale = await currentLocale();
  const type = loai && isDocumentType(loai) ? loai : undefined;

  const [documents, typeCounts, terms] = await Promise.all([
    prisma.document.findMany({
      where: { ...PUBLIC_DOCUMENT, courseId: course.id, ...(type ? { type } : {}), ...(ky ? { term: ky } : {}) },
      orderBy: [{ term: "desc" }, { downloadCount: "desc" }],
      take: 100,
      select: documentRowSelect,
    }),
    prisma.document.groupBy({
      by: ["type"],
      where: { ...PUBLIC_DOCUMENT, courseId: course.id },
      _count: { _all: true },
    }),
    prisma.document.findMany({
      where: { ...PUBLIC_DOCUMENT, courseId: course.id, term: { not: null } },
      distinct: ["term"],
      select: { term: true },
      orderBy: { term: "desc" },
    }),
  ]);
  const countByType = new Map(typeCounts.map((row) => [row.type, row._count._all]));
  const grading = Array.isArray(course.gradingScheme) ? (course.gradingScheme as unknown as GradingItem[]) : [];
  const name = locale === "en" && course.nameEn ? course.nameEn : course.name;
  const facultyName =
    locale === "en" && course.faculty.nameEn ? course.faculty.nameEn : (course.faculty.shortName ?? course.faculty.name);
  const tab = (value?: DocumentTypeKey) => {
    const search = new URLSearchParams();
    if (value) search.set("loai", value);
    if (ky) search.set("ky", ky);
    const query = search.toString();
    return `/hoc-phan/${course.code}${query ? `?${query}` : ""}`;
  };

  return (
    <>
      <header className="grid-paper border-b-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
          <p className="text-[13px] text-pencil">
            <Link href={`/vien/${course.faculty.slug}`} className="underline">
              {facultyName}
            </Link>
          </p>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <h1 className="flex flex-col">
              <span className="font-code text-6xl leading-[0.9] md:text-7xl">{course.code}</span>
              <span className="font-head text-xl md:text-2xl">{name}</span>
            </h1>
          </div>
          <div className="tb grid-cols-3 md:max-w-2xl">
            <Cell label={t("credits")}>{course.credits ?? "–"}</Cell>
            <Cell label={t("documents")}>{course.documentCount}</Cell>
            <Cell label={t("faculty")}>{facultyName}</Cell>
          </div>
          {grading.length > 0 ? (
            <div className="md:max-w-2xl">
              <p className="mb-1 text-[11px] text-pencil">{t("grading")}</p>
              <div className="tb" style={{ gridTemplateColumns: grading.map((g) => `${g.weight}fr`).join(" ") }}>
                {grading.map((item, index) => (
                  <div
                    key={item.label}
                    className={cn("flex items-baseline justify-between gap-2 px-3 py-1.5", index === grading.length - 1 ? "bg-ink text-paper" : "bg-sheet")}
                  >
                    <span className="text-[12px]">{item.label}</span>
                    <span className="font-code text-lg">{Math.round(item.weight * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <Link href={`/tai-len?hp=${course.code}`} className={buttonVariants({ variant: "primary" })}>
              {t("uploadHere")}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        <h2 className="font-head text-lg">{t("byType")}</h2>
        <nav aria-label={t("byType")} className="flex flex-wrap gap-px border-2 border-ink bg-ink">
          <Link
            href={tab()}
            aria-current={!type ? "page" : undefined}
            className={cn("flex h-11 items-center gap-2 px-3 text-sm", !type ? "bg-ink text-paper hover:text-paper" : "bg-sheet")}
          >
            {t("allTypes")} <span className="text-[12px] opacity-70">{course.documentCount}</span>
          </Link>
          {DOCUMENT_TYPES.filter((value) => countByType.has(value)).map((value) => (
            <Link
              key={value}
              href={tab(value)}
              aria-current={type === value ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-2 px-3 text-sm",
                type === value ? "bg-ink text-paper hover:text-paper" : "bg-sheet",
              )}
            >
              {documentTypeLabel(value, locale)}
              <span className="text-[12px] opacity-70">{countByType.get(value)}</span>
            </Link>
          ))}
        </nav>

        {terms.length > 1 ? (
          <form method="get" className="flex items-center gap-2 text-sm">
            {type ? <input type="hidden" name="loai" value={type} /> : null}
            <label htmlFor="ky" className="text-pencil">
              {t("term")}
            </label>
            <select id="ky" name="ky" defaultValue={ky ?? ""} className="h-9 border-2 border-ink bg-sheet px-2">
              <option value="">{t("allTerms")}</option>
              {terms.map((row) =>
                row.term ? (
                  <option key={row.term} value={row.term}>
                    {row.term}
                  </option>
                ) : null,
              )}
            </select>
            <button type="submit" className="h-9 border-2 border-ink bg-ink px-3 font-head text-paper">
              {t("filter")}
            </button>
          </form>
        ) : null}

        {documents.length > 0 ? (
          <div className="flex flex-col gap-3">
            {documents.map((doc) => (
              <DocumentRow key={doc.slug} doc={toRow(doc)} showCourse={false} />
            ))}
          </div>
        ) : (
          <EmptyState title={t("empty")}>
            <Link href={`/tai-len?hp=${course.code}`} className="font-semibold underline">
              {t("uploadHere")}
            </Link>
          </EmptyState>
        )}
      </div>
    </>
  );
}
