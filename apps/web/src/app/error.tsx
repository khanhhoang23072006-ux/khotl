"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="tb grid-cols-[96px_1fr]">
        <div className="flex items-center justify-center bg-stamp font-code text-4xl text-stamp-ink">!</div>
        <div className="bg-sheet px-4 py-3">
          <h1 className="font-head text-xl">{t("genericTitle")}</h1>
          <p className="text-sm text-pencil">{t("genericBody")}</p>
          {error.digest ? <p className="mt-1 text-[12px] text-pencil">{error.digest}</p> : null}
        </div>
      </div>
      <Button variant="ink" className="mt-4" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
