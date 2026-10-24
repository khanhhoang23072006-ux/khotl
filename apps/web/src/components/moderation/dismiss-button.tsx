"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { dismissReport } from "@/server/moderation";

export function DismissButton({ reportId }: { reportId: string }) {
  const t = useTranslations("moderation");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await dismissReport({ reportId });
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        {t("dismiss")}
      </Button>
      {error ? <p className="text-[12px] text-stamp">{error}</p> : null}
    </div>
  );
}
