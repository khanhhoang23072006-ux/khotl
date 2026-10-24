import { formatDateTime } from "@khotl/core";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { OutOfCreditsDialog } from "@/components/credits/out-of-credits";
import { HowToEarn } from "@/components/credits/how-to-earn";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/title-block";
import { currentLocale } from "@/lib/locale";
import { requireUser } from "@/lib/session";
import { getCreditSettings, getCreditStatus } from "@/server/credits/ledger";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("credits");
  return { title: t("outTitle"), robots: { index: false } };
}

/** Trang khi bấm tải lúc đã hết lượt (trường hợp số dư đổi giữa lúc xem trang và lúc bấm). */
export default async function OutOfCreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ "tai-lieu"?: string }>;
}) {
  const user = await requireUser("/het-luot");
  const t = await getTranslations("credits");
  const locale = await currentLocale();
  const slug = (await searchParams)["tai-lieu"];
  const backHref = slug && /^[a-z0-9-]+$/.test(slug) ? `/tai-lieu/${slug}` : undefined;
  const [status, settings] = await Promise.all([getCreditStatus(user.id), getCreditSettings()]);
  const body = t("outBody", {
    daily: status.dailyFree,
    reset: formatDateTime(status.nextReset, locale),
    reward: settings.uploadReward,
  });
  return (
    <>
      <PageHeader title={t("outTitle")}>
        <p className="max-w-2xl text-sm">{body}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/tai-len" className={buttonVariants({ variant: "primary" })}>
            {t("outUpload")}
          </Link>
          {backHref ? (
            <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
              {t("outBack")}
            </Link>
          ) : null}
        </div>
        <OutOfCreditsDialog trigger={false} body={body} openOnMount backHref={backHref} />
      </PageHeader>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <HowToEarn settings={settings} />
      </div>
    </>
  );
}
