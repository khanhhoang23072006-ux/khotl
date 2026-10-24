import { DOCUMENT_TYPES, documentTypeLabel, recentTerms } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UploadForm } from "@/components/upload/upload-form";
import { PageHeader } from "@/components/ui/title-block";
import { serverEnv } from "@/lib/env";
import { currentLocale } from "@/lib/locale";
import { requireProfile } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mine");
  return { title: t("editTitle"), robots: { index: false } };
}

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireProfile(`/tai-lieu-cua-toi/${id}/sua`);
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      course: { select: { id: true, code: true, name: true } },
      tags: { where: { source: "USER" }, include: { tag: true } },
    },
  });
  if (!doc || doc.uploaderId !== user.id) notFound();
  const t = await getTranslations("mine");
  const locale = await currentLocale();

  return (
    <>
      <PageHeader title={t("editTitle")} kicker={doc.title} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        {doc.status !== "CHANGES_REQUESTED" ? (
          <p className="border-2 border-ink bg-sheet px-3 py-2 text-sm">{t("notEditable")}</p>
        ) : (
          <>
            {doc.reviewNote ? (
              <p className="mb-4 border-l-4 border-stamp bg-sheet px-3 py-2 text-sm">
                <span className="font-head">{t("note")}: </span>
                {doc.reviewNote}
              </p>
            ) : null}
            <UploadForm
              mode={{ kind: "edit", documentId: doc.id }}
              types={DOCUMENT_TYPES.map((value) => ({ value, label: documentTypeLabel(value, locale) }))}
              terms={recentTerms(12)}
              limits={serverEnv.uploadLimits}
              initial={{
                course: doc.course,
                type: doc.type,
                term: doc.term ?? "",
                title: doc.title,
                description: doc.description ?? "",
                tags: doc.tags.map(({ tag }) => tag.name).join(", "),
                isAnonymous: doc.isAnonymous,
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
