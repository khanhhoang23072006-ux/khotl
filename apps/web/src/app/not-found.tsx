import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="tb grid-cols-[96px_1fr]">
        <div className="flex items-center justify-center bg-ink font-code text-4xl text-paper">404</div>
        <div className="bg-sheet px-4 py-3">
          <h1 className="font-head text-xl">{t("notFoundTitle")}</h1>
          <p className="text-sm text-pencil">{t("notFoundBody")}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href="/" className={buttonVariants({ variant: "ink" })}>
          {t("goHome")}
        </Link>
        <Link href="/tim-kiem" className={buttonVariants()}>
          {t("goSearch")}
        </Link>
      </div>
    </div>
  );
}
