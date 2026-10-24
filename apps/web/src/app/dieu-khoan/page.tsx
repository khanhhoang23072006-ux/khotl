import type { Metadata } from "next";
import { getMessages, getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("termsTitle") };
}

export default async function Page() {
  const t = await getTranslations("legal");
  const messages = await getMessages();
  return <LegalPage title={t("termsTitle")} updated={t("updated")} raw={messages.legal.terms} />;
}
