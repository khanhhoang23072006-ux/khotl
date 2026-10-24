import { formatCount } from "@khotl/core";
import { prisma } from "@khotl/db";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DocumentRow } from "@/components/documents/document-row";
import { SearchBox } from "@/components/search/search-box";
import { EmptyState, SectionHeading } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { latestDocuments, PUBLIC_DOCUMENT } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const t = await getTranslations("home");
  const locale = await currentLocale();
  const user = await getCurrentUser();
  const faculty = user?.facultyId
    ? await prisma.faculty.findUnique({ where: { id: user.facultyId }, select: { id: true, name: true, nameEn: true, shortName: true } })
    : null;

  const [documentTotal, courseTotal, facultyTotal, topCourses, latest, forFaculty, mostDownloaded] =
    await Promise.all([
      prisma.document.count({ where: PUBLIC_DOCUMENT }),
      prisma.course.count(),
      prisma.faculty.count(),
      prisma.course.findMany({
        where: { documentCount: { gt: 0 } },
        orderBy: [{ documentCount: "desc" }, { code: "asc" }],
        take: 8,
        select: { code: true, name: true, nameEn: true, documentCount: true },
      }),
      latestDocuments({ take: 5 }),
      faculty ? latestDocuments({ facultyId: faculty.id, take: 3 }) : Promise.resolve([]),
      prisma.document.findMany({
        where: { ...PUBLIC_DOCUMENT, downloadCount: { gt: 0 } },
        orderBy: { downloadCount: "desc" },
        take: 5,
        select: { slug: true, title: true, downloadCount: true, course: { select: { code: true } } },
      }),
    ]);

  const facultyName = faculty ? (locale === "en" && faculty.nameEn ? faculty.nameEn : faculty.shortName ?? faculty.name) : null;

  return (
    <>
      <section className="grid-paper border-b-2 border-ink">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-7 pt-5 md:grid-cols-[1.4fr_1fr] md:items-end md:py-12">
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-pencil">
              {user
                ? user.cohort && facultyName
                  ? t("greetingDetail", { name: user.displayName || user.name, cohort: user.cohort, faculty: facultyName })
                  : t("greeting", { name: user.displayName || user.name })
                : t("tagline")}
            </p>
            <h1 className="font-code text-[42px] leading-[0.98] md:text-7xl">{t("title")}</h1>
            <SearchBox size="lg" />
            <p className="text-[13px] text-pencil">{t("searchTip")}</p>
          </div>
          <dl className="tb grid-cols-3 self-end">
            {[
              { label: t("statDocuments"), value: documentTotal },
              { label: t("statCourses"), value: courseTotal },
              { label: t("statFaculties"), value: facultyTotal },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse bg-sheet px-3 py-2">
                <dt className="text-[11px] text-pencil">{stat.label}</dt>
                <dd className="font-code text-3xl leading-none md:text-4xl">{formatCount(stat.value, locale)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 md:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-8">
          {forFaculty.length > 0 && facultyName ? (
            <section className="flex flex-col gap-3" aria-labelledby="moi-cho-ban">
              <SectionHeading id="moi-cho-ban" action={<Link href="/tim-kiem?sort=newest">{t("seeMore")}</Link>}>
                {t("newForFaculty", { faculty: facultyName })}
              </SectionHeading>
              <div className="flex flex-col gap-3">
                {forFaculty.map((doc) => (
                  <DocumentRow key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3" aria-labelledby="moi-duyet">
            <SectionHeading id="moi-duyet" action={<Link href="/tim-kiem?sort=newest">{t("seeMore")}</Link>}>
              {t("latest")}
            </SectionHeading>
            {latest.length > 0 ? (
              <div className="flex flex-col gap-3">
                {latest.map((doc) => (
                  <DocumentRow key={doc.slug} doc={doc} />
                ))}
              </div>
            ) : (
              <EmptyState title={t("emptyTitle")}>
                <Link href="/tai-len" className="font-semibold underline">
                  {t("emptyAction")}
                </Link>
              </EmptyState>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3" aria-labelledby="hoc-phan-nhieu">
            <SectionHeading id="hoc-phan-nhieu" action={<Link href="/vien">{t("allFaculties")}</Link>}>
              {t("topCourses")}
            </SectionHeading>
            <div className="tb grid-cols-2">
              {topCourses.map((course) => (
                <Link
                  key={course.code}
                  href={`/hoc-phan/${course.code}`}
                  className="flex items-end justify-between gap-2 bg-paper px-3 py-2.5 hover:bg-sheet"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-code text-[22px] leading-none">{course.code}</span>
                    <span className="truncate text-[13px]">
                      {locale === "en" && course.nameEn ? course.nameEn : course.name}
                    </span>
                  </span>
                  <span className="text-[12px] text-pencil">{course.documentCount}</span>
                </Link>
              ))}
            </div>
            <p className="text-[12px] text-pencil">{t("topCoursesNote")}</p>
          </section>

          {mostDownloaded.length > 0 ? (
            <section className="flex flex-col gap-3" aria-labelledby="tai-nhieu">
              <SectionHeading id="tai-nhieu">{t("mostDownloaded")}</SectionHeading>
              <table className="w-full border-collapse border-2 border-ink bg-sheet">
                <thead>
                  <tr className="text-left text-[11px] text-pencil">
                    <th scope="col" className="w-12 border border-ink px-2 py-1.5 font-medium">
                      {t("rank")}
                    </th>
                    <th scope="col" className="border border-ink px-2.5 py-1.5 font-medium">
                      {t("document")}
                    </th>
                    <th scope="col" className="w-20 border border-ink px-2 py-1.5 text-right font-medium">
                      {t("downloads")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mostDownloaded.map((doc, index) => (
                    <tr key={doc.slug}>
                      <td className="border border-ink px-2 py-2 text-center font-code text-[26px] leading-none">
                        {index + 1}
                      </td>
                      <td className="border border-ink px-2.5 py-2">
                        <Link href={`/tai-lieu/${doc.slug}`} className="flex flex-col">
                          <span className="font-semibold leading-snug">{doc.title}</span>
                          <span className="font-head text-[13px] text-pencil">{doc.course.code}</span>
                        </Link>
                      </td>
                      <td className="border border-ink px-2 py-2 text-right font-semibold">
                        {formatCount(doc.downloadCount, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
