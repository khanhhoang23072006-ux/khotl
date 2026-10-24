import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("faculty");
  return { title: t("title") };
}

export default async function FacultiesPage() {
  const t = await getTranslations("faculty");
  const locale = await currentLocale();
  const faculties = await prisma.faculty.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      code: true,
      slug: true,
      name: true,
      nameEn: true,
      shortName: true,
      _count: { select: { courses: true } },
      courses: { select: { documentCount: true } },
    },
  });

  return (
    <>
      <PageHeader title={t("title")} kicker={t("kicker")} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <ul className="tb grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {faculties.map((faculty) => {
            const documents = faculty.courses.reduce((sum, course) => sum + course.documentCount, 0);
            return (
              <li key={faculty.slug} className="bg-sheet">
                <Link
                  href={`/vien/${faculty.slug}`}
                  className="grid h-full grid-cols-[1fr_auto] gap-x-3 px-3 py-3 hover:bg-wash hover:text-ink"
                >
                  <span className="font-code text-3xl leading-none">{faculty.code}</span>
                  <span className="row-span-2 self-end text-right text-[12px] text-pencil">
                    {t("courseCount", { count: faculty._count.courses })}
                    <br />
                    {t("documentCount", { count: documents })}
                  </span>
                  <span className="text-[13px] leading-snug">
                    {locale === "en" && faculty.nameEn ? faculty.nameEn : faculty.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
