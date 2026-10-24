import { normalizeVietnamese } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CreateCourseForm, ImportCoursesForm } from "@/components/admin/course-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("coursesTab"), robots: { index: false } };
}

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const t = await getTranslations("admin");
  const [faculties, courses] = await Promise.all([
    prisma.faculty.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.course.findMany({
      orderBy: { code: "asc" },
      take: 500,
      select: { id: true, code: true, name: true, credits: true, documentCount: true, faculty: { select: { code: true } } },
    }),
  ]);
  const filter = normalizeVietnamese(q ?? "");
  const shown = filter
    ? courses.filter((course) => normalizeVietnamese(`${course.code} ${course.name}`).includes(filter))
    : courses;
  const facultyOptions = faculties.map((faculty) => ({ id: faculty.id, label: `${faculty.code}: ${faculty.name}` }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex flex-col gap-3">
        <form method="get" className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            {t("filter")}
          </label>
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder={t("filterPlaceholder")} />
          <Button type="submit" variant="ink">
            {t("filter")}
          </Button>
        </form>
        <p className="text-[13px] text-pencil">{t("courseTotal", { shown: shown.length, total: courses.length })}</p>
        <table className="w-full border-collapse border-2 border-ink bg-sheet text-sm">
          <thead>
            <tr className="text-left text-[11px] text-pencil">
              <th scope="col" className="border border-ink px-2 py-1.5 font-medium">{t("code")}</th>
              <th scope="col" className="border border-ink px-2 py-1.5 font-medium">{t("name")}</th>
              <th scope="col" className="border border-ink px-2 py-1.5 font-medium">{t("faculty")}</th>
              <th scope="col" className="border border-ink px-2 py-1.5 text-right font-medium">{t("credits")}</th>
              <th scope="col" className="border border-ink px-2 py-1.5 text-right font-medium">{t("documents")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((course) => (
              <tr key={course.id}>
                <td className="border border-ink px-2 py-1.5 font-head">
                  <Link href={`/hoc-phan/${course.code}`}>{course.code}</Link>
                </td>
                <td className="border border-ink px-2 py-1.5">{course.name}</td>
                <td className="border border-ink px-2 py-1.5">{course.faculty.code}</td>
                <td className="border border-ink px-2 py-1.5 text-right">{course.credits ?? "–"}</td>
                <td className="border border-ink px-2 py-1.5 text-right">{course.documentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <aside className="flex flex-col gap-6">
        <section className="border-2 border-ink bg-sheet p-4">
          <h2 className="mb-3 font-head text-lg">{t("createCourse")}</h2>
          <CreateCourseForm faculties={facultyOptions} />
        </section>
        <section className="border-2 border-ink bg-sheet p-4">
          <h2 className="mb-3 font-head text-lg">{t("importTitle")}</h2>
          <ImportCoursesForm />
        </section>
      </aside>
    </div>
  );
}
