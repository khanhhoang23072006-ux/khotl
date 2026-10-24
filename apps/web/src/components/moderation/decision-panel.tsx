"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { decideDocuments } from "@/server/moderation";

type Decision = "APPROVE" | "REQUEST_CHANGES" | "REJECT";

/**
 * Bảng quyết định cho một hoặc nhiều tài liệu. Từ chối và yêu cầu sửa bắt buộc có lý do
 * (chọn lý do mẫu rồi sửa thêm), lý do được gửi cho người đăng qua thông báo và email.
 */
export function DecisionPanel({
  documentIds,
  templates,
  nextHref,
  compact = false,
  onDone,
}: {
  documentIds: string[];
  templates: readonly string[];
  nextHref?: string;
  compact?: boolean;
  onDone?: () => void;
}) {
  const t = useTranslations("moderation");
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const count = documentIds.length;

  const run = (chosen: Decision) =>
    startTransition(async () => {
      setError(null);
      const result = await decideDocuments({
        documentIds,
        decision: chosen,
        reason: chosen === "APPROVE" ? undefined : reason,
        internalNote: note,
      });
      if (!result.ok) {
        setError(result.fields?.reason ?? result.error);
        return;
      }
      setDecision(null);
      setReason("");
      setNote("");
      setMessage(result.skipped > 0 ? t("doneSkipped", { count: result.count, skipped: result.skipped }) : t("done", { count: result.count }));
      onDone?.();
      if (nextHref) router.push(nextHref);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {!compact ? (
        <Field id="internal-note" label={t("internalNote")}>
          <Textarea
            id="internal-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-16"
            placeholder={t("internalNoteHint")}
          />
        </Field>
      ) : null}

      {decision && decision !== "APPROVE" ? (
        <div className="flex flex-col gap-2 border-2 border-ink bg-paper p-3">
          <Field id="reason-template" label={t("reasonTemplate")}>
            <Select
              id="reason-template"
              value=""
              onChange={(event) => {
                if (event.target.value) setReason(event.target.value);
              }}
            >
              <option value="">{t("chooseTemplate")}</option>
              {templates.map((template) => (
                <option key={template} value={template}>
                  {template}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="reason" label={t("reasonForUploader")} error={error ?? undefined} required>
            <Textarea id="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button variant="ink" disabled={pending || reason.trim().length < 3} onClick={() => run(decision)}>
              {decision === "REJECT" ? t("confirmReject", { count }) : t("confirmChanges", { count })}
            </Button>
            <Button variant="ghost" onClick={() => setDecision(null)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-px border-2 border-ink bg-ink">
          <button
            type="button"
            className="h-12 bg-stamp font-head text-stamp-ink hover:bg-ink hover:text-paper disabled:opacity-50"
            disabled={pending || count === 0}
            onClick={() => run("APPROVE")}
          >
            {t("approve", { count })}
          </button>
          <button
            type="button"
            className="h-12 bg-sheet font-head hover:bg-wash disabled:opacity-50"
            disabled={pending || count === 0}
            onClick={() => setDecision("REQUEST_CHANGES")}
          >
            {t("requestChanges")}
          </button>
          <button
            type="button"
            className="h-12 bg-sheet font-head hover:bg-wash disabled:opacity-50"
            disabled={pending || count === 0}
            onClick={() => setDecision("REJECT")}
          >
            {t("reject")}
          </button>
        </div>
      )}
      {error && !decision ? (
        <p role="alert" className="text-sm font-semibold text-stamp">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
