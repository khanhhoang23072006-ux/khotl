"use client";

import { REPORT_REASONS, type ReportReasonKey, reportReasonLabel } from "@khotl/core";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FlagIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { toLocale } from "@/i18n/config";
import { createReport } from "@/server/reports";

export function ReportForm({ documentId }: { documentId: string }) {
  const t = useTranslations("report");
  const locale = toLocale(useLocale());
  const [reason, setReason] = useState<ReportReasonKey>("WRONG_CATEGORY");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (message?.ok) {
    return <p className="border-2 border-ink bg-sheet px-3 py-2 text-sm">{message.text}</p>;
  }

  return (
    <details className="border-2 border-ink bg-sheet">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-2 px-3 font-head text-sm hover:bg-wash [&::-webkit-details-marker]:hidden">
        <FlagIcon size={16} />
        {t("open")}
      </summary>
      <form
        className="flex flex-col gap-3 border-t border-ink p-3"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await createReport({ documentId, reason, details });
            setMessage(result.ok ? { ok: true, text: t("sent") } : { ok: false, text: result.error });
          });
        }}
      >
        <Field id="report-reason" label={t("reason")}>
          <Select
            id="report-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportReasonKey)}
          >
            {REPORT_REASONS.map((value) => (
              <option key={value} value={value}>
                {reportReasonLabel(value, locale)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="report-details" label={t("details")} hint={t("detailsHint")}>
          <Textarea
            id="report-details"
            value={details}
            maxLength={2000}
            onChange={(event) => setDetails(event.target.value)}
          />
        </Field>
        {message && !message.ok ? (
          <p role="alert" className="text-sm font-semibold text-stamp">
            {message.text}
          </p>
        ) : null}
        <Button type="submit" variant="ink" disabled={pending}>
          {pending ? t("sending") : t("submit")}
        </Button>
      </form>
    </details>
  );
}
