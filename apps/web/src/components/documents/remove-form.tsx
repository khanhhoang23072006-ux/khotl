"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { removeDocument } from "@/server/moderation";

/** Kiểm duyệt viên gỡ tài liệu đã công khai (kèm lý do gửi người đăng). */
export function RemoveForm({ documentId, reportId }: { documentId: string; reportId?: string }) {
  const t = useTranslations("moderation");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await removeDocument({ documentId, reason, reportId });
          if (!result.ok) {
            setError(result.fields?.reason ?? result.error);
            return;
          }
          setError(null);
          router.refresh();
        });
      }}
    >
      <Field id={`remove-${documentId}`} label={t("removeReason")} error={error ?? undefined}>
        <Textarea
          id={`remove-${documentId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          minLength={3}
          className="min-h-16"
        />
      </Field>
      <Button type="submit" variant="ink" size="sm" disabled={pending}>
        {t("remove")}
      </Button>
    </form>
  );
}
