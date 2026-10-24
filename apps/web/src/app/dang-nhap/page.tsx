import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/account/sign-in-form";
import { serverEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title"), robots: { index: false } };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; loi?: string }>;
}) {
  const { next: rawNext, loi } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next);
  const t = await getTranslations("auth");

  return (
    <div className="grid-paper min-h-[70vh] border-b-2 border-ink">
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-10 md:grid-cols-[1fr_400px] md:py-16">
        <div className="flex flex-col gap-3">
          <h1 className="font-code text-5xl leading-[0.95] md:text-6xl">{t("title")}</h1>
          <p className="max-w-md text-[15px]">{t("intro")}</p>
          <ul className="mt-2 flex max-w-md flex-col gap-1 text-[13px] text-pencil">
            <li>{t("benefitRead")}</li>
            <li>{t("benefitDownload")}</li>
            <li>{t("benefitUpload")}</li>
          </ul>
        </div>
        <div className="border-2 border-ink bg-sheet p-4 shadow-[6px_6px_0_var(--ink)]">
          {loi ? (
            <p role="alert" className="mb-3 border-l-4 border-stamp px-3 py-2 text-sm">
              {t("microsoftError")}
            </p>
          ) : null}
          <SignInForm
            next={next}
            domains={serverEnv.allowedDomains}
            microsoftEnabled={Boolean(serverEnv.microsoft)}
          />
          <p className="mt-4 text-[12px] text-pencil">
            {t.rich("terms", {
              terms: (chunks) => (
                <Link href="/dieu-khoan" className="underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/quyen-rieng-tu" className="underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
