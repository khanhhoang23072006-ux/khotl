"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, describedBy, Field, Input, Textarea } from "@/components/ui/field";
import { submitTakedown } from "@/server/reports";

export function TakedownForm({ initialUrl }: { initialUrl: string }) {
  const t = useTranslations("takedown");
  const [values, setValues] = useState({ email: "", fullName: "", documentUrl: initialUrl, details: "" });
  const [declaration, setDeclaration] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  if (done) {
    return <p className="border-2 border-ink bg-sheet px-3 py-3">{t("sent")}</p>;
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await submitTakedown({ ...values, declaration: declaration as true });
          if (!result.ok) {
            setErrors(result.fields ?? {});
            setFormError(result.error);
            return;
          }
          setDone(true);
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="fullName" label={t("fullName")} error={errors.fullName} required>
          <Input id="fullName" value={values.fullName} onChange={set("fullName")} autoComplete="name" aria-describedby={describedBy("fullName", errors.fullName)} />
        </Field>
        <Field id="email" label={t("email")} error={errors.email} required>
          <Input id="email" type="email" value={values.email} onChange={set("email")} autoComplete="email" aria-describedby={describedBy("email", errors.email)} />
        </Field>
      </div>
      <Field id="documentUrl" label={t("documentUrl")} hint={t("documentUrlHint")} error={errors.documentUrl} required>
        <Input id="documentUrl" value={values.documentUrl} onChange={set("documentUrl")} aria-describedby={describedBy("documentUrl", errors.documentUrl, true)} />
      </Field>
      <Field id="details" label={t("details")} hint={t("detailsHint")} error={errors.details} required>
        <Textarea id="details" value={values.details} onChange={set("details")} className="min-h-36" aria-describedby={describedBy("details", errors.details, true)} />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={declaration} onChange={(event) => setDeclaration(event.target.checked)} />
        <span>{t("declaration")}</span>
      </label>
      {errors.declaration ? <p className="text-[13px] font-semibold text-stamp">{errors.declaration}</p> : null}
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
