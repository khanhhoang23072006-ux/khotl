"use client";

import { FEEDBACK_KINDS, type FeedbackKind } from "@khotl/core";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input, Select, Textarea } from "@/components/ui/field";
import { submitFeedback } from "@/server/feedback";

/** Form góp ý, báo lỗi. Người đã đăng nhập không cần nhập email. */
export function FeedbackForm({ signedInEmail, initialKind, initialPage }: { signedInEmail: string | null; initialKind?: FeedbackKind; initialPage?: string }) {
  const t = useTranslations("feedback");
  const [values, setValues] = useState({
    kind: initialKind ?? ("" as FeedbackKind | ""),
    subject: "",
    body: "",
    email: signedInEmail ?? "",
    pageUrl: initialPage ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; slaHours: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-2 border-2 border-ink bg-sheet px-4 py-4">
        <p className="font-head text-lg">{t("sentTitle", { code: done.code })}</p>
        <p className="text-sm">{t("sentBody", { hours: done.slaHours })}</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await submitFeedback({ ...values, kind: values.kind as FeedbackKind });
          if (!result.ok) {
            setErrors(result.fields ?? {});
            setFormError(result.error);
            return;
          }
          setDone({ code: result.code, slaHours: result.slaHours });
        });
      }}
    >
      <Field id="fb-kind" label={t("kind")} error={errors.kind} required>
        <Select id="fb-kind" value={values.kind} onChange={set("kind")} aria-describedby={describedBy("fb-kind", errors.kind)}>
          <option value="">{t("chooseKind")}</option>
          {FEEDBACK_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`kinds.${kind}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="fb-subject" label={t("subject")} error={errors.subject} required>
        <Input id="fb-subject" value={values.subject} onChange={set("subject")} maxLength={150} aria-describedby={describedBy("fb-subject", errors.subject)} />
      </Field>
      <Field id="fb-body" label={t("body")} hint={t("bodyHint")} error={errors.body} required>
        <Textarea id="fb-body" value={values.body} onChange={set("body")} className="min-h-40" maxLength={5000} aria-describedby={describedBy("fb-body", errors.body, true)} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="fb-email" label={t("email")} hint={signedInEmail ? t("emailSignedIn") : undefined} error={errors.email} required>
          <Input id="fb-email" type="email" value={values.email} onChange={set("email")} readOnly={Boolean(signedInEmail)} autoComplete="email" aria-describedby={describedBy("fb-email", errors.email, Boolean(signedInEmail))} />
        </Field>
        <Field id="fb-page" label={t("pageUrl")} hint={t("pageUrlHint")} error={errors.pageUrl}>
          <Input id="fb-page" value={values.pageUrl} onChange={set("pageUrl")} aria-describedby={describedBy("fb-page", errors.pageUrl, true)} />
        </Field>
      </div>
      {formError ? (
        <p role="alert" className="border-l-4 border-stamp bg-sheet px-3 py-2 text-sm">
          {formError}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
