import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage, type RawSections } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("privacyTitle") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  return <LegalPage title={t("privacyTitle")} updated={t("updated")} raw={t.raw("privacy") as RawSections} />;
}
