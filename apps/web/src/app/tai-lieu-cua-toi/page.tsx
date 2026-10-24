import { type DocumentTypeKey, documentTypeLabel, formatDate } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/documents/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mine");
  return { title: t("title"), robots: { index: false } };
}

export default async function MyDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ "gui-lai"?: string }>;
}) {
  const user = await requireUser("/tai-lieu-cua-toi");
  const params = await searchParams;
  const t = await getTranslations("mine");
  const locale = await currentLocale();
  const documents = await prisma.document.findMany({
    where: { uploaderId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      term: true,
      status: true,
      reviewNote: true,
      createdAt: true,
      downloadCount: true,
      course: { select: { code: true } },
    },
  });

  return (
    <>
      <PageHeader title={t("title")} kicker={t("kicker", { approved: user.approvedDocumentCount, reputation: user.reputation })}>
        <div>
          <Link href="/tai-len" className={buttonVariants({ variant: "primary" })}>
            {t("upload")}
          </Link>
        </div>
      </PageHeader>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6">
        {params["gui-lai"] ? (
          <p className="border-l-4 border-ink bg-sheet px-3 py-2 text-sm">{t("resubmitted")}</p>
        ) : null}
        {documents.length === 0 ? (
          <EmptyState title={t("empty")}>
            <Link href="/tai-len" className="font-semibold underline">
              {t("upload")}
            </Link>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {documents.map((doc) => (
              <li key={doc.id} className="tb grid-cols-[1fr_auto]">
                <div className="flex min-w-0 flex-col gap-1 bg-sheet px-3 py-2.5">
                  <Link href={`/tai-lieu/${doc.slug}`} className="font-semibold leading-snug">
                    {doc.title}
                  </Link>
                  <p className="text-[12px] text-pencil">
                    {doc.course.code}, {documentTypeLabel(doc.type as DocumentTypeKey, locale)}
                    {doc.term ? `, ${doc.term}` : ""}. {t("submittedOn", { date: formatDate(doc.createdAt, locale) })}
                  </p>
                  {doc.reviewNote && doc.status !== "APPROVED" ? (
                    <p className="text-sm">
                      <span className="font-head">{t("note")}: </span>
                      {doc.reviewNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end justify-between gap-2 bg-sheet px-3 py-2.5">
                  <StatusBadge status={doc.status} />
                  {doc.status === "CHANGES_REQUESTED" ? (
                    <Link
                      href={`/tai-lieu-cua-toi/${doc.id}/sua`}
                      className={buttonVariants({ variant: "ink", size: "sm" })}
                    >
                      {t("edit")}
                    </Link>
                  ) : doc.status === "APPROVED" ? (
                    <span className="text-[12px] text-pencil">{t("downloads", { count: doc.downloadCount })}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
