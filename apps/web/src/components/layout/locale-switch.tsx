"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/server/account";

export function LocaleSwitch() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === "vi" ? "en" : "vi";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
      className="flex h-11 min-w-11 items-center justify-center px-2 font-head text-[13px] hover:bg-wash disabled:opacity-50"
      aria-label={t("switchLanguage")}
      title={t("switchLanguage")}
      lang={next}
    >
      {next === "en" ? "EN" : "VI"}
    </button>
  );
}
