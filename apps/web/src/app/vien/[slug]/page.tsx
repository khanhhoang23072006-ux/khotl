import { normalizeVietnamese } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState, PageHeader } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";

type Params = Promise<{ slug: string }>;

async function getFaculty(slug: string) {
  return prisma.faculty.findUnique({
    where: { slug },
    select: { id: true, code: true, name: true, nameEn: true, shortName: true, description: true },
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const faculty = await getFaculty((await params).slug);
  return faculty ? { title: faculty.name, description: faculty.description ?? undefined } : {};
}

export default async function FacultyPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ loc?: string }>;
}) {
  const { slug } = await params;
  const { loc } = await searchParams;
  const faculty = await getFaculty(slug);
  if (!faculty) notFound();
  const t = await getTranslations("faculty");
  const locale = await currentLocale();

  const all = await prisma.course.findMany({
    where: { facultyId: faculty.id },
    orderBy: [{ documentCount: "desc" }, { code: "asc" }],
    select: { code: true, name: true, nameEn: true, credits: true, documentCount: true },
  });
  // Lọc nhanh theo mã hoặc tên, không phân biệt dấu
  const filter = normalizeVietnamese(loc ?? "");
  const courses = filter
    ? all.filter((course) =>
        normalizeVietnamese(`${course.code} ${course.name} ${course.nameEn ?? ""}`).includes(filter),
      )
    : all;

  return (
    <>
      <PageHeader
        kicker={
          <Link href="/vien" className="underline">
            {t("title")}
          </Link>
        }
        title={locale === "en" && faculty.nameEn ? faculty.nameEn : faculty.name}
      >
        <form method="get" className="flex max-w-md gap-2">
          <label htmlFor="loc" className="sr-only">
            {t("filterLabel")}
          </label>
          <Input id="loc" name="loc" defaultValue={loc ?? ""} placeholder={t("filterPlaceholder")} />
          <Button type="submit" variant="ink">
            {t("filter")}
          </Button>
        </form>
      </PageHeader>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {courses.length === 0 ? (
          <EmptyState title={t("noCourses")} />
        ) : (
          <table className="w-full border-collapse border-2 border-ink bg-sheet text-sm">
            <thead>
              <tr className="text-left text-[11px] text-pencil">
                <th scope="col" className="w-28 border border-ink px-3 py-1.5 font-medium">
                  {t("code")}
                </th>
                <th scope="col" className="border border-ink px-3 py-1.5 font-medium">
                  {t("course")}
                </th>
                <th scope="col" className="hidden w-20 border border-ink px-3 py-1.5 text-right font-medium sm:table-cell">
                  {t("credits")}
                </th>
                <th scope="col" className="w-24 border border-ink px-3 py-1.5 text-right font-medium">
                  {t("documents")}
                </th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.code} className="hover:bg-wash">
                  <td className="border border-ink px-3 py-2">
                    <Link href={`/hoc-phan/${course.code}`} className="font-code text-xl leading-none">
                      {course.code}
                    </Link>
                  </td>
                  <td className="border border-ink px-3 py-2">
                    <Link href={`/hoc-phan/${course.code}`}>
                      {locale === "en" && course.nameEn ? course.nameEn : course.name}
                    </Link>
                  </td>
                  <td className="hidden border border-ink px-3 py-2 text-right sm:table-cell">
                    {course.credits ?? "–"}
                  </td>
                  <td className="border border-ink px-3 py-2 text-right font-semibold">{course.documentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
