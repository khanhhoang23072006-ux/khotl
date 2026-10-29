"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/field";
import { replyFeedback, setFeedbackStatus } from "@/server/feedback";

/** Trả lời một phiếu (gửi email cho người gửi) hoặc đóng, mở lại phiếu. */
export function FeedbackReply({ id, status, previousReply }: { id: string; status: "OPEN" | "ANSWERED" | "CLOSED"; previousReply: string | null }) {
  const t = useTranslations("feedback.admin");
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [close, setClose] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    startTransition(async () => {
      const result = await fn();
      setMessage(result.ok ? okText : (result.error ?? null));
      if (result.ok) {
        setReply("");
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-3">
      {previousReply ? (
        <div className="border-l-4 border-ink bg-wash px-3 py-2 text-sm">
          <p className="text-[11px] text-pencil">{t("previousReply")}</p>
          <p className="whitespace-pre-line">{previousReply}</p>
        </div>
      ) : null}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          run(() => replyFeedback({ id, reply, close }), t("replied"));
        }}
      >
        <Field id={`reply-${id}`} label={t("reply")} hint={t("replyHint")}>
          <Textarea id={`reply-${id}`} value={reply} onChange={(event) => setReply(event.target.value)} className="min-h-28" maxLength={5000} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={close} onChange={(event) => setClose(event.target.checked)} />
          <span>{t("closeAfterReply")}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="ink" size="sm" disabled={pending || reply.trim().length < 5}>
            {t("send")}
          </Button>
          {status === "CLOSED" ? (
            <Button size="sm" disabled={pending} onClick={() => run(() => setFeedbackStatus(id, "OPEN"), t("reopened"))}>
              {t("reopen")}
            </Button>
          ) : (
            <Button size="sm" disabled={pending} onClick={() => run(() => setFeedbackStatus(id, "CLOSED"), t("closed"))}>
              {t("close")}
            </Button>
          )}
        </div>
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
