import { DOCUMENT_TYPES, documentTypeLabel, recentTerms } from "@khotl/core";
import { prisma } from "@khotl/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UploadForm } from "@/components/upload/upload-form";
import { serverEnv } from "@/lib/env";
import { currentLocale } from "@/lib/locale";
import { activeSanction, uploadQuota } from "@/lib/policies";
import { requireProfile } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("upload");
  return { title: t("pageTitle"), robots: { index: false } };
}

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ hp?: string }> }) {
  const { hp } = await searchParams;
  const user = await requireProfile(hp ? `/tai-len?hp=${encodeURIComponent(hp)}` : "/tai-len");
  const t = await getTranslations("upload");
  const locale = await currentLocale();
  const [quota, sanction, course] = await Promise.all([
    uploadQuota(user),
    activeSanction(user.id, ["UPLOAD_BAN", "SITE_BAN"]),
    hp
      ? prisma.course.findUnique({ where: { code: hp.toUpperCase() }, select: { id: true, code: true, name: true } })
      : Promise.resolve(null),
  ]);

  return (
    <>
      <header className="grid-paper border-b-2 border-ink">
        <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-4 px-4 py-6">
          <div>
            <h1 className="font-code text-5xl leading-[0.95]">{t("pageTitle")}</h1>
            <p className="mt-2 max-w-lg text-sm">{t("intro")}</p>
          </div>
          <div className="tb grid-cols-1">
            <div className="bg-sheet px-3 py-2">
              <p className="text-[11px] text-pencil">{t("quotaLabel")}</p>
              <p className="font-code text-3xl leading-none">
                {quota.remaining}/{quota.limit}
              </p>
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">
        {sanction ? (
          <p className="border-2 border-stamp bg-sheet px-3 py-2 text-sm">
            {t("banned", { reason: sanction.reason })}
          </p>
        ) : quota.remaining <= 0 ? (
          <p className="border-2 border-ink bg-sheet px-3 py-2 text-sm">{t("quotaReached", { limit: quota.limit })}</p>
        ) : (
          <>
            <p className="mb-4 text-[13px] text-pencil">{t("quotaHint")}</p>
            <UploadForm
              mode={{ kind: "create" }}
              types={DOCUMENT_TYPES.map((value) => ({ value, label: documentTypeLabel(value, locale) }))}
              terms={recentTerms(12)}
              limits={serverEnv.uploadLimits}
              initial={{
                course,
                type: "",
                term: "",
                title: "",
                description: "",
                tags: "",
                isAnonymous: false,
              }}
            />
          </>
        )}
      </div>
    </>
  );
}
