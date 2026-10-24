import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage, type RawSections } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("termsTitle") };
}

export default async function TermsPage() {
  const t = await getTranslations("legal");
  return <LegalPage title={t("termsTitle")} updated={t("updated")} raw={t.raw("terms") as RawSections} />;
}
