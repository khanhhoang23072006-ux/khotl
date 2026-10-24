import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TakedownForm } from "@/components/account/takedown-form";
import { PageHeader } from "@/components/ui/title-block";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("takedown");
  return { title: t("title") };
}

export default async function TakedownPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  const t = await getTranslations("takedown");
  return (
    <>
      <PageHeader title={t("title")}>
        <p className="max-w-2xl text-[15px]">{t("intro")}</p>
      </PageHeader>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="border-2 border-ink bg-sheet p-4">
          <TakedownForm initialUrl={url ?? ""} />
        </div>
        <p className="mt-3 text-[13px] text-pencil">{t("process")}</p>
      </div>
    </>
  );
}
