import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  FILE_KINDS,
  recentTerms,
  SEARCH_SORTS,
  searchQuerySchema,
} from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { DocumentRow } from "@/components/documents/document-row";
import { Highlighted } from "@/components/documents/highlighted";
import { SearchBox } from "@/components/search/search-box";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { PAGE_SIZE, searchCourses, searchDocuments } from "@/lib/search";
import { getCurrentUser } from "@/lib/session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const t = await getTranslations("search");
  const q = first((await searchParams).q)?.trim();
  return { title: q ? t("metaTitleQuery", { q }) : t("title"), robots: { index: false } };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = searchQuerySchema.parse({
    q: first(raw.q) ?? "",
    faculty: first(raw.faculty) || undefined,
    course: first(raw.course) || undefined,
    type: first(raw.type) || undefined,
    term: first(raw.term) || undefined,
    format: first(raw.format) || undefined,
    sort: first(raw.sort) || undefined,
    page: first(raw.page) || undefined,
  });
  const t = await getTranslations("search");
  const tTypes = await getTranslations("fileKinds");
  const locale = await currentLocale();
  const user = await getCurrentUser();

  const [result, courses, faculties] = await Promise.all([
    searchDocuments(query),
    query.page === 1 && query.q ? searchCourses(query.q, 4) : Promise.resolve([]),
    prisma.faculty.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, shortName: true, name: true } }),
  ]);

  // Lưu lịch sử tìm kiếm sau khi trả trang (không làm chậm phản hồi)
  if (user && query.q && query.page === 1) {
    after(() =>
      prisma.searchHistory
        .create({
          data: {
            userId: user.id,
            query: query.q.slice(0, 200),
            filters: { faculty: query.faculty, course: query.course, type: query.type, term: query.term },
            resultCount: result.total,
          },
        })
        .catch(() => undefined),
    );
  }

  const totalPages = Math.min(50, Math.ceil(result.total / PAGE_SIZE));
  const filterParams = {
    q: query.q || undefined,
    faculty: query.faculty,
    course: query.course,
    type: query.type,
    term: query.term,
    format: query.format,
    sort: query.sort === "relevance" ? undefined : query.sort,
  };
  const hasFilters = Boolean(query.faculty || query.course || query.type || query.term || query.format);

  return (
    <>
      <section className="grid-paper border-b-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5">
          <h1 className="sr-only">{t("title")}</h1>
          <SearchBox
            defaultValue={query.q}
            size="lg"
            autoFocus={!query.q}
            hiddenFields={{ faculty: query.faculty, course: query.course }}
          />
          <form method="get" action="/tim-kiem" className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
            <label className="flex flex-col gap-1 text-[12px] text-pencil">
              {t("faculty")}
              <Select name="faculty" defaultValue={query.faculty ?? ""} className="h-10 text-sm">
                <option value="">{t("all")}</option>
                {faculties.map((faculty) => (
                  <option key={faculty.slug} value={faculty.slug}>
                    {faculty.shortName ?? faculty.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-pencil">
              {t("type")}
              <Select name="type" defaultValue={query.type ?? ""} className="h-10 text-sm">
                <option value="">{t("all")}</option>
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {documentTypeLabel(type, locale)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-pencil">
              {t("term")}
              <Select name="term" defaultValue={query.term ?? ""} className="h-10 text-sm">
                <option value="">{t("all")}</option>
                {recentTerms(12).map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-pencil">
              {t("format")}
              <Select name="format" defaultValue={query.format ?? ""} className="h-10 text-sm">
                <option value="">{t("all")}</option>
                {FILE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {tTypes(kind)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-pencil">
              {t("sort")}
              <Select name="sort" defaultValue={query.sort} className="h-10 text-sm">
                {SEARCH_SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {t(`sorts.${sort}`)}
                  </option>
                ))}
              </Select>
            </label>
            {query.course ? <input type="hidden" name="course" value={query.course} /> : null}
            <div className="flex items-end gap-2">
              <Button type="submit" variant="ink" size="sm" className="h-10 flex-1">
                {t("apply")}
              </Button>
              {hasFilters ? (
                <Link
                  href={query.q ? `/tim-kiem?q=${encodeURIComponent(query.q)}` : "/tim-kiem"}
                  className="flex h-10 items-center px-2 text-[13px] font-semibold underline"
                >
                  {t("clear")}
                </Link>
              ) : null}
            </div>
          </form>
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {courses.length > 0 ? (
          <section aria-labelledby="hoc-phan-khop" className="flex flex-col gap-2">
            <h2 id="hoc-phan-khop" className="font-head text-lg">
              {t("courses")}
            </h2>
            <div className="tb grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/hoc-phan/${course.code}`}
                  className="flex flex-col bg-sheet px-3 py-2.5 hover:bg-wash"
                >
                  <span className="font-code text-2xl leading-none">
                    <Highlighted text={course.code} terms={result.terms} />
                  </span>
                  <span className="truncate text-[13px]">
                    <Highlighted text={course.name} terms={result.terms} />
                  </span>
                  <span className="text-[12px] text-pencil">
                    {t("courseDocuments", { count: course.documentCount })}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="ket-qua" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="ket-qua" className="font-head text-lg">
              {query.q ? t("resultsFor", { count: result.total, q: query.q }) : t("allDocuments", { count: result.total })}
            </h2>
            {query.course ? (
              <Link href={`/hoc-phan/${query.course}`} className="text-[13px] font-semibold underline">
                {t("inCourse", { code: query.course })}
              </Link>
            ) : null}
          </div>
          {result.fuzzy ? (
            <p className="border-l-4 border-stamp bg-sheet px-3 py-2 text-sm">{t("fuzzyNotice")}</p>
          ) : null}
          {result.hits.length > 0 ? (
            <div className="flex flex-col gap-3">
              {result.hits.map((hit) => (
                <DocumentRow key={hit.id} doc={hit} terms={result.terms} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("noResults")}>
              <p>{t("tips")}</p>
            </EmptyState>
          )}
          <Pagination page={query.page} totalPages={totalPages} basePath="/tim-kiem" params={filterParams} />
        </section>

        <aside className="border-t-2 border-ink pt-4 text-[13px] text-pencil">
          <p className="font-head text-ink">{t("tipsTitle")}</p>
          <p>{t("tips")}</p>
        </aside>
      </div>
    </>
  );
}
