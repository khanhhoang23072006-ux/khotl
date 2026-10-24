"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/server/account";

export function MarkAllRead() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <Button
        variant="ink"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await markAllNotificationsRead();
            router.refresh();
          })
        }
      >
        {t("markAllRead")}
      </Button>
    </div>
  );
}
